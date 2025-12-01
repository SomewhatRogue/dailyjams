// State
let allHistory = [];
let currentFilter = 'all';
let searchTerm = '';

// Initialize when page loads
document.addEventListener('DOMContentLoaded', function() {
    loadHistory();
    initializeFilters();
    initializeSearch();
});

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
    const skipped = allHistory.filter(h => h.feedback_type === 'skipped').length;
    const disliked = allHistory.filter(h => h.feedback_type === 'negative').length;
    
    document.getElementById('total-count').textContent = total;
    document.getElementById('loved-count').textContent = loved;
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
    
    // Badge text
    const badgeText = {
        'positive': '👍 Loved',
        'negative': '👎 Not For Me',
        'skipped': '⏭️ Skipped'
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
            <div class="pref-item">⏰ Time: ${item.time_of_day || 'N/A'}</div>
            <div class="pref-item">😊 Mood: ${item.mood || 'N/A'}</div>
            <div class="pref-item">🎵 Tempo: ${item.tempo || 'N/A'}/5</div>
            ${instrumentsYes !== 'None' ? `<div class="pref-item">✓ Instruments: ${instrumentsYes}</div>` : ''}
            ${instrumentsNo !== 'None' ? `<div class="pref-item">✗ Avoid: ${instrumentsNo}</div>` : ''}
        </div>
    `;
    
    return card;
}
