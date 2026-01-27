// State
let sources = [];
let hasChanges = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    initializeLockButton();
    initializeChangePinButton();
    loadSources();
    loadSpotifyStatus();
    initializeSaveButton();
    initializeAddSourceButton();
    initializeSpotifyButtons();
    checkSpotifyConnectionResult();
});

// Check URL for Spotify connection result
function checkSpotifyConnectionResult() {
    const params = new URLSearchParams(window.location.search);
    const spotifyResult = params.get('spotify');

    if (spotifyResult === 'already_connected') {
        const existingUser = params.get('existing_user') || 'another user';
        alert(`This Spotify account is already connected to "${existingUser}".\n\nTo connect a different Spotify account:\n1. On the Spotify authorization page, click "Not you?" to log out\n2. Then log in with the Spotify account you want to use\n\nOr disconnect Spotify from the other profile first.`);
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyResult === 'connected') {
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyResult === 'error') {
        alert('Failed to connect Spotify. Please try again.');
        window.history.replaceState({}, '', window.location.pathname);
    } else if (spotifyResult === 'cancelled') {
        // User cancelled, just clean up URL
        window.history.replaceState({}, '', window.location.pathname);
    }
}

// Initialize lock button handler
function initializeLockButton() {
    const lockBtn = document.getElementById('lock-btn');
    if (lockBtn) {
        lockBtn.addEventListener('click', lockProfile);
    }
}

// Lock profile and return to user selection
async function lockProfile() {
    try {
        const response = await fetch('/api/users/lock', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        window.location.href = '/users';
    } catch (error) {
        console.error('Error locking profile:', error);
        window.location.href = '/users';
    }
}

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
            statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg> Source deleted!';
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
            statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Source name is required';
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
                statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg> Source added successfully!';
                statusEl.className = 'add-status success';
                
                // Reload sources
                await loadSources();
                
                // Clear status after 3 seconds
                setTimeout(() => {
                    statusEl.textContent = '';
                }, 3000);
            } else {
                statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> ' + data.error;
                statusEl.className = 'add-status error';
            }
        } catch (error) {
            console.error('Error:', error);
            statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Failed to add source';
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
            statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><polyline points="20 6 9 17 4 12"></polyline></svg> Saved successfully!';
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
            statusEl.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle;"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Failed to save';
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

            // Update header Spotify status
            updateHeaderSpotifyStatus(true, data.spotify_display_name, data.taste_synced);
        } else {
            // User is not connected
            disconnectedEl.classList.remove('hidden');
            updateHeaderSpotifyStatus(false);
        }
    } catch (error) {
        console.error('Error loading Spotify status:', error);
        loadingEl.classList.add('hidden');
        disconnectedEl.classList.remove('hidden');
        updateHeaderSpotifyStatus(false);
    }
}

// Update Spotify status display in header
function updateHeaderSpotifyStatus(connected, displayName = null, tasteSynced = false) {
    const indicator = document.getElementById('spotify-indicator');
    const statusText = document.getElementById('spotify-status-text');
    const actionBtn = document.getElementById('spotify-action-btn');

    if (!indicator || !statusText || !actionBtn) return;

    if (connected) {
        indicator.className = 'spotify-status-indicator connected';
        statusText.textContent = displayName || 'Connected';
        actionBtn.textContent = 'Re-sync';
        actionBtn.className = 'spotify-action-btn';
        actionBtn.style.display = 'inline-block';
        actionBtn.onclick = handleHeaderSpotifyResync;
    } else {
        indicator.className = 'spotify-status-indicator disconnected';
        statusText.textContent = 'Not connected';
        actionBtn.textContent = 'Connect';
        actionBtn.className = 'spotify-action-btn connect';
        actionBtn.style.display = 'inline-block';
        actionBtn.onclick = handleHeaderSpotifyConnect;
    }
}

// Handle Spotify re-sync button click in header
async function handleHeaderSpotifyResync() {
    const actionBtn = document.getElementById('spotify-action-btn');
    const originalText = actionBtn.textContent;
    actionBtn.textContent = 'Syncing...';
    actionBtn.disabled = true;

    try {
        const response = await fetch('/api/spotify/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (data.success) {
            actionBtn.textContent = 'Synced!';
            // Also refresh the main Spotify status section
            loadSpotifyStatus();
            setTimeout(() => {
                actionBtn.textContent = 'Re-sync';
                actionBtn.disabled = false;
            }, 2000);
        } else {
            alert('Sync failed: ' + (data.error || 'Unknown error'));
            actionBtn.textContent = originalText;
            actionBtn.disabled = false;
        }
    } catch (error) {
        console.error('Error syncing Spotify:', error);
        alert('Error syncing: ' + error.message);
        actionBtn.textContent = originalText;
        actionBtn.disabled = false;
    }
}

// Handle Spotify connect button click in header
async function handleHeaderSpotifyConnect() {
    try {
        const response = await fetch('/api/spotify/login?return_page=' + encodeURIComponent(window.location.pathname));
        const data = await response.json();

        if (data.success) {
            window.location.href = data.auth_url;
        } else {
            alert('Error initiating Spotify login: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
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

// ============ Change PIN Functions ============

// Initialize Change PIN button
function initializeChangePinButton() {
    const changePinBtn = document.getElementById('change-pin-btn');
    if (changePinBtn) {
        changePinBtn.addEventListener('click', showChangePinModal);
    }

    // Modal buttons
    const cancelBtn = document.getElementById('cancel-change-pin');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', hideChangePinModal);
    }

    const submitBtn = document.getElementById('submit-change-pin');
    if (submitBtn) {
        submitBtn.addEventListener('click', submitChangePin);
    }

    // Allow Enter key to submit
    const confirmInput = document.getElementById('confirm-new-pin-input');
    if (confirmInput) {
        confirmInput.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                submitChangePin();
            }
        });
    }

    // Close modal on background click
    const modal = document.getElementById('change-pin-modal');
    if (modal) {
        modal.addEventListener('click', function(e) {
            if (e.target === this) {
                hideChangePinModal();
            }
        });
    }
}

// Show Change PIN modal
function showChangePinModal() {
    document.getElementById('current-pin-input').value = '';
    document.getElementById('new-pin-input').value = '';
    document.getElementById('confirm-new-pin-input').value = '';
    document.getElementById('change-pin-error').classList.add('hidden');
    document.getElementById('change-pin-success').classList.add('hidden');
    document.getElementById('change-pin-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('current-pin-input').focus(), 100);
}

// Hide Change PIN modal
function hideChangePinModal() {
    document.getElementById('change-pin-modal').classList.add('hidden');
}

// Submit Change PIN
async function submitChangePin() {
    const currentPin = document.getElementById('current-pin-input').value;
    const newPin = document.getElementById('new-pin-input').value;
    const confirmPin = document.getElementById('confirm-new-pin-input').value;
    const errorEl = document.getElementById('change-pin-error');
    const successEl = document.getElementById('change-pin-success');

    // Reset messages
    errorEl.classList.add('hidden');
    successEl.classList.add('hidden');

    // Validate current PIN
    if (currentPin.length !== 4 || !/^\d{4}$/.test(currentPin)) {
        errorEl.textContent = 'Current PIN must be 4 digits.';
        errorEl.classList.remove('hidden');
        return;
    }

    // Validate new PIN
    if (newPin.length !== 4 || !/^\d{4}$/.test(newPin)) {
        errorEl.textContent = 'New PIN must be 4 digits.';
        errorEl.classList.remove('hidden');
        return;
    }

    // Check PINs match
    if (newPin !== confirmPin) {
        errorEl.textContent = 'New PINs do not match.';
        errorEl.classList.remove('hidden');
        document.querySelector('#change-pin-modal .pin-modal-content').classList.add('shake');
        setTimeout(() => {
            document.querySelector('#change-pin-modal .pin-modal-content').classList.remove('shake');
        }, 500);
        return;
    }

    // Check not same as current
    if (newPin === currentPin) {
        errorEl.textContent = 'New PIN must be different from current PIN.';
        errorEl.classList.remove('hidden');
        return;
    }

    try {
        const response = await fetch('/api/users/change-pin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                current_pin: currentPin,
                new_pin: newPin
            })
        });

        const data = await response.json();

        if (data.success) {
            successEl.classList.remove('hidden');
            // Close modal after short delay
            setTimeout(() => {
                hideChangePinModal();
            }, 1500);
        } else {
            errorEl.textContent = data.error || 'Failed to change PIN';
            errorEl.classList.remove('hidden');
            if (data.error === 'Current PIN is incorrect') {
                document.querySelector('#change-pin-modal .pin-modal-content').classList.add('shake');
                setTimeout(() => {
                    document.querySelector('#change-pin-modal .pin-modal-content').classList.remove('shake');
                }, 500);
                document.getElementById('current-pin-input').value = '';
                document.getElementById('current-pin-input').focus();
            }
        }
    } catch (error) {
        console.error('Error changing PIN:', error);
        errorEl.textContent = 'Error changing PIN. Please try again.';
        errorEl.classList.remove('hidden');
    }
}
