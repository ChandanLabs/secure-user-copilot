
// This ensures the service worker handles messages efficiently without duplicates.
console.log("🧠 Secure Co-pilot service worker running... (v2.0)");
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
    setTimeout(initializeAiSession, 5000);
  }
}

initializeAiSession();
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
    .replace(/\blazy\b/gi, "needs improvement with punctuality and effort")
    .replace(/\bidiot\b/gi, "[inappropriate term removed]")
    .replace(/\bincompetent\b/gi, "requires additional support and training")
    .replace(/\balways late\b/gi, "needs to improve punctuality")
    .replace(/\bterrible\b/gi, "needs improvement in performance");
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

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'checkAI') {
    sendResponse({ available: !!textSession });
    return;
  } else if (message.action === 'analyzeText') {
    (async () => {
      const responsePayload = { suggestion: null, classification: null, error: null };
      try {
        const { enabled = true, mode = 'auto', disabledSites = [] } = await chrome.storage.local.get(['enabled', 'mode', 'disabledSites']);
        if (!enabled) {
          return;
        }

        const tabId = sender.tab?.id;
        if (tabId) {
          const tab = await chrome.tabs.get(tabId);
          const hostname = tab.url ? new URL(tab.url).hostname : null;
          if (hostname && disabledSites.includes(hostname)) {
            return;
          }
        }

        const { text, elementId } = message;
        if (!text || text.trim().length < 10) {
          return;
        }

        let classification, suggestion, type;

        let effectiveMode = mode;
        if (effectiveMode === 'professional') {
          classification = 'Problematic';
        } else if (effectiveMode === 'grammar') {
          classification = 'Professional';
        } else {
          if (textSession) {
            const result = await textSession.prompt(`Classify the text as "Professional", "Casual", or "Problematic". If it's not "Professional", rewrite it. If it is, proofread it. Output JSON: {"classification": "...", "suggestion": "..."}\n\nText: "${text}"`);
            
            try {
              const parsed = JSON.parse(result);
              classification = parsed.classification;
              suggestion = parsed.suggestion;
            } catch (e) {
              const jsonMatch = result.match(/\{.*\}/s);
              if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[0]);
                classification = parsed.classification;
                suggestion = parsed.suggestion;
              } else {
                classification = quickClassifier(text);
                suggestion = result;
              }
            }
            type = (classification === 'Problematic' || classification === 'Casual') ? 'Rewrite' : 'Grammar';

          } else {
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
        if (sender.tab?.id) {
          chrome.tabs.sendMessage(sender.tab.id, { action: "analysisError", error: responsePayload.error });
        }
      } finally {
        sendResponse(responsePayload);
      }
    })();

    return true;
  }
});
