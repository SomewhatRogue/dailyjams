// ===========================================
// DISCOVER PAGE - Swipe Discovery UI
// ===========================================

// State management
let currentBatch = [];
let currentCardIndex = 0;
let sessionExcluded = new Set();
let swipePlaylistCandidates = [];
let lastRequestData = null;
let spotifyAuthenticated = false;
let spotifyAuthChecked = false;  // Track if auth check is complete

// Swipe gesture state
let isDragging = false;
let startX = 0;
let startY = 0;
let currentX = 0;
let currentY = 0;

// Thresholds
const SWIPE_THRESHOLD_X = 100;
const SWIPE_THRESHOLD_Y = 80;

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadCurrentUser();
    initializeLockButton();
    checkSpotifyAuth();
    initializeSwipeUI();
    loadPreferencesAndStart();
});

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

// Check Spotify authentication status
async function checkSpotifyAuth() {
    try {
        const response = await fetch('/api/spotify/status');
        const data = await response.json();

        if (data.success && data.connected) {
            spotifyAuthenticated = true;
            console.log('Spotify connected:', data.spotify_display_name || 'Unknown');
            updateHeaderSpotifyStatus(true, data.spotify_display_name, data.taste_synced);
        } else {
            spotifyAuthenticated = false;
            updateHeaderSpotifyStatus(false);
        }
    } catch (error) {
        console.error('Error checking Spotify auth:', error);
        spotifyAuthenticated = false;
        updateHeaderSpotifyStatus(false);
    } finally {
        spotifyAuthChecked = true;

        // Check if we need to show modal after OAuth redirect
        checkPendingPlaylistModal();
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
        actionBtn.onclick = handleSpotifyResync;
    } else {
        indicator.className = 'spotify-status-indicator disconnected';
        statusText.textContent = 'Not connected';
        actionBtn.textContent = 'Connect';
        actionBtn.className = 'spotify-action-btn connect';
        actionBtn.style.display = 'inline-block';
        actionBtn.onclick = handleSpotifyConnect;
    }
}

// Handle Spotify re-sync button click
async function handleSpotifyResync() {
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

// Handle Spotify connect button click
async function handleSpotifyConnect() {
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

// Show playlist modal if we just returned from OAuth with pending candidates
function checkPendingPlaylistModal() {
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('spotify') === 'connected' && swipePlaylistCandidates.length > 0 && spotifyAuthenticated) {
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
        showPlaylistModal(swipePlaylistCandidates);
    }
}

// Load preferences from sessionStorage and start discovery
async function loadPreferencesAndStart() {
    const storedPreferences = sessionStorage.getItem('discoverPreferences');

    if (!storedPreferences) {
        // No preferences - show message
        document.getElementById('no-preferences').classList.remove('hidden');
        return;
    }

    try {
        const preferences = JSON.parse(storedPreferences);
        lastRequestData = preferences;

        // Show loading
        document.getElementById('loading').classList.remove('hidden');

        // Call API
        const response = await fetch('/api/recommend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(preferences)
        });

        const data = await response.json();

        if (data.success) {
            displaySwipeBatch(data.recommendations);
        } else {
            alert('Error getting recommendations: ' + data.error);
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('no-preferences').classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error loading preferences:', error);
        alert('Error: ' + error.message);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('no-preferences').classList.remove('hidden');
    }
}

// Initialize swipe UI controls
function initializeSwipeUI() {
    // Keyboard controls
    document.addEventListener('keydown', handleKeyboardSwipe);

    // End card buttons
    const generateMoreBtn = document.getElementById('btn-generate-more');
    const buildPlaylistBtn = document.getElementById('btn-build-playlist');

    if (generateMoreBtn) {
        generateMoreBtn.addEventListener('click', generateMoreRecommendations);
    }
    if (buildPlaylistBtn) {
        buildPlaylistBtn.addEventListener('click', buildPlaylistFromSwipe);
    }

    // Quick playlist button (appears after first swipe right)
    const quickPlaylistBtn = document.getElementById('quick-playlist-btn');
    if (quickPlaylistBtn) {
        quickPlaylistBtn.addEventListener('click', buildPlaylistFromSwipe);
    }

    // Submenu buttons
    const submenuBtns = document.querySelectorAll('.submenu-btn');
    submenuBtns.forEach(btn => {
        btn.addEventListener('click', handleSubmenuFeedback);
    });

    const submenuCancel = document.querySelector('.submenu-cancel');
    if (submenuCancel) {
        submenuCancel.addEventListener('click', hideSubmenu);
    }

    // Hint buttons as clickable actions
    const btnSwipeLeft = document.getElementById('btn-swipe-left');
    const btnSwipeRight = document.getElementById('btn-swipe-right');
    const btnSwipeDown = document.getElementById('btn-swipe-down');

    if (btnSwipeLeft) {
        btnSwipeLeft.addEventListener('click', () => {
            if (document.querySelector('.swipe-card')) {
                swipeLeft();
            }
        });
    }
    if (btnSwipeRight) {
        btnSwipeRight.addEventListener('click', () => {
            if (document.querySelector('.swipe-card')) {
                swipeRight();
            }
        });
    }
    if (btnSwipeDown) {
        btnSwipeDown.addEventListener('click', () => {
            if (document.querySelector('.swipe-card')) {
                showSubmenu();
            }
        });
    }
}

// Display recommendations in swipe mode
function displaySwipeBatch(recommendations) {
    document.getElementById('loading').classList.add('hidden');
    currentBatch = recommendations;
    currentCardIndex = 0;

    // Show swipe container
    document.getElementById('swipe-discovery').classList.remove('hidden');
    document.getElementById('swipe-end-card').classList.add('hidden');

    // Add all to session excluded
    recommendations.forEach(rec => {
        sessionExcluded.add(rec.band_name);
    });

    renderSwipeCards();
    updateSwipeCounter();
}

// Render swipe cards - only show current card
function renderSwipeCards() {
    const container = document.getElementById('swipe-cards');
    container.innerHTML = '';

    if (currentCardIndex < currentBatch.length) {
        const rec = currentBatch[currentCardIndex];
        const card = createSwipeCard(rec, currentCardIndex);
        container.appendChild(card);
        attachSwipeListeners();
    }
}

// Create a swipe card element
function createSwipeCard(rec, index) {
    const card = document.createElement('div');
    card.className = 'swipe-card';
    card.dataset.index = index;
    card.dataset.id = rec.id;
    card.dataset.name = rec.band_name;

    let imageHTML = '';
    if (rec.image_url) {
        imageHTML = `<img src="${rec.image_url}" alt="${rec.band_name}" class="swipe-card-image">`;
    } else {
        imageHTML = `
            <div class="swipe-card-image-placeholder">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M9 18V5l12-2v13"/>
                    <circle cx="6" cy="18" r="3"/>
                    <circle cx="18" cy="16" r="3"/>
                </svg>
            </div>`;
    }

    card.innerHTML = `
        ${imageHTML}
        <div class="swipe-card-name">${rec.band_name}</div>
        <div class="swipe-card-genre">${rec.genre || 'Various Genres'}</div>
        <div class="swipe-card-description">${rec.description || ''}</div>
        ${rec.match_reason ? `<div class="swipe-card-match">${rec.match_reason}</div>` : ''}
    `;

    return card;
}

// Attach swipe listeners to the current card
function attachSwipeListeners() {
    const card = document.querySelector('.swipe-card');
    if (!card) return;

    // Touch events
    card.addEventListener('touchstart', handleTouchStart, { passive: true });
    card.addEventListener('touchmove', handleTouchMove, { passive: false });
    card.addEventListener('touchend', handleTouchEnd);

    // Mouse events
    card.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
}

// Touch handlers
function handleTouchStart(e) {
    isDragging = true;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
}

function handleTouchMove(e) {
    if (!isDragging) return;
    e.preventDefault();

    currentX = e.touches[0].clientX - startX;
    currentY = e.touches[0].clientY - startY;

    updateCardPosition();
}

function handleTouchEnd() {
    if (!isDragging) return;
    isDragging = false;
    handleSwipeEnd();
}

// Mouse handlers
function handleMouseDown(e) {
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    e.target.closest('.swipe-card').style.cursor = 'grabbing';
}

function handleMouseMove(e) {
    if (!isDragging) return;

    currentX = e.clientX - startX;
    currentY = e.clientY - startY;

    updateCardPosition();
}

function handleMouseUp() {
    if (!isDragging) return;
    isDragging = false;

    const topCard = document.querySelector('.swipe-card');
    if (topCard) {
        topCard.style.cursor = 'grab';
    }

    handleSwipeEnd();
}

// Update card position during drag
function updateCardPosition() {
    const topCard = document.querySelector('.swipe-card');
    if (!topCard) return;

    const rotation = currentX * 0.05;
    topCard.style.transform = `translate(${currentX}px, ${currentY}px) rotate(${rotation}deg)`;

    // Update visual indicators
    topCard.classList.remove('swiping-right', 'swiping-left', 'swiping-down');

    if (Math.abs(currentX) > Math.abs(currentY)) {
        if (currentX > SWIPE_THRESHOLD_X / 2) {
            topCard.classList.add('swiping-right');
        } else if (currentX < -SWIPE_THRESHOLD_X / 2) {
            topCard.classList.add('swiping-left');
        }
    } else if (currentY > SWIPE_THRESHOLD_Y / 2) {
        topCard.classList.add('swiping-down');
    }
}

// Handle swipe end - determine action
function handleSwipeEnd() {
    const topCard = document.querySelector('.swipe-card');
    if (!topCard) return;

    topCard.classList.remove('swiping-right', 'swiping-left', 'swiping-down');

    const isHorizontal = Math.abs(currentX) > Math.abs(currentY);

    if (isHorizontal && currentX > SWIPE_THRESHOLD_X) {
        swipeRight();
    } else if (isHorizontal && currentX < -SWIPE_THRESHOLD_X) {
        swipeLeft();
    } else if (!isHorizontal && currentY > SWIPE_THRESHOLD_Y) {
        showSubmenu();
        resetCardPosition();
    } else if (!isHorizontal && currentY < -SWIPE_THRESHOLD_Y) {
        triggerConfetti();
        resetCardPosition();
    } else {
        resetCardPosition();
    }

    currentX = 0;
    currentY = 0;
}

// Reset card to original position
function resetCardPosition() {
    const topCard = document.querySelector('.swipe-card');
    if (!topCard) return;

    topCard.style.transition = 'transform 0.3s ease';
    topCard.style.transform = '';

    setTimeout(() => {
        topCard.style.transition = '';
    }, 300);
}

// Keyboard handler
function handleKeyboardSwipe(e) {
    const swipeContainer = document.getElementById('swipe-discovery');
    if (!swipeContainer || swipeContainer.classList.contains('hidden')) return;

    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

    switch(e.key) {
        case 'ArrowRight':
            e.preventDefault();
            swipeRight();
            break;
        case 'ArrowLeft':
            e.preventDefault();
            swipeLeft();
            break;
        case 'ArrowDown':
            e.preventDefault();
            showSubmenu();
            break;
        case 'ArrowUp':
            e.preventDefault();
            triggerConfetti();
            break;
    }
}

// Swipe actions
function swipeRight() {
    const topCard = document.querySelector('.swipe-card');
    if (!topCard) return;

    const id = topCard.dataset.id;
    const name = topCard.dataset.name;

    // Add to playlist candidates
    swipePlaylistCandidates.push({ id, name });
    updateAddedCount();

    // Animate exit
    topCard.classList.add('swipe-exit-right');

    setTimeout(() => {
        advanceCard();
    }, 400);
}

function swipeLeft() {
    const topCard = document.querySelector('.swipe-card');
    if (!topCard) return;

    topCard.classList.add('swipe-exit-left');

    setTimeout(() => {
        advanceCard();
    }, 400);
}

// Advance to next card
function advanceCard() {
    currentCardIndex++;

    if (currentCardIndex >= currentBatch.length) {
        showEndCard();
    } else {
        renderSwipeCards();
        updateSwipeCounter();
    }
}

// Update swipe counter display
function updateSwipeCounter() {
    const counter = document.getElementById('swipe-counter');
    if (counter) {
        counter.textContent = `${currentCardIndex + 1} / ${currentBatch.length}`;
    }
    updateAddedCount();
}

// Update the "added to playlist" count display and quick playlist button
function updateAddedCount() {
    const addedEl = document.getElementById('swipe-added');
    const quickBtn = document.getElementById('quick-playlist-btn');
    const quickHint = document.getElementById('quick-playlist-hint');
    const count = swipePlaylistCandidates.length;

    if (addedEl) {
        if (count > 0) {
            addedEl.textContent = `${count} added`;
            addedEl.classList.add('visible');
        } else {
            addedEl.textContent = '';
            addedEl.classList.remove('visible');
        }
    }

    // Show/hide quick playlist button
    if (quickBtn) {
        if (count > 0) {
            quickBtn.classList.add('visible');
            // Show hint if less than 3 artists
            if (quickHint) {
                if (count < 3) {
                    quickHint.textContent = `(${3 - count} more recommended)`;
                } else {
                    quickHint.textContent = '';
                }
            }
        } else {
            quickBtn.classList.remove('visible');
        }
    }
}

// Show end card
function showEndCard() {
    document.getElementById('swipe-cards').innerHTML = '';
    document.getElementById('swipe-end-card').classList.remove('hidden');

    const summary = document.getElementById('end-card-summary');
    const count = swipePlaylistCandidates.length;
    summary.textContent = `You've added ${count} artist${count !== 1 ? 's' : ''} to your playlist`;

    const buildBtn = document.getElementById('btn-build-playlist');
    buildBtn.disabled = count === 0;
}

// Submenu functions
function showSubmenu() {
    document.getElementById('swipe-submenu').classList.remove('hidden');
}

function hideSubmenu() {
    document.getElementById('swipe-submenu').classList.add('hidden');
}

async function handleSubmenuFeedback(e) {
    const feedbackType = e.currentTarget.dataset.feedback;
    const topCard = document.querySelector('.swipe-card');

    if (!topCard) {
        hideSubmenu();
        return;
    }

    const suggestionId = topCard.dataset.id;

    try {
        await fetch('/api/feedback', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                suggestion_id: suggestionId,
                feedback_type: feedbackType
            })
        });
    } catch (error) {
        console.error('Error saving feedback:', error);
    }

    hideSubmenu();

    topCard.classList.add('swipe-exit-down');

    setTimeout(() => {
        advanceCard();
    }, 400);
}

// Generate more recommendations
async function generateMoreRecommendations() {
    if (!lastRequestData) return;

    // Update excluded artists
    lastRequestData.excluded_artists = Array.from(sessionExcluded);

    const generateBtn = document.getElementById('btn-generate-more');
    const originalContent = generateBtn.innerHTML;
    generateBtn.disabled = true;
    generateBtn.innerHTML = `
        <svg class="spin" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
        Loading...
    `;

    try {
        const response = await fetch('/api/recommend', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(lastRequestData)
        });

        const data = await response.json();

        if (data.success) {
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalContent;
            document.getElementById('swipe-end-card').classList.add('hidden');
            displaySwipeBatch(data.recommendations);
        } else {
            alert('Error getting recommendations: ' + data.error);
            generateBtn.disabled = false;
            generateBtn.innerHTML = originalContent;
        }
    } catch (error) {
        alert('Error: ' + error.message);
        generateBtn.disabled = false;
        generateBtn.innerHTML = originalContent;
    }
}

// Build playlist from swipe candidates
function buildPlaylistFromSwipe() {
    if (swipePlaylistCandidates.length === 0) {
        alert('No artists selected. Swipe right on artists you want to add.');
        return;
    }

    showPlaylistModal(swipePlaylistCandidates);
}

// Confetti easter egg
function triggerConfetti() {
    const container = document.getElementById('confetti-container');
    const colors = ['#fbbf24', '#fde047', '#60a5fa', '#3b82f6', '#fef3c7'];

    for (let i = 0; i < 30; i++) {
        const particle = document.createElement('div');
        particle.className = 'confetti-particle';
        particle.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        particle.style.left = Math.random() * 100 + '%';
        particle.style.top = '-10px';
        particle.style.animationDelay = Math.random() * 0.5 + 's';
        particle.style.animationDuration = (1.5 + Math.random()) + 's';

        container.appendChild(particle);

        setTimeout(() => {
            particle.remove();
        }, 2500);
    }
}

// ===========================================
// PLAYLIST MODAL (copied from main.js)
// ===========================================

// Initiate Spotify Authentication
async function initiateSpotifyAuth() {
    try {
        const response = await fetch('/api/spotify/login?return_page=/discover');
        const data = await response.json();

        if (data.success) {
            // Store playlist candidates before redirect
            sessionStorage.setItem('pendingPlaylistCandidates', JSON.stringify(swipePlaylistCandidates));
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
    // Check if authenticated
    if (!spotifyAuthenticated) {
        const doAuth = confirm('You need to connect to Spotify first. Would you like to connect now?');
        if (doAuth) {
            await initiateSpotifyAuth();
        }
        return;
    }

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

    modalHTML += '<div id="artist-warning" class="warning-banner hidden"></div>';
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

// Load tracks for selected bands (with bug fix for missing artists)
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
            // BUG FIX: Check which artists were not found
            const foundArtists = Object.keys(data.artists);
            const requestedArtists = selectedBands.map(b => b.name);
            const notFound = requestedArtists.filter(name => !foundArtists.includes(name));

            if (notFound.length > 0) {
                const warningEl = document.getElementById('artist-warning');
                warningEl.innerHTML = `<strong>Some artists couldn't be found on Spotify:</strong> ${notFound.join(', ')}`;
                warningEl.classList.remove('hidden');
            }

            displayTracksInModal(data.artists, selectedBands);
        } else {
            alert('Error loading tracks: ' + data.error);
        }
    } catch (error) {
        alert('Error: ' + error.message);
    }
}

// Display tracks in modal with song count selectors
function displayTracksInModal(artistsData, selectedBands) {
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

        // Find the matching band to store suggestion_id
        const matchingBand = selectedBands.find(b => b.name === artistName);
        if (matchingBand) {
            artistDiv.dataset.suggestionId = matchingBand.id;
        }

        tracksList.appendChild(artistDiv);
    }

    // Initialize track count selectors
    const selectors = document.querySelectorAll('.track-count-selector');
    selectors.forEach(selector => {
        selector.addEventListener('change', function() {
            updateVisibleTracks(this);
        });
    });

    // Enable create button if we have at least one artist
    const hasArtists = tracksList.children.length > 0;
    document.querySelector('.btn-create-playlist-final').disabled = !hasArtists;
}

// Update visible tracks based on selector
function updateVisibleTracks(selector) {
    const artistSection = selector.closest('.playlist-artist-section');
    const count = parseInt(selector.value);
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
                selectedTracks[artistName] = {
                    track_uris: trackUris,
                    suggestion_id: section.dataset.suggestionId || null,
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

            // Clear swipe playlist candidates
            swipePlaylistCandidates = [];
            updateAddedCount();

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

// Restore pending playlist candidates after OAuth redirect
document.addEventListener('DOMContentLoaded', function() {
    const pendingCandidates = sessionStorage.getItem('pendingPlaylistCandidates');
    if (pendingCandidates) {
        try {
            swipePlaylistCandidates = JSON.parse(pendingCandidates);
            sessionStorage.removeItem('pendingPlaylistCandidates');
            updateAddedCount();

            // Modal showing is now handled in checkSpotifyAuth() after auth check completes
            // This prevents race condition where modal tries to show before auth is verified
        } catch (error) {
            console.error('Error restoring playlist candidates:', error);
            sessionStorage.removeItem('pendingPlaylistCandidates');
        }
    }
});
