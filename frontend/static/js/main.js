// State management
let selectedTime = '';
let instrumentPreferences = {};
let selectedForPlaylist = new Set();  // Track which bands are selected for playlist
let spotifyAuthenticated = false;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeTimeButtons();
    initializeInstrumentToggles();
    initializeTempoSlider();
    initializeAdvancedToggle();
    initializeForm();
    restoreRecommendations(); // Restore recommendations from previous session
    checkSpotifyAuth(); // Check if user is authenticated with Spotify
    restorePlaylistSelections(); // Restore playlist selections after OAuth
});

// Time of Day Button Selection
function initializeTimeButtons() {
    const timeButtons = document.querySelectorAll('.btn-option');
    
    timeButtons.forEach(button => {
        button.addEventListener('click', function() {
            timeButtons.forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            selectedTime = this.getAttribute('data-time');
            document.getElementById('time-of-day').value = selectedTime;
        });
    });
}

// Instrument Toggle Buttons
function initializeInstrumentToggles() {
    const toggleButtons = document.querySelectorAll('.toggle-btn');
    
    toggleButtons.forEach(button => {
        button.addEventListener('click', function() {
            const instrument = this.getAttribute('data-instrument');
            let currentState = this.getAttribute('data-state');
            
            if (currentState === 'neutral') {
                currentState = 'yes';
                this.classList.add('yes');
                this.textContent = '✓';
                instrumentPreferences[instrument] = 'yes';
            } else if (currentState === 'yes') {
                currentState = 'no';
                this.classList.remove('yes');
                this.classList.add('no');
                this.textContent = '✗';
                instrumentPreferences[instrument] = 'no';
            } else {
                currentState = 'neutral';
                this.classList.remove('no');
                this.textContent = '—';
                delete instrumentPreferences[instrument];
            }
            
            this.setAttribute('data-state', currentState);
        });
    });
}

// Tempo Slider
function initializeTempoSlider() {
    const slider = document.getElementById('tempo');
    const display = document.getElementById('tempo-display');
    
    const tempoLabels = {
        1: 'Very Slow / Downtempo',
        2: 'Slow / Relaxed',
        3: 'Moderate',
        4: 'Upbeat / Lively',
        5: 'Very Fast / Energetic'
    };
    
    slider.addEventListener('input', function() {
        display.textContent = tempoLabels[this.value];
    });
    
    display.textContent = tempoLabels[slider.value];
}

// Advanced Options Toggle
function initializeAdvancedToggle() {
    const toggleBtn = document.getElementById('toggle-advanced');
    const advancedOptions = document.getElementById('advanced-options');
    
    toggleBtn.addEventListener('click', function() {
        if (advancedOptions.classList.contains('advanced-hidden')) {
            advancedOptions.classList.remove('advanced-hidden');
            advancedOptions.classList.add('advanced-visible');
            this.textContent = '⚙️ Hide Advanced Options';
        } else {
            advancedOptions.classList.remove('advanced-visible');
            advancedOptions.classList.add('advanced-hidden');
            this.textContent = '⚙️ Advanced Options (Instruments)';
        }
    });
}

// Form Submission
function initializeForm() {
    const form = document.getElementById('preferences-form');
    
    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const timeOfDay = document.getElementById('time-of-day').value;
        const mood = document.getElementById('mood').value;
        const tempo = document.getElementById('tempo').value;
        
        if (!timeOfDay) {
            alert('Please select a time of day');
            return;
        }
        
        if (!mood.trim()) {
            alert('Please enter a mood');
            return;
        }
        
        const instrumentsYes = [];
        const instrumentsNo = [];
        
        for (const instrument in instrumentPreferences) {
            if (instrumentPreferences[instrument] === 'yes') {
                instrumentsYes.push(instrument);
            } else if (instrumentPreferences[instrument] === 'no') {
                instrumentsNo.push(instrument);
            }
        }
        
        const selectedGenres = [];
        const genreCheckboxes = document.querySelectorAll('input[name="genre"]:checked');
        genreCheckboxes.forEach(checkbox => {
            selectedGenres.push(checkbox.value);
        });
        
        const trendingNow = document.getElementById('trending-now').checked;
        const discoverNew = document.getElementById('discover-new').checked;
        
        const requestData = {
            time_of_day: timeOfDay,
            mood: mood,
            tempo: parseInt(tempo),
            instruments_yes: instrumentsYes,
            instruments_no: instrumentsNo,
            genres: selectedGenres,
            trending_now: trendingNow,
            discover_new: discoverNew
        };
        
        // Clear old recommendations when submitting new search
        sessionStorage.removeItem('lastRecommendations');
        
        showLoading();
        
        try {
            const response = await fetch('/api/recommend', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestData)
            });
            
            const data = await response.json();
            
            if (data.success) {
                displayRecommendations(data.recommendations);
            } else {
                alert('Error getting recommendations: ' + data.error);
                hideLoading();
            }
        } catch (error) {
            alert('Error: ' + error.message);
            hideLoading();
        }
    });
}

function showLoading() {
    document.getElementById('submit-btn').disabled = true;
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');
}

function hideLoading() {
    document.getElementById('submit-btn').disabled = false;
    document.getElementById('loading').classList.add('hidden');
}

function displayRecommendations(recommendations) {
    // Save recommendations to sessionStorage for persistence across navigation
    sessionStorage.setItem('lastRecommendations', JSON.stringify(recommendations));
    
    hideLoading();
    
    const resultsSection = document.getElementById('results');
    const container = document.getElementById('recommendations-container');
    
    container.innerHTML = '';
    
    recommendations.forEach(rec => {
        const card = document.createElement('div');
        card.className = 'recommendation-card';
        
        const sourcesUsed = rec.sources_used || '';
        const spotifySearchUrl = 'https://open.spotify.com/search/' + encodeURIComponent(rec.band_name);
        
        let cardHTML = '<div class="band-name">' + rec.band_name + '</div>';
        cardHTML += '<div class="genre">' + (rec.genre || 'Various Genres') + '</div>';
        cardHTML += '<div class="description">' + rec.description + '</div>';
        cardHTML += '<div class="match-reason">Why this matches: ' + rec.match_reason + '</div>';
        
        if (rec.trending_enabled) {
            cardHTML += '<div class="trending-used">🔥 Trending Now - Based on ' + rec.trending_count + ' currently popular artists from Reddit</div>';
        }
        
        if (sourcesUsed) {
            cardHTML += '<div class="sources-used">📚 Sources: ' + sourcesUsed + '</div>';
        }
        
        cardHTML += '<div class="spotify-link-container">';
        cardHTML += '<a href="' + spotifySearchUrl + '" target="_blank" class="btn-spotify">🎧 Listen on Spotify</a>';
        cardHTML += '<label class="playlist-checkbox-label">';
        cardHTML += '<input type="checkbox" class="playlist-checkbox" data-id="' + rec.id + '" data-band-name="' + rec.band_name + '">';
        cardHTML += '<span>Add to Playlist</span>';
        cardHTML += '</label>';
        if (rec.in_playlist) {
            cardHTML += '<span class="in-playlist-badge">✓ In Playlist</span>';
        }
        cardHTML += '</div>';

        cardHTML += '<div class="feedback-buttons">';
        cardHTML += '<button class="btn-feedback thumbs-up" data-id="' + rec.id + '" data-type="positive">👍 Love it</button>';
        cardHTML += '<button class="btn-feedback skip" data-id="' + rec.id + '" data-type="skipped">⏭️ Skip</button>';
        cardHTML += '<button class="btn-feedback thumbs-down" data-id="' + rec.id + '" data-type="negative">👎 Not for me</button>';
        cardHTML += '</div>';

        card.innerHTML = cardHTML;
        container.appendChild(card);
    });

    initializeFeedbackButtons();
    initializePlaylistCheckboxes();
    updateCreatePlaylistButton();
    resultsSection.classList.remove('hidden');
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function initializeFeedbackButtons() {
    const feedbackButtons = document.querySelectorAll('.btn-feedback');
    
    feedbackButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const suggestionId = this.getAttribute('data-id');
            const feedbackType = this.getAttribute('data-type');
            
            const parentDiv = this.parentElement;
            const allButtons = parentDiv.querySelectorAll('.btn-feedback');
            
            // Remove previous selection styling
            allButtons.forEach(btn => {
                btn.classList.remove('selected');
                btn.disabled = false;
            });
            
            // Mark this button as selected
            this.classList.add('selected');
            this.disabled = true;
            
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
                    // Temporarily show feedback text
                    const originalText = this.textContent;
                    if (feedbackType === 'positive') {
                        this.textContent = '👍 Saved!';
                    } else if (feedbackType === 'negative') {
                        this.textContent = '👎 Saved!';
                    } else if (feedbackType === 'skipped') {
                        this.textContent = '⏭️ Saved!';
                    }
                    
                    // Reset text after 2 seconds
                    setTimeout(() => {
                        this.textContent = originalText;
                        this.disabled = false;
                    }, 2000);
                } else {
                    alert('Error saving feedback: ' + data.error);
                    this.classList.remove('selected');
                    this.disabled = false;
                }
            } catch (error) {
                alert('Error: ' + error.message);
                this.classList.remove('selected');
                this.disabled = false;
            }
        });
    });
}

// Restore recommendations from sessionStorage on page load
function restoreRecommendations() {
    const savedRecommendations = sessionStorage.getItem('lastRecommendations');

    if (savedRecommendations) {
        try {
            const recommendations = JSON.parse(savedRecommendations);
            if (recommendations && recommendations.length > 0) {
                displayRecommendations(recommendations);
            }
        } catch (error) {
            console.error('Error restoring recommendations:', error);
            sessionStorage.removeItem('lastRecommendations');
        }
    }
}

// Spotify Authentication Check
async function checkSpotifyAuth() {
    try {
        const response = await fetch('/api/spotify/status');
        const data = await response.json();

        if (data.success && data.authenticated) {
            spotifyAuthenticated = true;
            console.log('Spotify authenticated:', data.user.display_name);

            // Check if we just came back from OAuth and have pending selections
            const pendingSelections = sessionStorage.getItem('pendingPlaylistSelection');
            if (pendingSelections) {
                // Wait a bit for the UI to be ready, then auto-open playlist builder
                setTimeout(() => {
                    const selectedBands = Array.from(selectedForPlaylist).map(item => JSON.parse(item));
                    if (selectedBands.length > 0) {
                        showPlaylistModal(selectedBands);
                    }
                }, 500);
            }
        } else {
            spotifyAuthenticated = false;
        }
    } catch (error) {
        console.error('Error checking Spotify auth:', error);
        spotifyAuthenticated = false;
    }
}

// Restore playlist selections after OAuth redirect
function restorePlaylistSelections() {
    const pendingSelections = sessionStorage.getItem('pendingPlaylistSelection');

    if (pendingSelections) {
        try {
            const selections = JSON.parse(pendingSelections);

            // Restore the selections
            selections.forEach(item => {
                selectedForPlaylist.add(item);
            });

            // Update checkboxes to reflect selections
            setTimeout(() => {
                document.querySelectorAll('.playlist-checkbox').forEach(checkbox => {
                    const suggestionId = checkbox.getAttribute('data-id');
                    const bandName = checkbox.getAttribute('data-band-name');
                    const itemStr = JSON.stringify({ id: suggestionId, name: bandName });

                    if (selectedForPlaylist.has(itemStr)) {
                        checkbox.checked = true;
                    }
                });

                // Update the create playlist button
                updateCreatePlaylistButton();

                // Clear the pending selections after successful restore
                sessionStorage.removeItem('pendingPlaylistSelection');
            }, 100);
        } catch (error) {
            console.error('Error restoring playlist selections:', error);
            sessionStorage.removeItem('pendingPlaylistSelection');
        }
    }
}

// Initialize Playlist Checkboxes
function initializePlaylistCheckboxes() {
    const checkboxes = document.querySelectorAll('.playlist-checkbox');

    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            const suggestionId = this.getAttribute('data-id');
            const bandName = this.getAttribute('data-band-name');

            if (this.checked) {
                selectedForPlaylist.add(JSON.stringify({ id: suggestionId, name: bandName }));
            } else {
                selectedForPlaylist.delete(JSON.stringify({ id: suggestionId, name: bandName }));
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

            const resultsSection = document.getElementById('results');
            resultsSection.appendChild(button);
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
    // Check if authenticated
    if (!spotifyAuthenticated) {
        const doAuth = confirm('You need to connect to Spotify first. Would you like to connect now?');
        if (doAuth) {
            await initiateSpotifyAuth();
        }
        return;
    }

    // Get selected bands
    const selectedBands = Array.from(selectedForPlaylist).map(item => JSON.parse(item));

    // Show modal
    showPlaylistModal(selectedBands);
}

// Initiate Spotify Authentication
async function initiateSpotifyAuth() {
    try {
        // Save selected playlist items to sessionStorage before redirecting
        const selectedItems = Array.from(selectedForPlaylist);
        sessionStorage.setItem('pendingPlaylistSelection', JSON.stringify(selectedItems));

        const response = await fetch('/api/spotify/login');
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
    // Create modal overlay
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
    modalHTML += '<input type="text" id="playlist-name-input" placeholder="My DailyJams Mix" value="My DailyJams Mix ' + new Date().toLocaleDateString() + '">';
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

    // Initialize modal event listeners
    initializePlaylistModal(modal, selectedBands);

    // Load tracks for selected bands
    await loadTracksForPlaylist(selectedBands);
}

// Initialize Playlist Modal Event Listeners
function initializePlaylistModal(modal, selectedBands) {
    // Close button
    const closeBtn = modal.querySelector('.playlist-modal-close');
    closeBtn.addEventListener('click', () => modal.remove());

    // Cancel button
    const cancelBtn = modal.querySelector('.btn-cancel');
    cancelBtn.addEventListener('click', () => modal.remove());

    // Click outside modal to close
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });

    // Playlist option radio buttons
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

    // Create Playlist button
    const createBtn = modal.querySelector('.btn-create-playlist-final');
    createBtn.addEventListener('click', () => createPlaylistFromModal(modal, selectedBands));
}

// Load tracks for selected bands
async function loadTracksForPlaylist(selectedBands) {
    try {
        const artistConfigs = selectedBands.map(band => ({
            band_name: band.name,
            suggestion_id: band.id,
            track_count: 3  // Default 3 tracks
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

// Display tracks in modal with song count selectors
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

    // Initialize track count selectors
    const selectors = document.querySelectorAll('.track-count-selector');
    selectors.forEach(selector => {
        selector.addEventListener('change', function() {
            updateVisibleTracks(this);
        });
    });

    // Enable create button
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
        // Collect selected tracks
        const selectedTracks = {};
        const artistSections = modal.querySelectorAll('.playlist-artist-section');

        artistSections.forEach(section => {
            const artistName = section.dataset.artistName;
            const checkedBoxes = section.querySelectorAll('.track-checkbox:checked');
            const trackUris = Array.from(checkedBoxes).map(cb => cb.dataset.uri);

            if (trackUris.length > 0) {
                const artistData = JSON.parse(section.dataset.tracks);
                const suggestion = selectedBands.find(b => b.name === artistName);

                selectedTracks[artistName] = {
                    track_uris: trackUris,
                    suggestion_id: suggestion ? suggestion.id : null,
                    track_count: trackUris.length
                };
            }
        });

        // Prepare request
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

        // Create playlist
        const response = await fetch('/api/spotify/create-playlist', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestData)
        });

        const data = await response.json();

        if (data.success) {
            alert(`Playlist "${data.playlist.name}" created successfully!\n${data.playlist.track_count} tracks added.`);
            modal.remove();

            // Clear selections
            selectedForPlaylist.clear();
            document.querySelectorAll('.playlist-checkbox').forEach(cb => cb.checked = false);
            updateCreatePlaylistButton();

            // Open playlist in Spotify
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