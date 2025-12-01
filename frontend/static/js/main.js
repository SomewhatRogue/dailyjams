// State management
let selectedTime = '';
let instrumentPreferences = {};

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeTimeButtons();
    initializeInstrumentToggles();
    initializeTempoSlider();
    initializeAdvancedToggle();
    initializeForm();
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
        
        const requestData = {
            time_of_day: timeOfDay,
            mood: mood,
            tempo: parseInt(tempo),
            instruments_yes: instrumentsYes,
            instruments_no: instrumentsNo,
            genres: selectedGenres,
            trending_now: trendingNow
        };
        
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
            
            allButtons.forEach(btn => {
                btn.disabled = true;
                btn.classList.add('selected');
            });
            
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
                    if (feedbackType === 'positive') {
                        this.textContent = '👍 Thanks!';
                    } else if (feedbackType === 'negative') {
                        this.textContent = '👎 Noted!';
                    } else if (feedbackType === 'skipped') {
                        this.textContent = '⏭️ Skipped';
                    }
                } else {
                    alert('Error saving feedback: ' + data.error);
                    allButtons.forEach(btn => {
                        btn.disabled = false;
                        btn.classList.remove('selected');
                    });
                }
            } catch (error) {
                alert('Error: ' + error.message);
                allButtons.forEach(btn => {
                    btn.disabled = false;
                    btn.classList.remove('selected');
                });
            }
        });
    });
}
