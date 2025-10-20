// options.js
document.addEventListener('DOMContentLoaded', () => {
    const sitesList = document.getElementById('disabledSitesList');
    
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