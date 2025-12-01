// State
let sources = [];
let hasChanges = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadSources();
    initializeSaveButton();
});

// Load sources from API
async function loadSources() {
    try {
        const response = await fetch('/api/sources/all');
        const data = await response.json();
        
        if (data.success) {
            sources = data.sources;
            displaySources();
        } else {
            alert('Error loading sources: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load sources');
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('sources-container').classList.remove('hidden');
    }
}

// Display sources
function displaySources() {
    const container = document.getElementById('sources-container');
    container.innerHTML = '';
    
    sources.forEach(source => {
        const card = createSourceCard(source);
        container.appendChild(card);
    });
}

// Create a source card
function createSourceCard(source) {
    const card = document.createElement('div');
    card.className = `source-card ${source.is_enabled ? '' : 'disabled'}`;
    card.dataset.sourceId = source.id;
    
    const isEnabled = source.is_enabled === 1;
    
    card.innerHTML = `
        <div class="source-info">
            <div class="source-name">${source.source_name}</div>
            <div class="source-description">${source.description || 'No description available'}</div>
            ${source.source_url ? `<a href="${source.source_url}" target="_blank" class="source-url">${source.source_url}</a>` : ''}
        </div>
        <div class="source-toggle">
            <label class="toggle-switch">
                <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleSource(${source.id}, this.checked)">
                <span class="toggle-slider"></span>
            </label>
            <span class="toggle-label">${isEnabled ? 'Enabled' : 'Disabled'}</span>
        </div>
    `;
    
    return card;
}

// Toggle source enabled/disabled
function toggleSource(sourceId, isEnabled) {
    // Update local state
    const source = sources.find(s => s.id === sourceId);
    if (source) {
        source.is_enabled = isEnabled ? 1 : 0;
    }
    
    // Update card appearance
    const card = document.querySelector(`[data-source-id="${sourceId}"]`);
    if (card) {
        if (isEnabled) {
            card.classList.remove('disabled');
        } else {
            card.classList.add('disabled');
        }
        
        const label = card.querySelector('.toggle-label');
        label.textContent = isEnabled ? 'Enabled' : 'Disabled';
    }
    
    // Mark as having changes
    hasChanges = true;
    document.getElementById('save-btn').disabled = false;
}

// Initialize save button
function initializeSaveButton() {
    const saveBtn = document.getElementById('save-btn');
    
    saveBtn.addEventListener('click', async function() {
        if (!hasChanges) return;
        
        const statusEl = document.getElementById('save-status');
        statusEl.textContent = 'Saving...';
        statusEl.className = 'save-status';
        
        try {
            // Save each source preference
            const promises = sources.map(source => 
                fetch('/api/sources/update', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        source_id: source.id,
                        is_enabled: source.is_enabled
                    })
                })
            );
            
            await Promise.all(promises);
            
            // Show success
            statusEl.textContent = '✓ Saved successfully!';
            statusEl.className = 'save-status success';
            
            // Disable save button
            hasChanges = false;
            saveBtn.disabled = true;
            
            // Clear status after 3 seconds
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);
            
        } catch (error) {
            console.error('Error:', error);
            statusEl.textContent = '✗ Failed to save';
            statusEl.className = 'save-status error';
        }
    });
}
