import sqlite3
import os
from datetime import datetime

# Database file path
DB_PATH = os.path.join(os.path.dirname(__file__), '../data/dailyjams.db')

def get_db_connection():
    """Create a database connection to the SQLite database."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # This allows us to access columns by name
    return conn

def initialize_database():
    """Create all necessary tables if they don't exist."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Table 1: Music Suggestions
    # Stores each band/artist suggestion from ChatGPT
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS music_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            band_name TEXT NOT NULL,
            genre TEXT,
            description TEXT,
            match_reason TEXT,
            sources_used TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    # Table 2: User Preferences
    # Stores the preferences used for each suggestion request
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            suggestion_id INTEGER,
            time_of_day TEXT,
            mood TEXT,
            tempo INTEGER,
            instruments_yes TEXT,
            instruments_no TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (suggestion_id) REFERENCES music_suggestions (id)
        )
    ''')
    
    # Table 3: User Feedback
    # Stores thumbs up/down feedback on suggestions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            suggestion_id INTEGER NOT NULL,
            feedback_type TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (suggestion_id) REFERENCES music_suggestions (id)
        )
    ''')
    
    # Table 4: Source Preferences
    # Stores which sources are enabled/disabled
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS source_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            source_name TEXT NOT NULL UNIQUE,
            source_url TEXT,
            is_enabled INTEGER DEFAULT 1,
            description TEXT
        )
    ''')
    
    conn.commit()
    conn.close()
    print("✅ Database initialized successfully!")

def insert_default_sources():
    """Insert default music discovery sources."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    default_sources = [
        ('Reddit - r/ifyoulikeblank', 'https://www.reddit.com/r/ifyoulikeblank/', 1, 'Music recommendations based on similar artists'),
        ('Reddit - r/Music', 'https://www.reddit.com/r/Music/', 1, 'General music discussions and discoveries'),
        ('RateYourMusic', 'https://rateyourmusic.com/', 1, 'Comprehensive music database and ratings'),
        ('AllMusic', 'https://www.allmusic.com/', 1, 'Professional music reviews and artist info'),
        ('Pitchfork', 'https://pitchfork.com/', 1, 'Music reviews and features'),
    ]
    
    for source in default_sources:
        try:
            cursor.execute('''
                INSERT OR IGNORE INTO source_preferences (source_name, source_url, is_enabled, description)
                VALUES (?, ?, ?, ?)
            ''', source)
        except sqlite3.IntegrityError:
            pass  # Source already exists
    
    conn.commit()
    conn.close()
    print("✅ Default sources added!")

# CRUD Functions for Music Suggestions

def save_suggestion(band_name, genre=None, description=None, match_reason=None, sources_used=None):
    """Save a music suggestion to the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Convert sources list to comma-separated string
    sources_str = ','.join(sources_used) if sources_used else ''
    
    cursor.execute('''
        INSERT INTO music_suggestions (band_name, genre, description, match_reason, sources_used)
        VALUES (?, ?, ?, ?, ?)
    ''', (band_name, genre, description, match_reason, sources_str))
    
    suggestion_id = cursor.lastrowid
    conn.commit()
    conn.close()
    
    return suggestion_id

def save_user_preferences(suggestion_id, time_of_day, mood, tempo, instruments_yes, instruments_no):
    """Save the user preferences that generated a suggestion."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Convert lists to comma-separated strings
    instruments_yes_str = ','.join(instruments_yes) if instruments_yes else ''
    instruments_no_str = ','.join(instruments_no) if instruments_no else ''
    
    cursor.execute('''
        INSERT INTO user_preferences (suggestion_id, time_of_day, mood, tempo, instruments_yes, instruments_no)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (suggestion_id, time_of_day, mood, tempo, instruments_yes_str, instruments_no_str))
    
    conn.commit()
    conn.close()

def save_feedback(suggestion_id, feedback_type):
    """Save or update user feedback (positive/negative/skipped) for a suggestion."""
    print(f"🔍 DEBUG save_feedback: suggestion_id={suggestion_id}, feedback_type={feedback_type}")
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if feedback already exists for this suggestion
    cursor.execute('''
        SELECT id FROM user_feedback
        WHERE suggestion_id = ?
    ''', (suggestion_id,))
    
    existing = cursor.fetchone()
    
    if existing:
        # Update existing feedback
        cursor.execute('''
            UPDATE user_feedback
            SET feedback_type = ?, created_at = CURRENT_TIMESTAMP
            WHERE suggestion_id = ?
        ''', (feedback_type, suggestion_id))
        print(f"🔍 DEBUG: Updated existing feedback")
    else:
        # Insert new feedback
        cursor.execute('''
            INSERT INTO user_feedback (suggestion_id, feedback_type)
            VALUES (?, ?)
        ''', (suggestion_id, feedback_type))
        print(f"🔍 DEBUG: Inserted new feedback")
    
    print(f"🔍 DEBUG: Rows affected: {cursor.rowcount}")
    
    conn.commit()
    conn.close()
    
    print(f"🔍 DEBUG: Feedback saved successfully!")
def get_enabled_sources():
    """Get all enabled music discovery sources."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT source_name, source_url, description
        FROM source_preferences
        WHERE is_enabled = 1
    ''')
    
    sources = cursor.fetchall()
    conn.close()
    
    return [dict(source) for source in sources]

def get_all_sources():
    """Get all music sources (enabled and disabled)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT id, source_name, source_url, is_enabled, description
        FROM source_preferences
        ORDER BY source_name
    ''')
    
    sources = cursor.fetchall()
    conn.close()
    
    return [dict(source) for source in sources]

def update_source_preference(source_id, is_enabled):
    """Enable or disable a music source."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        UPDATE source_preferences
        SET is_enabled = ?
        WHERE id = ?
    ''', (is_enabled, source_id))
    
    conn.commit()
    conn.close()

def get_user_feedback_history():
    """Get all feedback with associated preferences for learning."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            ms.band_name,
            up.mood,
            up.tempo,
            up.instruments_yes,
            up.instruments_no,
            uf.feedback_type,
            uf.created_at
        FROM user_feedback uf
        JOIN music_suggestions ms ON uf.suggestion_id = ms.id
        JOIN user_preferences up ON ms.id = up.suggestion_id
        ORDER BY uf.created_at DESC
    ''')
    
    history = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in history]

def get_recently_skipped_bands(days=5):
    """Get bands that were skipped in the last X days."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT ms.band_name
        FROM user_feedback uf
        JOIN music_suggestions ms ON uf.suggestion_id = ms.id
        WHERE uf.feedback_type = 'skipped'
        AND uf.created_at >= datetime('now', '-' || ? || ' days')
    ''', (days,))
    
    skipped = cursor.fetchall()
    conn.close()
    
    return [row['band_name'] for row in skipped]

def get_excluded_bands():
    """Get all bands to exclude from recommendations (recently skipped)."""
    return get_recently_skipped_bands(days=5)

def get_full_feedback_history():
    """Get complete feedback history with all details for the history page."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT 
            ms.id,
            ms.band_name,
            ms.genre,
            ms.description,
            ms.match_reason,
            ms.sources_used,
            up.time_of_day,
            up.mood,
            up.tempo,
            up.instruments_yes,
            up.instruments_no,
            uf.feedback_type,
            uf.created_at
        FROM user_feedback uf
        JOIN music_suggestions ms ON uf.suggestion_id = ms.id
        LEFT JOIN user_preferences up ON ms.id = up.suggestion_id
        ORDER BY uf.created_at DESC
    ''')
    
    history = cursor.fetchall()
    conn.close()
    
    return [dict(row) for row in history]

def add_new_source(source_name, source_url, description, is_enabled=1):
    """Add a new custom music source."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute('''
            INSERT INTO source_preferences (source_name, source_url, is_enabled, description)
            VALUES (?, ?, ?, ?)
        ''', (source_name, source_url, is_enabled, description))
        
        source_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return source_id
    except sqlite3.IntegrityError:
        conn.close()
        return None  # Source name already exists

def delete_source(source_id):
    """Delete a custom music source."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        DELETE FROM source_preferences
        WHERE id = ?
    ''', (source_id,))
    
    conn.commit()
    conn.close()

def get_all_rated_bands():
    """Get all bands that the user has rated (positive, negative, or skipped)."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        SELECT DISTINCT ms.band_name
        FROM user_feedback uf
        JOIN music_suggestions ms ON uf.suggestion_id = ms.id
    ''')
    
    rated = cursor.fetchall()
    conn.close()
    
    return [row['band_name'] for row in rated]

# Test function
if __name__ == '__main__':
    print("Initializing database...")
    initialize_database()
    insert_default_sources()
    print("\n✅ Database setup complete!")
    print(f"Database location: {DB_PATH}")
