// service-worker.js
// Secure Co-pilot - Background Service Worker (AI Chain, settings-aware)
// Replace previous versions with this file. Make sure manifest.json points to this file.

console.log("🧠 Secure Co-pilot service worker running... (v1.0)");

// ---------- Config / prompts ----------
// Triage prompt: returns one of Professional / Casual / Problematic
const TRIAGE_PROMPT = (text) => `
Analyze the following text and respond with EXACTLY one word (no punctuation, no explanation): Professional, Casual, or Problematic.

Text:
"""${text.replace(/"""/g, '\\"""')}"""
`;

// Rewriter instruction template (we call via rewriter/prompt API)
const REWRITE_INSTRUCTION = (text) => `
Rewrite the following user-written text so it is professional, constructive, and specific.
Rules:
- Remove insults and subjective judgments.
- If the original includes vague criticisms (e.g., "lazy"), suggest specific behavior to change.
- Preserve original intent and main facts.
- Keep length similar to the original unless a shorter phrasing improves clarity.
Output only the rewritten text.

Text:
"""${text.replace(/"""/g, '\\"""')}"""
`;

// Proofreader instruction (short)
const PROOFREAD_INSTRUCTION = (text) => `
Proofread and correct grammar, punctuation, and minor clarity issues in the text below.
Return only the corrected text.

Text:
"""${text.replace(/"""/g, '\\"""')}"""
`;

// Timeout helper for API calls (in ms)
const API_TIMEOUT = 8000;

// ---------- Fallback logic (works without chrome.ai) ----------
function quickClassifier(text) {
  const lower = text.toLowerCase();
  const problematic = ["lazy", "stupid", "idiot", "incompetent", "worst", "always late", "never", "terrible", "horrible", "inappropriate"];
  const casual = ["lol", "haha", "omg", "btw", "u ", "idk", "kinda", "tbh"];
  for (const k of problematic) if (lower.includes(k)) return "Problematic";
  for (const k of casual) if (lower.includes(k)) return "Casual";
  // If there's an explicit negative word followed by a person name (simple heuristic)
  if (/\b(is|was|seems)\b.*\b(lazy|incompetent|stupid)\b/.test(lower)) return "Problematic";
  return "Professional";
}

function quickRewrite(text) {
  // conservative replacements + guidance
  return text
    .replace(/\blazy\b/gi, "[needs improvement with punctuality/effort]")
    .replace(/\bidiot\b/gi, "[inappropriate term removed]")
    .replace(/\bincompetent\b/gi, "[requires additional support/training]")
    .replace(/\balways late\b/gi, "needs to improve punctuality")
    .replace(/\bterrible\b/gi, "[negative wording; be specific about issues]");
}

function quickProofread(text) {
  // trivial proofread: trim + capitalize first char + ensure ending punctuation
  let t = text.trim();
  if (!t) return t;
  t = t[0].toUpperCase() + t.slice(1);
  if (!/[.?!]$/.test(t)) t = t + ".";
  return t;
}

// ---------- Utility: promise with timeout ----------
function withTimeout(promise, ms, errorMsg = "API timeout") {
  let id;
  const timeout = new Promise((_, reject) => {
    id = setTimeout(() => reject(new Error(errorMsg)), ms);
  });
  return Promise.race([promise.finally(() => clearTimeout(id)), timeout]);
}

// ---------- Onboarding on first install ----------
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    // This is a first-time installation
    const url = chrome.runtime.getURL("onboarding.html");
    chrome.tabs.create({ url });
  }
});

// ---------- Messaging & AI chain ----------

// Helper to send suggestion back to the originating tab
async function sendSuggestionToTab(tabId, elementId, payload) {
  try {
    await chrome.tabs.sendMessage(tabId, {
      action: "showSuggestion",
      elementId,
      ...payload,
    });
  } catch (err) {
    console.warn("Secure Co-pilot: failed to send suggestion to tab", err);
  }
}

// ---------- AI API Callers (handles different API names) ----------

async function callRewriter(text) {
    const instruction = REWRITE_INSTRUCTION(text);
    let call;

    if (typeof chrome.ai.rewriter === "function") {
        call = chrome.ai.rewriter({ instruction, max_output_tokens: 256 });
    } else if (typeof chrome.ai.rewrite === "function") {
        // Fallback for older API naming
        call = chrome.ai.rewrite({ prompt: instruction, max_output_tokens: 256 });
    } else {
        throw new Error("No rewriter function available on chrome.ai");
    }

    const res = await withTimeout(call, API_TIMEOUT, "Rewriter timeout");
    // Handle various possible response keys
    return (res?.output_text || res?.rewrittenText || res?.text || "").trim();
}

async function callProofreader(text) {
    const instruction = PROOFREAD_INSTRUCTION(text);
    let call;

    if (typeof chrome.ai.proofreader === "function") {
        call = chrome.ai.proofreader({ prompt: instruction, max_output_tokens: 128 });
    } else if (typeof chrome.ai.proofread === "function") {
        call = chrome.ai.proofread({ prompt: instruction, max_output_tokens: 128 });
    } else if (typeof chrome.ai.proof === "function") {
        // Last resort for older API naming
        call = chrome.ai.proof({ prompt: instruction, max_output_tokens: 128 });
    } else {
        throw new Error("No proofreader function available on chrome.ai");
    }

    const res = await withTimeout(call, API_TIMEOUT, "Proofreader timeout");
    const suggestion = (res?.output_text || res?.text || "").trim();

    // If suggestion equals input (no change), return null
    if (!suggestion || suggestion.trim() === text.trim()) return null;

    return suggestion;
}

// Main message listener (content script -> background)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Handle analyzeText messages
  if (message && typeof message.text === "string") {
    // async processing
    (async () => {
      // Set processing status to true
      await chrome.storage.local.set({ isProcessing: true });
      try {
        // Respect user setting: enabled (default true)
        const { enabled = true, mode = "auto", disabledSites = [] } = await chrome.storage.local.get(["enabled", "mode", "disabledSites"]);
        if (!enabled) {
          return sendResponse({ suggestion: null, reason: "disabled" });
        }

        // Check if the site is on the disabled list
        const tabId = sender.tab?.id;
        const text = message.text;
        const elementId = message.elementId;
 
        if (tabId) {
            const tab = await chrome.tabs.get(tabId);
            const hostname = tab.url ? new URL(tab.url).hostname : null;
            if (hostname && disabledSites.includes(hostname)) {
                // Explicitly respond that the site is disabled
                sendResponse({ suggestion: null, reason: "site_disabled" });
                return;
                return sendResponse({ suggestion: null, reason: "site_disabled" });
            }
        }

        // If text is too short, ignore
        if (!text || text.trim().length < 6) {
          sendResponse({ suggestion: null, reason: "too_short" });
          return;
        }

        // 1) TRIAGE: determine Professional / Casual / Problematic
        let classification = null;

        // AI availability check
        const isAiAvailable = !!(chrome.ai && typeof chrome.ai.prompt === 'function');

        // Prefer chrome.ai prompt if available
        if (isAiAvailable) {
          try {
            const call = chrome.ai.prompt({ prompt: TRIAGE_PROMPT(text), max_output_tokens: 8 });
            const triageRes = await withTimeout(call, API_TIMEOUT, "Triage prompt timeout");
            // Many chrome.ai responses may be under different keys; attempt to read common ones
            const triageText = (triageRes?.output_text || triageRes?.text || triageRes?.result || "").trim();
            classification = triageText.split(/\s+/)[0];
            if (!classification) classification = quickClassifier(text);
          } catch (e) {
            console.warn("Secure Co-pilot: triage failed, using fallback classifier", e);
            classification = quickClassifier(text);
          }
        } else {
          classification = quickClassifier(text);
        }

        // If user selected a strict mode, override behavior (e.g., "grammar" mode)
        // mode: "auto" | "professional" | "grammar"
        const userMode = mode || "auto";
        if (userMode === "professional") classification = "Problematic"; // force rewrite behavior
        if (userMode === "grammar") classification = "Professional";

        // 2) ACTION based on classification
        let suggestion = null;
        let reason = null;
        let type = null;

        if (classification === "Problematic" || classification === "Casual") {
          // REWRITE path
          reason = `Detected as ${classification}`;
          type = "Rewrite";

          // Try Rewriter API variants safely with timeout
          if (isAiAvailable) {
            try {
              suggestion = await callRewriter(text);
            } catch (e) {
              console.warn("Secure Co-pilot: rewriter API failed, fallback to quickRewrite", e);
              suggestion = quickRewrite(text);
            }
          } else {
            suggestion = quickRewrite(text);
          }
        } else if (classification === "Professional") {
          // PROOFREAD path - only when userMode !== grammar forced earlier
          type = "Grammar";
          reason = "Professional tone detected; checking grammar";

          if (isAiAvailable) {
            try {
              suggestion = await callProofreader(text);
            } catch (e) {
              console.warn("Secure Co-pilot: proofreader failed, fallback to quickProofread", e);
              const fallback = quickProofread(text);
              suggestion = fallback === text ? null : fallback;
            }
          } else {
            // fallback
            const fallback = quickProofread(text);
            suggestion = fallback === text ? null : fallback;
          }
        } else {
          // Unknown classification -> do nothing
          suggestion = null;
        }

        // If we have a suggestion, deliver it to the content script attached to the tab
        if (suggestion && typeof tabId !== 'undefined') {
          await sendSuggestionToTab(tabId, elementId, {
            suggestion,
            type,
            reason,
          });
        }

        // sendResponse back to caller (optional)
        sendResponse({ suggestion: suggestion || null, classification, reason });
      } catch (err) {
        console.error("Secure Co-pilot: failure in analyze pipeline", err);
        try { sendResponse({ suggestion: null, error: (err && err.message) || String(err) }); } catch {}
      } finally {
        // Always set processing status to false when done
        await chrome.storage.local.set({ isProcessing: false });
      }
    })();

    // Indicate we'll respond asynchronously
    return true;
  }

  // Handle control messages from popup
  if (message && message.command === "toggle") {
    chrome.storage.local.set({ enabled: !!message.enabled });
    sendResponse({ ok: true });
    return true;
  }
  if (message && message.command === "modeChange") {
    chrome.storage.local.set({ mode: message.mode });
    sendResponse({ ok: true });
    return true;
  }

  // otherwise ignore
});
