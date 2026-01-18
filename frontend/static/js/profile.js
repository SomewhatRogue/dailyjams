// State
let sources = [];
let hasChanges = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    loadSources();
    loadSpotifyStatus();
    initializeSaveButton();
    initializeAddSourceButton();
    initializeSpotifyButtons();
});

// Load and display current user in header
async function loadCurrentUser() {
    try {
        const response = await fetch('/api/users/current');
        const data = await response.json();

        if (data.success && data.user) {
            const avatar = document.getElementById('header-avatar');
            const username = document.getElementById('header-username');

            if (avatar && username) {
                avatar.textContent = data.user.name.charAt(0).toUpperCase();
                avatar.style.backgroundColor = data.user.avatar_color;
                username.textContent = data.user.name;
            }
        }
    } catch (error) {
        console.error('Error loading current user:', error);
    }
}

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

// ============ Spotify Functions ============

// Load and display Spotify connection status
async function loadSpotifyStatus() {
    const loadingEl = document.getElementById('spotify-loading');
    const connectedEl = document.getElementById('spotify-connected');
    const disconnectedEl = document.getElementById('spotify-disconnected');

    try {
        const response = await fetch('/api/spotify/status');
        const data = await response.json();

        loadingEl.classList.add('hidden');

        if (data.success && data.connected) {
            // User is connected
            connectedEl.classList.remove('hidden');

            // Display Spotify name
            const nameEl = document.getElementById('spotify-display-name');
            nameEl.textContent = data.spotify_display_name || data.spotify_user_id;

            // Update sync status
            updateSyncStatus(data.taste_synced, data.last_sync);
        } else {
            // User is not connected
            disconnectedEl.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading Spotify status:', error);
        loadingEl.classList.add('hidden');
        disconnectedEl.classList.remove('hidden');
    }
}

// Update the sync status display
function updateSyncStatus(synced, lastSync) {
    const statusEl = document.getElementById('spotify-sync-status');

    if (synced && lastSync) {
        statusEl.textContent = `Last synced: ${formatDate(lastSync)}`;
        statusEl.classList.add('synced');
    } else {
        statusEl.textContent = 'Taste data not synced yet';
        statusEl.classList.remove('synced');
    }
}

// Format a date string for display
function formatDate(dateStr) {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString();
}

// Initialize Spotify button handlers
function initializeSpotifyButtons() {
    // Connect button
    const connectBtn = document.getElementById('spotify-connect-btn');
    if (connectBtn) {
        connectBtn.addEventListener('click', connectSpotify);
    }

    // Disconnect button
    const disconnectBtn = document.getElementById('spotify-disconnect-btn');
    if (disconnectBtn) {
        disconnectBtn.addEventListener('click', disconnectSpotify);
    }

    // Sync button
    const syncBtn = document.getElementById('spotify-sync-btn');
    if (syncBtn) {
        syncBtn.addEventListener('click', syncSpotifyTaste);
    }
}

// Connect to Spotify
async function connectSpotify() {
    try {
        const response = await fetch('/api/spotify/login?return_page=/profile');
        const data = await response.json();

        if (data.success && data.auth_url) {
            // Redirect to Spotify auth
            window.location.href = data.auth_url;
        } else {
            alert('Error starting Spotify connection: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error connecting to Spotify:', error);
        alert('Failed to connect to Spotify');
    }
}

// Disconnect from Spotify
async function disconnectSpotify() {
    if (!confirm('Are you sure you want to disconnect your Spotify account?')) {
        return;
    }

    try {
        const response = await fetch('/api/spotify/disconnect', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.success) {
            // Reload the page to show disconnected state
            window.location.reload();
        } else {
            alert('Error disconnecting: ' + (data.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error disconnecting from Spotify:', error);
        alert('Failed to disconnect from Spotify');
    }
}

// Sync Spotify taste data
async function syncSpotifyTaste() {
    const syncBtn = document.getElementById('spotify-sync-btn');
    const statusEl = document.getElementById('spotify-sync-status');

    // Disable button and show syncing state
    syncBtn.disabled = true;
    syncBtn.classList.add('syncing');
    syncBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
        Syncing...
    `;
    statusEl.textContent = 'Syncing your taste data...';

    try {
        const response = await fetch('/api/spotify/sync', {
            method: 'POST'
        });
        const data = await response.json();

        if (data.success) {
            // Show success
            const total = (data.synced.top_artists_medium || 0) +
                         (data.synced.followed_artists || 0) +
                         (data.synced.saved_track_artists || 0);

            statusEl.textContent = `Synced! Found ${total} artists from your library.`;
            statusEl.classList.add('synced');

            // Update to show last sync time after a moment
            setTimeout(() => {
                updateSyncStatus(true, new Date().toISOString());
            }, 3000);
        } else {
            statusEl.textContent = 'Sync failed: ' + (data.error || 'Unknown error');
            statusEl.classList.remove('synced');
        }
    } catch (error) {
        console.error('Error syncing taste data:', error);
        statusEl.textContent = 'Sync failed - please try again';
        statusEl.classList.remove('synced');
    } finally {
        // Re-enable button
        syncBtn.disabled = false;
        syncBtn.classList.remove('syncing');
        syncBtn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/><path d="M16 16h5v5"/></svg>
            Sync Taste Data
        `;
    }
}
