// State
let sources = [];
let hasChanges = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadSources();
    initializeSaveButton();
    initializeAddSourceButton();
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
        <div class="source-actions">
            <button class="btn-delete" onclick="deleteSource(${source.id})">🗑️ Delete</button>
            <div class="source-toggle">
                <label class="toggle-switch">
                    <input type="checkbox" ${isEnabled ? 'checked' : ''} onchange="toggleSource(${source.id}, this.checked)">
                    <span class="toggle-slider"></span>
                </label>
                <span class="toggle-label">${isEnabled ? 'Enabled' : 'Disabled'}</span>
            </div>
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

// Delete source
async function deleteSource(sourceId) {
    if (!confirm('Are you sure you want to delete this source?')) {
        return;
    }
    
    try {
        const response = await fetch('/api/sources/delete', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                source_id: sourceId
            })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Remove from local state
            sources = sources.filter(s => s.id !== sourceId);
            
            // Re-render
            displaySources();
            
            // Show success message
            const statusEl = document.getElementById('save-status');
            statusEl.textContent = '✓ Source deleted!';
            statusEl.className = 'save-status success';
            
            setTimeout(() => {
                statusEl.textContent = '';
            }, 3000);
        } else {
            alert('Error deleting source: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to delete source');
    }
}

// Initialize add source button
function initializeAddSourceButton() {
    const addBtn = document.getElementById('add-source-btn');
    
    addBtn.addEventListener('click', async function() {
        const nameInput = document.getElementById('new-source-name');
        const urlInput = document.getElementById('new-source-url');
        const descInput = document.getElementById('new-source-description');
        const statusEl = document.getElementById('add-status');
        
        const sourceName = nameInput.value.trim();
        const sourceUrl = urlInput.value.trim();
        const description = descInput.value.trim();
        
        // Validate
        if (!sourceName) {
            statusEl.textContent = '✗ Source name is required';
            statusEl.className = 'add-status error';
            return;
        }
        
        statusEl.textContent = 'Adding...';
        statusEl.className = 'add-status';
        
        try {
            const response = await fetch('/api/sources/add', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    source_name: sourceName,
                    source_url: sourceUrl,
                    description: description,
                    is_enabled: 1
                })
            });
            
            const data = await response.json();
            
            if (data.success) {
                // Clear form
                nameInput.value = '';
                urlInput.value = '';
                descInput.value = '';
                
                // Show success
                statusEl.textContent = '✓ Source added successfully!';
                statusEl.className = 'add-status success';
                
                // Reload sources
                await loadSources();
                
                // Clear status after 3 seconds
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 3000);
            } else {
                statusEl.textContent = '✗ ' + data.error;
                statusEl.className = 'add-status error';
            }
        } catch (error) {
            console.error('Error:', error);
            statusEl.textContent = '✗ Failed to add source';
            statusEl.className = 'add-status error';
        }
    });
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
