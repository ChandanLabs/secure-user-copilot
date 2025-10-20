// popup.js

document.addEventListener('DOMContentLoaded', () => {
  const enabledToggle = document.getElementById('enabledToggle');
  const modeRadios = document.querySelectorAll('input[name="mode"]');
  const statusIndicator = document.getElementById('statusIndicator');
  const siteControls = document.querySelector('.site-controls');
  const currentSiteEl = document.getElementById('currentSite');
  const toggleSiteButton = document.getElementById('toggleSiteButton');

  let currentHostname = null;
  let activeTabId = null;

  const updateStatusIndicator = (isProcessing) => {
    statusIndicator.classList.toggle('hidden', !isProcessing);
  };

  // 1. Restore saved state from storage
  const restoreState = async () => {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.startsWith('http')) {
      currentHostname = new URL(tab.url).hostname;
      activeTabId = tab.id;
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
  enabledToggle.addEventListener('change', async () => {
    const isEnabled = enabledToggle.checked;
    await chrome.storage.local.set({ enabled: isEnabled });
    // Reload the active tab to make the change effective immediately
    if (activeTabId) {
      chrome.tabs.reload(activeTabId);
    }
    window.close();
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
    if (!currentHostname || !activeTabId) return;

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

    // Reload the tab to apply the change, then close the popup
    chrome.tabs.reload(activeTabId);
    window.close();
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
