// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const statusIndicator = document.getElementById('statusIndicator');
  const siteControls = document.querySelector('.site-controls');
  const currentSiteEl = document.getElementById('currentSite');
  const toggleSiteButton = document.getElementById('toggleSiteButton');

  let currentHostname = null;

  const updateStatusIndicator = (isProcessing) => {
    statusIndicator.classList.toggle('hidden', !isProcessing);
  };

  // 1. Restore saved state from storage
  const restoreState = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      currentHostname = new URL(tab.url).hostname;
    }

    const {
      enabled = true,
      mode = 'auto',
      isProcessing = false,
      disabledSites = []
    } = await chrome.storage.local.get(['enabled', 'mode', 'isProcessing', 'disabledSites']);

    enabledToggle.checked = enabled;
    const currentModeRadio = document.querySelector(`input[name="mode"][value="${mode}"]`);
    if (currentModeRadio) {
      currentModeRadio.checked = true;
    }
    updateStatusIndicator(isProcessing);

    // Update site-specific controls
    if (currentHostname) {
      currentSiteEl.textContent = currentHostname;
      const isSiteDisabled = disabledSites.includes(currentHostname);
      toggleSiteButton.textContent = isSiteDisabled ? 'Enable on this site' : 'Disable on this site';
      toggleSiteButton.classList.toggle('reenable', isSiteDisabled);
      siteControls.classList.remove('hidden');
    }
  };

  // 2. Listen for changes to the master toggle
  enabledToggle.addEventListener('change', () => {
    const isEnabled = enabledToggle.checked;
    chrome.storage.local.set({ enabled: isEnabled });
  });

  // 3. Listen for changes to the AI mode
  modeRadios.forEach(radio => {
    radio.addEventListener('change', () => {
      if (radio.checked) {
        const newMode = radio.value;
        chrome.storage.local.set({ mode: newMode });
      }
    });
  });

  // 4. Listen for site toggle button
  toggleSiteButton.addEventListener('click', async () => {
    if (!currentHostname) return;

    const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
    const isSiteDisabled = disabledSites.includes(currentHostname);

    let newDisabledSites;
    if (isSiteDisabled) {
      // Remove from list to re-enable
      newDisabledSites = disabledSites.filter(site => site !== currentHostname);
    } else {
      // Add to list to disable
      newDisabledSites = [...disabledSites, currentHostname];
    }
    await chrome.storage.local.set({ disabledSites: newDisabledSites });

    // Update UI immediately
    toggleSiteButton.textContent = !isSiteDisabled ? 'Enable on this site' : 'Disable on this site';
    toggleSiteButton.classList.toggle('reenable', !isSiteDisabled);
  });

  // 5. Listen for storage changes to update status in real-time
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.isProcessing) {
      updateStatusIndicator(changes.isProcessing.newValue);
    }
  });

  // Initialize the popup state
  restoreState();
});