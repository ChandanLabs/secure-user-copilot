// service-worker.js
// Secure Co-pilot - Background Service Worker (AI Chain, settings-aware)

console.log("🧠 Secure Co-pilot service worker running... (v2.0)");

// ---------- AI Session Management ----------
let textSession = null;

async function initializeAiSession() {
  try {
    if (!chrome.ai) {
      console.warn("Secure Co-pilot: AI API not available.");
      return;
    }
    const canCreate = await chrome.ai.canCreateTextSession();
    if (canCreate === "no") {
      console.warn("Secure Co-pilot: AI text session cannot be created.");
      return;
    }
    textSession = await chrome.ai.createTextSession();
    console.log("✅ Secure Co-pilot: AI text session created successfully.");
  } catch (error) {
    console.error("Secure Co-pilot: Error initializing AI session:", error);
    // Retry after 5 seconds
    setTimeout(initializeAiSession, 5000);
  }
}

// Initialize the AI session when the service worker starts
initializeAiSession();

// ---------- Fallback logic (works without chrome.ai) ----------
function quickClassifier(text) {
  const lower = text.toLowerCase();
  const problematic = ["lazy", "stupid", "idiot", "incompetent", "worst", "always late", "never", "terrible", "horrible", "inappropriate"];
  const casual = ["lol", "haha", "omg", "btw", "u ", "idk", "kinda", "tbh"];
  for (const k of problematic) if (lower.includes(k)) return "Problematic";
  for (const k of casual) if (lower.includes(k)) return "Casual";
  if (/\b(is|was|seems)\b.*\b(lazy|incompetent|stupid)\b/.test(lower)) return "Problematic";
  return "Professional";
}

function quickRewrite(text) {
  return text
    .replace(/\blazy\b/gi, "[needs improvement with punctuality/effort]")
    .replace(/\bidiot\b/gi, "[inappropriate term removed]")
    .replace(/\bincompetent\b/gi, "[requires additional support/training]")
    .replace(/\balways late\b/gi, "needs to improve punctuality")
    .replace(/\bterrible\b/gi, "[negative wording; be specific about issues]");
}

function quickProofread(text) {
  let t = text.trim();
  if (!t) return t;
  t = t[0].toUpperCase() + t.slice(1);
  if (!/[.?!]$/.test(t)) t = t + ".";
  return t;
}

// ---------- Onboarding on first install ----------
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    const url = chrome.runtime.getURL("onboarding.html");
    chrome.tabs.create({ url });
  }
});

// ---------- Messaging & AI chain ----------

// Check AI availability
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkAI') {
    sendResponse({ available: !!textSession });
    return;
  }
});

// Main message listener (content script -> background)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'analyzeText') {
    (async () => {
      const responsePayload = { suggestion: null, classification: null, error: null };
      try {
        const { enabled = true, mode = 'auto', disabledSites = [] } = await chrome.storage.local.get(['enabled', 'mode', 'disabledSites']);
        if (!enabled) {
          return; // Disabled
        }

        const tabId = sender.tab?.id;
        if (tabId) {
          const tab = await chrome.tabs.get(tabId);
          const hostname = tab.url ? new URL(tab.url).hostname : null;
          if (hostname && disabledSites.includes(hostname)) {
            return; // Site disabled
          }
        }

        const { text, elementId } = message;
        if (!text || text.trim().length < 10) {
          return; // Text too short
        }

        let classification, suggestion, type;

        // Apply user mode
        let effectiveMode = mode;
        if (effectiveMode === 'professional') {
          classification = 'Problematic'; // Force rewrite
        } else if (effectiveMode === 'grammar') {
          classification = 'Professional'; // Force proofread
        } else {
          // Auto mode
          if (textSession) {
            // Use the AI session for processing
            const result = await textSession.prompt(`Analyze the following text and classify it as "Professional", "Casual", or "Problematic". Then, if it is "Problematic" or "Casual", rewrite it to be more professional. If it is "Professional", proofread it for grammar and spelling.

Text: "${text}"

Output in JSON format: {"classification": "...", "suggestion": "..."}`);
            
            try {
              const parsed = JSON.parse(result);
              classification = parsed.classification;
              suggestion = parsed.suggestion;
            } catch (e) {
              // Fallback parsing
              const lines = result.split('\n');
              classification = lines[0].trim();
              suggestion = lines.slice(1).join('\n').trim();
            }
            type = (classification === 'Problematic' || classification === 'Casual') ? 'Rewrite' : 'Grammar';

          } else {
            // Fallback to quick local functions
            classification = quickClassifier(text);
            if (classification === 'Problematic' || classification === 'Casual') {
              suggestion = quickRewrite(text);
              type = 'Rewrite';
            } else {
              suggestion = quickProofread(text);
              type = 'Grammar';
            }
          }
        }

        if (suggestion && suggestion !== text) {
          responsePayload.suggestion = suggestion;
          responsePayload.classification = classification;
          chrome.tabs.sendMessage(tabId, { action: "showSuggestion", elementId, suggestion, type, reason: `Detected as ${classification}` });
        }

      } catch (err) {
        console.error('Secure Co-pilot: failure in analyze pipeline', err);
        responsePayload.error = (err && err.message) || String(err);
      } finally {
        sendResponse(responsePayload);
      }
    })();

    return true; // Indicate we'll respond asynchronously
  }
});
