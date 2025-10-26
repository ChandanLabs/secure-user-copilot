// options.js
document.addEventListener('DOMContentLoaded', async () => {
    const sitesList = document.getElementById('disabledSitesList');
    const aiStatus = document.getElementById('aiStatus');
    const clearDataBtn = document.getElementById('clearData');

    // Check AI status
    chrome.runtime.sendMessage({ action: 'checkAI' }, (response) => {
        if (chrome.runtime.lastError) {
            aiStatus.textContent = 'AI Status: Error checking. The built-in AI may not be available in your version of Chrome.';
            aiStatus.style.color = '#d93025';
        } else {
            if (response.available) {
                aiStatus.textContent = 'AI Status: The privacy-preserving, built-in AI is active. No configuration is needed.';
                aiStatus.style.color = '#1e8e3e';
            } else {
                aiStatus.textContent = 'AI Status: The built-in AI is currently unavailable. Please ensure you are on the latest version of Chrome.';
                aiStatus.style.color = '#d93025';
            }
        }
    });

    // Clear all data
    clearDataBtn.addEventListener('click', async () => {
        if (confirm('Clear all settings and blocked sites?')) {
            await chrome.storage.local.clear();
            renderSites([]);
            apiKeyInput.value = '';
            aiStatus.textContent = 'Data cleared. Refresh to check AI.';
        }
    });

    const renderSites = (sites) => {
        sitesList.innerHTML = ''; // Clear the list first

        if (sites.length === 0) {
            const emptyState = document.createElement('li');
            emptyState.textContent = 'No sites are disabled.';
            emptyState.className = 'empty-state';
            sitesList.appendChild(emptyState);
            return;
        }

        sites.forEach(site => {
            const listItem = document.createElement('li');

            const siteName = document.createElement('span');
            siteName.textContent = site;

            const removeButton = document.createElement('button');
            removeButton.textContent = 'Remove';
            removeButton.dataset.site = site;

            removeButton.addEventListener('click', async () => {
                const { disabledSites = [] } = await chrome.storage.local.get('disabledSites');
                const newSites = disabledSites.filter(s => s !== site);
                await chrome.storage.local.set({ disabledSites: newSites });
                // The onChanged listener below will handle the re-render automatically.
            });

            listItem.appendChild(siteName);
            listItem.appendChild(removeButton);
            sitesList.appendChild(listItem);
        });
    };

    // Initial load
    chrome.storage.local.get('disabledSites').then((data) => {
        renderSites(data.disabledSites || []);
    });

    // Listen for changes in storage to keep the list in sync
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local' && changes.disabledSites) {
            renderSites(changes.disabledSites.newValue || []);
        }
    });
});
