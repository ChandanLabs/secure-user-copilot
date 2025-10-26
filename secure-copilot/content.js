// Cleaned: Removed redundant comments and optimized code structure for better readability.
// This ensures the content script initializes efficiently without unnecessary checks.
(async () => {
  const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
  const currentHostname = window.location.hostname;

  if (disabledSites.includes(currentHostname)) {
    console.log(`🔹 Secure Co-pilot is disabled for ${currentHostname}.`);
    return;
  }

  initializeCopilot();
})();

function initializeCopilot() {
  console.log("🔹 Secure Co-pilot content script loaded and active.");

  const CONSTANTS = {
    SECURE_COPILOT_ID_ATTR: 'data-secure-copilot-id',
    SECURE_COPILOT_ATTACHED_ATTR: 'data-secure-copilot-attached',
    BUBBLE_CLASS: 'secure-copilot-bubble',
    ACCEPT_BUTTON_ID: 'acceptSuggestion',
    DISMISS_BUTTON_ID: 'dismissSuggestion',
  };

  const dismissedTextCache = new Set();
  setInterval(() => {
    dismissedTextCache.clear();
    console.log("🔹 Secure Co-pilot dismissal cache cleared.");
  }, 5 * 60 * 1000);

  let elementCounter = 0;

  function debounce(func, delay) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => func(...args), delay);
    };
  }

  function throttle(func, delay) {
    let inProgress = false;
    return (...args) => {
      if (inProgress) {
        return;
      }
      inProgress = true;
      setTimeout(() => {
        func(...args);
        inProgress = false;
      }, delay);
    };
  }

  function sendMessageToBackground(message, callback) {
    chrome.runtime.sendMessage(message, (response) => {
      if (chrome.runtime.lastError) {
        if (chrome.runtime.lastError.message.includes('Extension context invalidated')) {
          alert('Secure Copilot was updated. Please refresh this tab to continue.');
          return;
        }
        console.error('Message error:', chrome.runtime.lastError);
        return;
      }
      if (callback) callback(response);
    });
  }

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'copilot_update') {
      alert('Secure Copilot was updated. Please refresh this tab for best results.');
    }
  });

  function attachListeners() {
    const inputs = document.querySelectorAll('textarea, [contenteditable]');
    inputs.forEach((el) => {
      if (el.getAttribute(CONSTANTS.SECURE_COPILOT_ATTACHED_ATTR)) return;

      const elementId = `secure-copilot-element-${elementCounter++}`;
      el.setAttribute(CONSTANTS.SECURE_COPILOT_ID_ATTR, elementId);
      el.setAttribute(CONSTANTS.SECURE_COPILOT_ATTACHED_ATTR, "true");

      const handleInput = debounce(async () => {
        const text = el.value || el.innerText;
        if (dismissedTextCache.has(text.trim())) return;
        if (!text || text.trim().length < 10) return;

        console.log("📝 Sending text to AI:", text);
        sendMessageToBackground({ action: 'analyzeText', text, elementId });
      }, 1000);

      el.addEventListener("input", handleInput);

      el.addEventListener("focus", () => showFocusIcon(el, elementId));
    });
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "showSuggestion") {
      const { elementId, suggestion, type, reason } = message;
      const targetElement = document.querySelector(`[${CONSTANTS.SECURE_COPILOT_ID_ATTR}="${elementId}"]`);

      if (targetElement) {
        console.log("💡 Received suggestion for element:", targetElement);
        showSuggestionUI(targetElement, { suggestion, type, reason });
      }
    }
  });

  // Display the subtle suggestion UI
  function showSuggestionUI(target, data) {
    // Remove existing suggestion if any
    const existing = document.querySelector(`.${CONSTANTS.BUBBLE_CLASS}`);
    if (existing) existing.remove();

    const bubble = document.createElement("div");
    bubble.className = CONSTANTS.BUBBLE_CLASS;

    // --- Security Hardening: Build UI programmatically to prevent XSS ---
    const icon = document.createElement('div');
    icon.className = 'secure-copilot-icon';
    icon.textContent = '🛡️';

    const tooltip = document.createElement('div');
    tooltip.className = 'secure-copilot-tooltip';

    const strong = document.createElement('strong');
    strong.textContent = `AI Suggestion (${data.type}): `;

    const reasonText = document.createTextNode(data.reason); // Render reason as plain text

    const suggestionEl = document.createElement('em');
    suggestionEl.textContent = data.suggestion; // Render suggestion as plain text

    const actions = document.createElement('div');
    actions.className = 'secure-copilot-actions';

    const acceptBtn = document.createElement('button');
    acceptBtn.className = 'sc-accept-btn';
    acceptBtn.id = CONSTANTS.ACCEPT_BUTTON_ID;
    acceptBtn.textContent = 'Accept';

    const dismissBtn = document.createElement('button');
    dismissBtn.className = 'sc-dismiss-btn';
    dismissBtn.id = CONSTANTS.DISMISS_BUTTON_ID;
    dismissBtn.textContent = 'Dismiss';

    actions.append(acceptBtn, dismissBtn);
    tooltip.append(strong, reasonText, document.createElement('br'), suggestionEl, document.createElement('br'), actions);
    bubble.append(icon, tooltip);

    document.body.appendChild(bubble);

    // --- DYNAMIC POSITIONING LOGIC (IMPROVED) ---
    const updatePosition = () => {
      const rect = target.getBoundingClientRect();
      bubble.style.position = "absolute";
      // Use a very high z-index to appear on top of most UIs
      bubble.style.zIndex = "2147483647";
      // Position at top-right corner of the element, with a small offset
      bubble.style.top = `${window.scrollY + rect.top + 5}px`;
      // 33px is the approx width of the icon (28px) + padding (5px)
      bubble.style.left = `${window.scrollX + rect.right - 33}px`;

      // Adjust tooltip for screen edges
      const tooltipRect = tooltip.getBoundingClientRect();
      if (tooltipRect.left < 0) {
        tooltip.style.left = '0px';
        tooltip.style.right = 'auto';
      } else if (tooltipRect.right > window.innerWidth) {
        tooltip.style.right = '100%';
        tooltip.style.left = 'auto';
      }
    };

    const throttledUpdate = throttle(updatePosition, 100);
    window.addEventListener('scroll', throttledUpdate, true);
    window.addEventListener('resize', throttledUpdate);

    // --- CLEANUP LOGIC ---
    const cleanup = () => {
      window.removeEventListener('scroll', throttledUpdate, true);
      window.removeEventListener('resize', throttledUpdate);
      bubble.remove();
    };

    // Button actions
    acceptBtn.addEventListener("click", () => {
      if (target.tagName === "TEXTAREA") {
        target.value = data.suggestion;
      } else {
        target.innerText = data.suggestion;
      }
      cleanup();
    });

    dismissBtn.addEventListener("click", () => {
      const originalText = target.value || target.innerText;
      dismissedTextCache.add(originalText.trim());
      cleanup();
    });

    // Set initial position
    updatePosition();
  }

  // Show icon on focus
  function showFocusIcon(el, elementId) {
    if (document.querySelector(`.${CONSTANTS.BUBBLE_CLASS}`)) return; // Already showing
    const bubble = document.createElement("div");
    bubble.className = CONSTANTS.BUBBLE_CLASS;
    const icon = document.createElement('div');
    icon.className = 'secure-copilot-icon';
    icon.textContent = '🛡️';
    bubble.appendChild(icon);
    document.body.appendChild(bubble);
    // Position it
    const rect = el.getBoundingClientRect();
    bubble.style.position = "absolute";
    bubble.style.zIndex = "2147483647";
    bubble.style.top = `${window.scrollY + rect.top + 5}px`;
    bubble.style.left = `${window.scrollX + rect.right - 33}px`;
  }

  // Add global CSS for bubble (IMPROVED)
  const style = document.createElement("style");
  style.textContent = `
:root {
  --sc-font: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  --sc-blue: #007aff;
  --sc-gray: #8e8e93;
  --sc-light-gray: #f2f2f7;
  --sc-border-color: #e5e5ea;
}
.secure-copilot-bubble {
  /* This is the container for the icon and its tooltip */
  position: absolute; 
  font-family: var(--sc-font);
  font-size: 14px;
  line-height: 1.4;
}
.secure-copilot-icon {
  cursor: pointer;
  font-size: 16px;
  background-color: #fff;
  border-radius: 50%;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.15);
  border: 1px solid var(--sc-border-color);
}
.secure-copilot-tooltip {
  position: absolute;
  bottom: 100%;
  right: 0; /* Position tooltip to the left of the icon */
  margin-bottom: 8px;
  background: #fff;
  border: 1px solid var(--sc-border-color);
  border-radius: 8px;
  padding: 12px;
  width: 300px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  z-index: 1; /* Stacks above the icon within the bubble */
  /* Hidden by default, shown on hover */
  opacity: 0;
  transform: translateY(5px);
  pointer-events: none;
  transition: opacity 0.2s ease, transform 0.2s ease;
}
.secure-copilot-bubble:hover .secure-copilot-tooltip {
  opacity: 1;
  transform: translateY(0);
  pointer-events: auto;
}
.secure-copilot-tooltip em {
  display: block;
  background-color: var(--sc-light-gray);
  padding: 8px;
  border-radius: 4px;
  margin: 4px 0;
  color: #333;
}
.secure-copilot-actions {
  margin-top: 10px;
  display: flex;
  gap: 8px;
}
.secure-copilot-actions button {
  padding: 6px 12px;
  border-radius: 6px;
  border: 1px solid transparent;
  cursor: pointer;
  font-weight: 500;
}
.sc-accept-btn {
  background-color: var(--sc-blue);
  color: white;
}
.sc-dismiss-btn {
  background-color: var(--sc-light-gray);
  color: var(--sc-gray);
  border-color: var(--sc-border-color);
}
`;
  document.head.appendChild(style);

  // Start observing new elements dynamically
  attachListeners();
  const observer = new MutationObserver(() => attachListeners());
  // Observe forms for better performance
  document.querySelectorAll('form').forEach(form => {
    observer.observe(form, { childList: true, subtree: true });
  });
      // Fallback to body if no forms
      if (document.querySelectorAll('form').length === 0) {
          observer.observe(document.body, { childList: true, subtree: true });
      }
} // End of initializeCopilot function