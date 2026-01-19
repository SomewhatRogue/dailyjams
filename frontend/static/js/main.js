// State management
let selectedTime = '';
let instrumentPreferences = {};
let selectedForPlaylist = new Set();  // Track which bands are selected for playlist
let spotifyAuthenticated = false;
let spotifyAuthChecked = false;  // Track if auth check is complete

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser(); // Load and display current user in header
    initializeTimeButtons();
    initializeInstrumentToggles();
    initializeTempoSlider();
    initializeDiscoverySlider(); // Day/Night discovery slider
    initializeCollapsibleSections(); // New collapsible UI
    initializeForm();
    restoreRecommendations(); // Restore recommendations from previous session
    checkSpotifyAuth(); // Check if user is authenticated with Spotify
    restorePlaylistSelections(); // Restore playlist selections after OAuth
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

// Collapsible Sections (NEW for redesign)
function initializeCollapsibleSections() {
    const headers = document.querySelectorAll('.collapsible-header');

    headers.forEach(header => {
        header.addEventListener('click', function() {
            const sectionId = this.getAttribute('data-section');
            const content = document.getElementById('section-' + sectionId);
            const isActive = this.classList.contains('active');

            // Toggle active state
            if (isActive) {
                this.classList.remove('active');
                content.classList.remove('active');
            } else {
                this.classList.add('active');
                content.classList.add('active');
            }
        });
    });
}

// Time of Day Button Selection (Updated for pill style)
function initializeTimeButtons() {
    const timeButtons = document.querySelectorAll('.pill[data-time]');

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

// Discovery Arc Slider (Half-Moon Dome Design)
function initializeDiscoverySlider() {
    const arc = document.getElementById('discovery-arc');
    const thumb = document.getElementById('arc-thumb');
    const slider = document.getElementById('discovery-level');
    const label = document.getElementById('discovery-label');
    const description = document.getElementById('discovery-description');
    const stars = document.getElementById('arc-stars');
    const fill = document.getElementById('arc-fill');
    const track = document.querySelector('.arc-track');

    // Check if elements exist (might not be on discover.html)
    if (!arc || !thumb || !slider) return;

    const discoveryLevels = {
        1: { label: 'Pure Discovery', desc: 'Only artists you\'ve never heard of' },
        2: { label: 'Mostly New', desc: 'Mostly new with occasional familiar vibes' },
        3: { label: 'Balanced', desc: 'Mix of new discoveries with some familiar' },
        4: { label: 'Familiar Mix', desc: 'Lean into your taste with some new finds' },
        5: { label: 'Comfort Zone', desc: 'Artists you already love and similar ones' }
    };

    // Position thumb along the dome arc based on value (1-5)
    function updateArc(value, updateSlider = true) {
        const level = discoveryLevels[value];
        const percent = (value - 1) / 4; // 0 to 1

        // Calculate position on semicircle dome arc
        // Arc goes from left (0) to right (1), with the curve at TOP (dome shape)
        const angle = Math.PI * (1 - percent); // PI to 0 (left to right)
        const trackRect = track.getBoundingClientRect();
        const radius = trackRect.width / 2;
        const centerX = radius;
        const centerY = 0; // Top of track for dome

        const x = centerX + radius * Math.cos(angle);
        const y = Math.abs(radius * Math.sin(angle)); // Distance from top

        // Position the thumb (using top for dome shape)
        thumb.style.left = `${x}px`;
        thumb.style.top = `${y}px`;

        // Update labels
        if (label) label.textContent = level.label;
        if (description) description.textContent = level.desc;

        // Update slider input (sync both controls)
        if (updateSlider) {
            slider.value = value;
        }

        // Update arc data attribute for CSS
        arc.setAttribute('data-level', value);

        // Update fill gradient
        if (fill) {
            fill.style.setProperty('--fill-percent', `${percent * 100}%`);
        }

        // Show stars on night side (levels 4 and 5)
        if (stars) {
            if (parseInt(value) >= 4) {
                stars.classList.add('visible');
            } else {
                stars.classList.remove('visible');
            }
        }

        // Update thumb color for night mode
        if (parseInt(value) >= 4) {
            thumb.classList.add('night-mode');
        } else {
            thumb.classList.remove('night-mode');
        }
    }

    // Make thumb draggable along arc
    let isDragging = false;

    function getValueFromPosition(clientX) {
        const trackRect = track.getBoundingClientRect();
        const relativeX = clientX - trackRect.left;
        const percent = Math.max(0, Math.min(1, relativeX / trackRect.width));
        return Math.round(percent * 4) + 1; // 1 to 5
    }

    thumb.addEventListener('mousedown', (e) => {
        isDragging = true;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const value = getValueFromPosition(e.clientX);
        updateArc(value);
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    // Touch support
    thumb.addEventListener('touchstart', (e) => {
        isDragging = true;
        e.preventDefault();
    });

    document.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        const value = getValueFromPosition(touch.clientX);
        updateArc(value);
    });

    document.addEventListener('touchend', () => {
        isDragging = false;
    });

    // Click on track to set position
    track.addEventListener('click', (e) => {
        const value = getValueFromPosition(e.clientX);
        updateArc(value);
    });

    // Sync slider with arc - when slider changes, update arc
    slider.addEventListener('input', (e) => {
        updateArc(parseInt(e.target.value), false);
    });

    // Initialize with current value
    updateArc(parseInt(slider.value));

    // Re-position on window resize
    window.addEventListener('resize', () => {
        updateArc(parseInt(slider.value));
    });
}

// Advanced Options Toggle - NO LONGER NEEDED (using collapsible sections now)
// function removed in favor of initializeCollapsibleSections()

// Form Submission - Redirects to /discover page
function initializeForm() {
    const form = document.getElementById('preferences-form');

    form.addEventListener('submit', function(e) {
        e.preventDefault();

        const timeOfDay = document.getElementById('time-of-day').value;
        const mood = document.getElementById('mood').value;
        const interest = document.getElementById('interest').value;
        const tempo = document.getElementById('tempo').value;

        // At least one context field should be filled
        if (!timeOfDay && !mood.trim() && !interest.trim()) {
            alert('Please fill in at least one field (time of day, mood, or interest)');
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

        // Add custom genres from text input
        const customGenresInput = document.getElementById('custom-genres').value.trim();
        if (customGenresInput) {
            const customGenres = customGenresInput.split(',').map(g => g.trim()).filter(g => g.length > 0);
            selectedGenres.push(...customGenres);
        }

        const trendingNow = document.getElementById('trending-now').checked;
        const discoveryLevel = parseInt(document.getElementById('discovery-level').value);

        const requestData = {
            time_of_day: timeOfDay,
            mood: mood,
            interest: interest,
            tempo: parseInt(tempo),
            instruments_yes: instrumentsYes,
            instruments_no: instrumentsNo,
            genres: selectedGenres,
            trending_now: trendingNow,
            discover_new: discoveryLevel <= 2,  // Pure Discovery or Mostly New
            discovery_level: discoveryLevel,
            excluded_artists: []
        };

        // Store preferences in sessionStorage and redirect to discover page
        sessionStorage.setItem('discoverPreferences', JSON.stringify(requestData));
        sessionStorage.removeItem('lastRecommendations');

        // Redirect to discover page
        window.location.href = '/discover';
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

        let cardHTML = '';

        // Add artist image if available
        if (rec.image_url) {
            cardHTML += '<div class="artist-image-container">';
            cardHTML += '<img src="' + rec.image_url + '" alt="' + rec.band_name + '" class="artist-image">';
            cardHTML += '</div>';
        }

        // Wrap content in a container for flexbox layout
        cardHTML += '<div class="recommendation-card-content">';
        cardHTML += '<div class="band-name">' + rec.band_name + '</div>';
        cardHTML += '<div class="genre">' + (rec.genre || 'Various Genres') + '</div>';
        cardHTML += '<div class="description">' + rec.description + '</div>';
        cardHTML += '<div class="match-reason">Why this matches: ' + rec.match_reason + '</div>';

        if (rec.trending_enabled) {
            cardHTML += '<div class="trending-used"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg> Trending Now - Based on ' + rec.trending_count + ' currently popular artists from Reddit</div>';
        }

        if (sourcesUsed) {
            cardHTML += '<div class="sources-used"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg> Sources: ' + sourcesUsed + '</div>';
        }

        cardHTML += '<div class="spotify-link-container">';
        cardHTML += '<a href="' + spotifySearchUrl + '" target="_blank" class="btn-spotify"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18v-6a9 9 0 0 1 18 0v6"></path><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z"></path></svg> Listen on Spotify</a>';
        cardHTML += '<label class="playlist-checkbox-label">';
        cardHTML += '<input type="checkbox" class="playlist-checkbox" data-id="' + rec.id + '" data-band-name="' + rec.band_name + '">';
        cardHTML += '<span>Add to Playlist</span>';
        cardHTML += '</label>';
        if (rec.in_playlist) {
            cardHTML += '<span class="in-playlist-badge"><svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> In Playlist</span>';
        }
        cardHTML += '</div>';

        cardHTML += '<div class="feedback-buttons">';
        cardHTML += '<button class="btn-feedback thumbs-up" data-id="' + rec.id + '" data-type="positive"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 10v12"></path><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z"></path></svg> Love it</button>';
        cardHTML += '<button class="btn-feedback save-later" data-id="' + rec.id + '" data-type="save_later"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z"></path></svg> Save for Later</button>';
        cardHTML += '<button class="btn-feedback skip" data-id="' + rec.id + '" data-type="skipped"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="5 4 15 12 5 20 5 4"></polygon><line x1="19" y1="5" x2="19" y2="19"></line></svg> Skip</button>';
        cardHTML += '<button class="btn-feedback thumbs-down" data-id="' + rec.id + '" data-type="negative"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 14V2"></path><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z"></path></svg> Not for me</button>';
        cardHTML += '</div>';
        cardHTML += '</div>'; // Close recommendation-card-content

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
                    } else if (feedbackType === 'save_later') {
                        this.textContent = '🔖 Saved!';
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

        if (data.success && data.connected) {
            spotifyAuthenticated = true;
            console.log('Spotify connected:', data.spotify_display_name);

            // Update discovery info tooltip
            updateDiscoveryInfoStatus(true, data.spotify_display_name, data.taste_synced);
        } else {
            spotifyAuthenticated = false;
            updateDiscoveryInfoStatus(false);
        }
    } catch (error) {
        console.error('Error checking Spotify auth:', error);
        spotifyAuthenticated = false;
        updateDiscoveryInfoStatus(false);
    } finally {
        spotifyAuthChecked = true;

        // Check if we need to show modal after OAuth redirect
        checkPendingPlaylistModal();
    }
}

// Show playlist modal if we just returned from OAuth with pending selections
function checkPendingPlaylistModal() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('spotify') === 'connected' && selectedForPlaylist.size > 0 && spotifyAuthenticated) {
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        const selectedBands = Array.from(selectedForPlaylist).map(item => JSON.parse(item));
        if (selectedBands.length > 0) {
            showPlaylistModal(selectedBands);
        }
    }
}

// Update the discovery info tooltip with Spotify status
function updateDiscoveryInfoStatus(connected, displayName = null, tasteSynced = false) {
    const statusEl = document.getElementById('discovery-info-spotify-status');
    if (!statusEl) return;

    if (connected) {
        statusEl.className = 'discovery-info-status connected';
        if (tasteSynced) {
            statusEl.innerHTML = `<strong>✓ Spotify connected</strong> as ${displayName}<br><small>Taste data synced</small>`;
        } else {
            statusEl.innerHTML = `<strong>✓ Spotify connected</strong> as ${displayName}<br><small>Sync taste data in <a href="/profile" style="color: inherit; text-decoration: underline;">Settings</a> for better recommendations</small>`;
        }
    } else {
        statusEl.className = 'discovery-info-status disconnected';
        statusEl.innerHTML = `<strong>Spotify not connected</strong><br><small><a href="/profile" style="color: inherit; text-decoration: underline;">Connect Spotify</a> for personalized discovery</small>`;
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

                // Modal showing is now handled in checkSpotifyAuth() after auth check completes
                // This prevents race condition where modal tries to show before auth is verified
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

        // Pass the current page so OAuth can redirect back here
        const response = await fetch('/api/spotify/login?return_page=/');
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
