document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggleCopilot");
  const modeSelect = document.getElementById("modeSelect");
  const statusText = document.getElementById("statusText");

  // Load saved state
  chrome.storage.local.get(["enabled", "mode"], (data) => {
    toggle.checked = data.enabled ?? true;
    modeSelect.value = data.mode ?? "auto";
  });

  // Toggle enable/disable
  toggle.addEventListener("change", () => {
    const isEnabled = toggle.checked;
    chrome.storage.local.set({ enabled: isEnabled });
    statusText.textContent = isEnabled ? "Co-pilot is active." : "Co-pilot is off.";
    chrome.runtime.sendMessage({ command: "toggle", enabled: isEnabled });
  });

  // Mode selection
  modeSelect.addEventListener("change", () => {
    const selectedMode = modeSelect.value;
    chrome.storage.local.set({ mode: selectedMode });
    statusText.textContent = Mode set to: ${selectedMode};
    chrome.runtime.sendMessage({ command: "modeChange", mode: selectedMode });
  });
});