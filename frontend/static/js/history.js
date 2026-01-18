// State
let allHistory = [];
let currentFilter = 'all';
let searchTerm = '';
let advancedFilters = {
    time: '',
    tempo: '',
    genre: '',
    mood: ''
};
let selectedForPlaylist = new Set();
let spotifyAuthenticated = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    loadHistory();
    initializeFilters();
    initializeSearch();
    initializeAdvancedFilters();
    checkSpotifyAuth();
    restorePlaylistSelectionsAfterOAuth();
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

// Load history from API
async function loadHistory() {
    try {
        const response = await fetch('/api/history');
        const data = await response.json();
        
        if (data.success) {
            allHistory = data.history;
            updateStats();
            displayHistory();
        } else {
            alert('Error loading history: ' + data.error);
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Failed to load history');
    } finally {
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('history-results').classList.remove('hidden');
    }
}

// Update statistics
function updateStats() {
    const total = allHistory.length;
    const loved = allHistory.filter(h => h.feedback_type === 'positive').length;
    const savedLater = allHistory.filter(h => h.feedback_type === 'save_later').length;
    const skipped = allHistory.filter(h => h.feedback_type === 'skipped').length;
    const disliked = allHistory.filter(h => h.feedback_type === 'negative').length;

    document.getElementById('total-count').textContent = total;
    document.getElementById('loved-count').textContent = loved;
    document.getElementById('saved-later-count').textContent = savedLater;
    document.getElementById('skipped-count').textContent = skipped;
    document.getElementById('disliked-count').textContent = disliked;
}

// Initialize filter buttons
function initializeFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class from all buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class to clicked button
            this.classList.add('active');
            
            // Update filter
            currentFilter = this.getAttribute('data-filter');
            
            // Re-display with new filter
            displayHistory();
        });
    });
}

// Initialize search
function initializeSearch() {
    const searchInput = document.getElementById('search-input');

    searchInput.addEventListener('input', function() {
        searchTerm = this.value.toLowerCase();
        displayHistory();
    });
}

// Initialize advanced filters
function initializeAdvancedFilters() {
    const toggleBtn = document.getElementById('toggle-advanced-filters');
    const advancedSection = document.getElementById('advanced-filters');
    const applyBtn = document.getElementById('apply-filters');
    const clearBtn = document.getElementById('clear-filters');

    // Toggle visibility
    toggleBtn.addEventListener('click', function() {
        if (advancedSection.classList.contains('advanced-filters-hidden')) {
            advancedSection.classList.remove('advanced-filters-hidden');
            this.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Hide Advanced Filters';
        } else {
            advancedSection.classList.add('advanced-filters-hidden');
            this.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg> Advanced Filters';
        }
    });

    // Apply filters
    applyBtn.addEventListener('click', function() {
        advancedFilters.time = document.getElementById('filter-time').value;
        advancedFilters.tempo = document.getElementById('filter-tempo').value;
        advancedFilters.genre = document.getElementById('filter-genre').value.toLowerCase().trim();
        advancedFilters.mood = document.getElementById('filter-mood').value.toLowerCase().trim();
        displayHistory();
    });

    // Clear filters
    clearBtn.addEventListener('click', function() {
        document.getElementById('filter-time').value = '';
        document.getElementById('filter-tempo').value = '';
        document.getElementById('filter-genre').value = '';
        document.getElementById('filter-mood').value = '';
        advancedFilters = { time: '', tempo: '', genre: '', mood: '' };
        displayHistory();
    });
}

// Display history with current filter and search
function displayHistory() {
    const container = document.getElementById('history-container');
    const noResults = document.getElementById('no-results');

    // Filter history
    let filteredHistory = allHistory;

    // Apply feedback type filter
    if (currentFilter !== 'all') {
        filteredHistory = filteredHistory.filter(h => h.feedback_type === currentFilter);
    }

    // Apply search filter
    if (searchTerm) {
        filteredHistory = filteredHistory.filter(h =>
            h.band_name.toLowerCase().includes(searchTerm)
        );
    }

    // Apply advanced filters
    if (advancedFilters.time) {
        filteredHistory = filteredHistory.filter(h => h.time_of_day === advancedFilters.time);
    }

    if (advancedFilters.tempo) {
        filteredHistory = filteredHistory.filter(h => h.tempo && h.tempo.toString() === advancedFilters.tempo);
    }

    if (advancedFilters.genre) {
        filteredHistory = filteredHistory.filter(h =>
            h.genre && h.genre.toLowerCase().includes(advancedFilters.genre)
        );
    }

    if (advancedFilters.mood) {
        filteredHistory = filteredHistory.filter(h =>
            h.mood && h.mood.toLowerCase().includes(advancedFilters.mood)
        );
    }
    
    // Clear container
    container.innerHTML = '';
    
    // Show/hide no results message
    if (filteredHistory.length === 0) {
        noResults.classList.remove('hidden');
        return;
    } else {
        noResults.classList.add('hidden');
    }
    
    // Create cards for each item
    filteredHistory.forEach(item => {
        const card = createHistoryCard(item);
        container.appendChild(card);
    });

    // Initialize change rating buttons
    initializeChangeRatingButtons();

    // Initialize playlist checkboxes
    initializePlaylistCheckboxes();
}

// Create a history card
function createHistoryCard(item) {
    const card = document.createElement('div');
    card.className = `history-card feedback-${item.feedback_type}`;

    // Format date
    const date = new Date(item.created_at);
    const formattedDate = date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    // Badge text with inline SVG icons
    const badgeText = {
        'positive': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path></svg> Loved',
        'negative': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path></svg> Not For Me',
        'skipped': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg> Skipped',
        'save_later': '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg> Saved for Later'
    };

    // Format instruments
    const instrumentsYes = item.instruments_yes ? item.instruments_yes.split(',').filter(i => i).join(', ') : 'None';
    const instrumentsNo = item.instruments_no ? item.instruments_no.split(',').filter(i => i).join(', ') : 'None';

    card.innerHTML = `
        <div class="history-header">
            <div>
                <div class="band-name">${item.band_name}</div>
                <div class="genre">${item.genre || 'Various Genres'}</div>
            </div>
            <div>
                <div class="feedback-badge ${item.feedback_type}">${badgeText[item.feedback_type]}</div>
                <div class="history-date">${formattedDate}</div>
            </div>
        </div>

        <div class="description">${item.description || 'No description available'}</div>

        ${item.match_reason ? `<div class="match-reason">Match: ${item.match_reason}</div>` : ''}

        <div class="preferences-used">
            <strong>Preferences Used:</strong>
            <div class="pref-item"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg> Time: ${item.time_of_day || 'N/A'}</div>
            <div class="pref-item"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg> Mood: ${item.mood || 'N/A'}</div>
            <div class="pref-item"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"></path><circle cx="6" cy="18" r="3"></circle><circle cx="18" cy="16" r="3"></circle></svg> Tempo: ${item.tempo || 'N/A'}/5</div>
            ${instrumentsYes !== 'None' ? `<div class="pref-item"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Instruments: ${instrumentsYes}</div>` : ''}
            ${instrumentsNo !== 'None' ? `<div class="pref-item"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg> Avoid: ${instrumentsNo}</div>` : ''}
        </div>

        <div class="spotify-link-container">
            <label class="playlist-checkbox-label">
                <input type="checkbox" class="playlist-checkbox" data-band-id="${item.id}" data-band-name="${item.band_name}">
                <span>Add to Playlist</span>
            </label>
        </div>

        <div class="change-rating-buttons">
            <button class="btn-change-rating thumbs-up" data-id="${item.id}" data-type="positive"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path></svg> Love</button>
            <button class="btn-change-rating save-later" data-id="${item.id}" data-type="save_later"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg> Save</button>
            <button class="btn-change-rating skip" data-id="${item.id}" data-type="skipped"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg> Skip</button>
            <button class="btn-change-rating thumbs-down" data-id="${item.id}" data-type="negative"><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path></svg> Dislike</button>
        </div>
    `;

    return card;
}
// Initialize change rating buttons
function initializeChangeRatingButtons() {
    const changeButtons = document.querySelectorAll('.btn-change-rating');
    
    changeButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const suggestionId = this.getAttribute('data-id');
            const feedbackType = this.getAttribute('data-type');
            
            if (!confirm('Change your rating for this band?')) {
                return;
            }
            
            try {
                const response = await fetch('/api/feedback', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        suggestion_id: suggestionId,
                        feedback_type: feedbackType
                    })
                });
                
                const data = await response.json();
                
                if (data.success) {
                    // Reload history to show updated rating
                    await loadHistory();
                } else {
                    alert('Error updating feedback: ' + data.error);
                }
            } catch (error) {
                alert('Error: ' + error.message);
            }
        });
    });
}

// ===== PLAYLIST FUNCTIONALITY =====

// Check Spotify Authentication Status
async function checkSpotifyAuth() {
    try {
        const response = await fetch('/api/spotify/auth-status');
        const data = await response.json();
        spotifyAuthenticated = data.authenticated || false;
    } catch (error) {
        console.error('Error checking Spotify auth:', error);
        spotifyAuthenticated = false;
    }
}

// Restore playlist selections after OAuth redirect
function restorePlaylistSelectionsAfterOAuth() {
    // Check if we just returned from OAuth
    const urlParams = new URLSearchParams(window.location.search);
    if (!urlParams.get('spotify')) {
        return;
    }

    // Restore pending selections
    const pendingSelections = sessionStorage.getItem('pendingPlaylistSelection');
    if (!pendingSelections) {
        return;
    }

    try {
        const selections = JSON.parse(pendingSelections);

        // Restore the selections to the Set
        selections.forEach(item => {
            selectedForPlaylist.add(item);
        });

        // Wait for history to load, then restore checkboxes and open modal
        setTimeout(() => {
            // Restore checkboxes
            document.querySelectorAll('.playlist-checkbox').forEach(checkbox => {
                const bandId = checkbox.getAttribute('data-band-id');
                const bandName = checkbox.getAttribute('data-band-name');
                const itemStr = JSON.stringify({ id: bandId, name: bandName });

                if (selectedForPlaylist.has(itemStr)) {
                    checkbox.checked = true;
                }
            });

            // Update the create playlist button
            updateCreatePlaylistButton();

            // Auto-open playlist builder if authenticated
            if (urlParams.get('spotify') === 'connected' && selectedForPlaylist.size > 0) {
                const selectedBands = Array.from(selectedForPlaylist).map(item => JSON.parse(item));
                showPlaylistModal(selectedBands);
            }

            // Clear pending selections
            sessionStorage.removeItem('pendingPlaylistSelection');

            // Clean up URL
            window.history.replaceState({}, document.title, '/history');
        }, 1000); // Wait for history to load

    } catch (error) {
        console.error('Error restoring playlist selections:', error);
        sessionStorage.removeItem('pendingPlaylistSelection');
    }
}

// Initialize Playlist Checkboxes
function initializePlaylistCheckboxes() {
    const checkboxes = document.querySelectorAll('.playlist-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const bandId = this.getAttribute('data-band-id');
            const bandName = this.getAttribute('data-band-name');

            if (this.checked) {
                selectedForPlaylist.add(JSON.stringify({ id: bandId, name: bandName }));
            } else {
                selectedForPlaylist.delete(JSON.stringify({ id: bandId, name: bandName }));
            }

            updateCreatePlaylistButton();
        });
    });
}

// Update Create Playlist Button Visibility
function updateCreatePlaylistButton() {
    let button = document.getElementById('create-playlist-btn');

    if (selectedForPlaylist.size > 0) {
        if (!button) {
            button = document.createElement('button');
            button.id = 'create-playlist-btn';
            button.className = 'btn-create-playlist';
            button.textContent = `Create Playlist (${selectedForPlaylist.size} bands selected)`;
            button.addEventListener('click', openPlaylistBuilder);

            document.body.appendChild(button);
        } else {
            button.textContent = `Create Playlist (${selectedForPlaylist.size} bands selected)`;
        }
    } else {
        if (button) {
            button.remove();
        }
    }
}

// Open Playlist Builder Modal
async function openPlaylistBuilder() {
    if (!spotifyAuthenticated) {
        const doAuth = confirm('You need to connect to Spotify first. Would you like to connect now?');
        if (doAuth) {
            await initiateSpotifyAuth();
        }
        return;
    }

    const selectedBands = Array.from(selectedForPlaylist).map(item => JSON.parse(item));
    showPlaylistModal(selectedBands);
}

// Initiate Spotify Authentication
async function initiateSpotifyAuth() {
    try {
        const selectedItems = Array.from(selectedForPlaylist);
        sessionStorage.setItem('pendingPlaylistSelection', JSON.stringify(selectedItems));

        // Pass the current page so OAuth can redirect back here
        const response = await fetch('/api/spotify/login?return_page=/history');
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

// Show Playlist Builder Modal
async function showPlaylistModal(selectedBands) {
    const modal = document.createElement('div');
    modal.id = 'playlist-modal';
    modal.className = 'playlist-modal';

    let modalHTML = '<div class="playlist-modal-content">';
    modalHTML += '<div class="playlist-modal-header">';
    modalHTML += '<h2>Create Spotify Playlist</h2>';
    modalHTML += '<button class="playlist-modal-close">&times;</button>';
    modalHTML += '</div>';

    modalHTML += '<div class="playlist-modal-body">';
    modalHTML += '<div class="playlist-name-section">';
    modalHTML += '<label for="playlist-name-input">Playlist Name:</label>';
    modalHTML += '<input type="text" id="playlist-name-input" placeholder="My DailyJams Mix" value="My DailyJams History Mix ' + new Date().toLocaleDateString() + '">';
    modalHTML += '</div>';

    modalHTML += '<div class="playlist-option-section">';
    modalHTML += '<label><input type="radio" name="playlist-option" value="new" checked> Create New Playlist</label>';
    modalHTML += '<label><input type="radio" name="playlist-option" value="existing"> Add to Existing Playlist</label>';
    modalHTML += '<select id="existing-playlist-select" class="hidden"></select>';
    modalHTML += '</div>';

    modalHTML += '<div class="playlist-loading">Loading tracks...</div>';
    modalHTML += '<div id="playlist-tracks-section" class="hidden">';
    modalHTML += '<h3>Selected Artists & Tracks</h3>';
    modalHTML += '<div id="playlist-tracks-list"></div>';
    modalHTML += '</div>';

    modalHTML += '</div>';

    modalHTML += '<div class="playlist-modal-footer">';
    modalHTML += '<button class="btn-cancel">Cancel</button>';
    modalHTML += '<button class="btn-create-playlist-final" disabled>Create Playlist</button>';
    modalHTML += '</div>';

    modalHTML += '</div>';
    modal.innerHTML = modalHTML;

    document.body.appendChild(modal);

    initializePlaylistModal(modal, selectedBands);
    await loadTracksForPlaylist(selectedBands);
}

// Initialize Playlist Modal Event Listeners
function initializePlaylistModal(modal, selectedBands) {
    const closeBtn = modal.querySelector('.playlist-modal-close');
    closeBtn.addEventListener('click', () => modal.remove());

    const cancelBtn = modal.querySelector('.btn-cancel');
    cancelBtn.addEventListener('click', () => modal.remove());

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    const radioButtons = modal.querySelectorAll('input[name="playlist-option"]');
    const existingPlaylistSelect = modal.querySelector('#existing-playlist-select');

    radioButtons.forEach(radio => {
        radio.addEventListener('change', async function() {
            if (this.value === 'existing') {
                existingPlaylistSelect.classList.remove('hidden');
                await loadExistingPlaylists();
            } else {
                existingPlaylistSelect.classList.add('hidden');
            }
        });
    });

    const createBtn = modal.querySelector('.btn-create-playlist-final');
    createBtn.addEventListener('click', () => createPlaylistFromModal(modal, selectedBands));
}

// Load tracks for selected bands
async function loadTracksForPlaylist(selectedBands) {
    try {
        const artistConfigs = selectedBands.map(band => ({
            band_name: band.name,
            suggestion_id: band.id,
            track_count: 3
        }));

        const response = await fetch('/api/spotify/tracks', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artists: artistConfigs })
        });

        const data = await response.json();

        if (data.success) {
            displayTracksInModal(data.artists);
        } else {
            alert('Error loading tracks: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Display tracks in modal
function displayTracksInModal(artistsData) {
    const loadingDiv = document.querySelector('.playlist-loading');
    const tracksSection = document.getElementById('playlist-tracks-section');
    const tracksList = document.getElementById('playlist-tracks-list');

    loadingDiv.classList.add('hidden');
    tracksSection.classList.remove('hidden');

    tracksList.innerHTML = '';

    for (const [artistName, artistInfo] of Object.entries(artistsData)) {
        if (!artistInfo.tracks || artistInfo.tracks.length === 0) continue;

        const artistDiv = document.createElement('div');
        artistDiv.className = 'playlist-artist-section';

        let artistHTML = '<div class="playlist-artist-header">';
        artistHTML += '<h4>' + artistName + '</h4>';
        artistHTML += '<label>Songs: <select class="track-count-selector" data-artist="' + artistName + '">';
        for (let i = 1; i <= Math.min(5, artistInfo.tracks.length); i++) {
            artistHTML += '<option value="' + i + '"' + (i === 3 ? ' selected' : '') + '>' + i + '</option>';
        }
        artistHTML += '</select></label>';
        artistHTML += '</div>';

        artistHTML += '<div class="playlist-tracks">';
        artistInfo.tracks.slice(0, 3).forEach((track, index) => {
            artistHTML += '<div class="playlist-track" data-index="' + index + '">';
            artistHTML += '<input type="checkbox" checked class="track-checkbox" data-uri="' + track.uri + '">';
            artistHTML += '<span>' + track.name + '</span>';
            artistHTML += '</div>';
        });
        artistHTML += '</div>';

        artistDiv.innerHTML = artistHTML;
        artistDiv.dataset.artistName = artistName;
        artistDiv.dataset.tracks = JSON.stringify(artistInfo.tracks);
        tracksList.appendChild(artistDiv);
    }

    const selectors = document.querySelectorAll('.track-count-selector');
    selectors.forEach(selector => {
        selector.addEventListener('change', function() {
            updateVisibleTracks(this);
        });
    });

    document.querySelector('.btn-create-playlist-final').disabled = false;
}

// Update visible tracks based on selector
function updateVisibleTracks(selector) {
    const artistName = selector.dataset.artist;
    const count = parseInt(selector.value);
    const artistSection = selector.closest('.playlist-artist-section');
    const tracksDiv = artistSection.querySelector('.playlist-tracks');
    const allTracks = JSON.parse(artistSection.dataset.tracks);

    tracksDiv.innerHTML = '';
    allTracks.slice(0, count).forEach((track, index) => {
        let trackHTML = '<div class="playlist-track" data-index="' + index + '">';
        trackHTML += '<input type="checkbox" checked class="track-checkbox" data-uri="' + track.uri + '">';
        trackHTML += '<span>' + track.name + '</span>';
        trackHTML += '</div>';
        tracksDiv.innerHTML += trackHTML;
    });
}

// Load existing playlists
async function loadExistingPlaylists() {
    try {
        const response = await fetch('/api/spotify/user-playlists');
        const data = await response.json();

        if (data.success) {
            const select = document.getElementById('existing-playlist-select');
            select.innerHTML = '<option value="">Select a playlist...</option>';

            data.playlists.forEach(playlist => {
                const option = document.createElement('option');
                option.value = playlist.id;
                option.textContent = `${playlist.name} (${playlist.track_count} tracks)`;
                select.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading playlists:', error);
    }
}

// Create playlist from modal
async function createPlaylistFromModal(modal, selectedBands) {
    const playlistOption = modal.querySelector('input[name="playlist-option"]:checked').value;
    const playlistName = modal.querySelector('#playlist-name-input').value;
    const createBtn = modal.querySelector('.btn-create-playlist-final');

    createBtn.disabled = true;
    createBtn.textContent = 'Creating...';

    try {
        const selectedTracks = {};
        const artistSections = modal.querySelectorAll('.playlist-artist-section');

        artistSections.forEach(section => {
            const artistName = section.dataset.artistName;
            const checkedBoxes = section.querySelectorAll('.track-checkbox:checked');
            const trackUris = Array.from(checkedBoxes).map(cb => cb.dataset.uri);

            if (trackUris.length > 0) {
                const suggestion = selectedBands.find(b => b.name === artistName);

                selectedTracks[artistName] = {
                    track_uris: trackUris,
                    suggestion_id: suggestion ? suggestion.id : null,
                    track_count: trackUris.length
                };
            }
        });

        const requestData = {
            playlist_name: playlistName,
            selected_tracks: selectedTracks
        };

        if (playlistOption === 'existing') {
            const existingPlaylistId = modal.querySelector('#existing-playlist-select').value;
            if (!existingPlaylistId) {
                alert('Please select a playlist');
                createBtn.disabled = false;
                createBtn.textContent = 'Create Playlist';
                return;
            }
            requestData.existing_playlist_id = existingPlaylistId;
        }

        const response = await fetch('/api/spotify/create-playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.success) {
            alert(`Playlist "${data.playlist.name}" created successfully!\n${data.playlist.track_count} tracks added.`);
            modal.remove();

            selectedForPlaylist.clear();
            document.querySelectorAll('.playlist-checkbox').forEach(cb => cb.checked = false);
            updateCreatePlaylistButton();

            if (confirm('Would you like to open the playlist in Spotify?')) {
                window.open(data.playlist.url, '_blank');
            }
        } else {
            alert('Error creating playlist: ' + data.error);
            createBtn.disabled = false;
            createBtn.textContent = 'Create Playlist';
        }
    } catch (error) {
        alert('Error: ' + error.message);
        createBtn.disabled = false;
        createBtn.textContent = 'Create Playlist';
    }
}
