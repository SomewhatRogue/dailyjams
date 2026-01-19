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

    # Table 0: Users (profiles for separating history)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL UNIQUE,
            avatar_color TEXT DEFAULT '#2980b9',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

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

    # Table 5: User Playlists
    # Stores playlists created in Spotify
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_playlists (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_name TEXT NOT NULL,
            spotify_playlist_id TEXT,
            spotify_url TEXT,
            band_count INTEGER DEFAULT 0,
            track_count INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    ''')

    # Table 6: Playlist Suggestions
    # Junction table linking playlists to music suggestions
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS playlist_suggestions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            playlist_id INTEGER NOT NULL,
            suggestion_id INTEGER NOT NULL,
            track_count INTEGER DEFAULT 3,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (playlist_id) REFERENCES user_playlists (id),
            FOREIGN KEY (suggestion_id) REFERENCES music_suggestions (id)
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

def migrate_add_spotify_support():
    """Migration: Add Spotify auth columns to users table and create taste_data table."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if migration is needed
    cursor.execute("PRAGMA table_info(users)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'spotify_user_id' not in columns:
        print("🔄 Running Spotify support migration...")

        # Add Spotify auth columns to users table
        cursor.execute('ALTER TABLE users ADD COLUMN spotify_user_id TEXT')
        cursor.execute('ALTER TABLE users ADD COLUMN spotify_display_name TEXT')
        cursor.execute('ALTER TABLE users ADD COLUMN spotify_access_token TEXT')
        cursor.execute('ALTER TABLE users ADD COLUMN spotify_refresh_token TEXT')
        cursor.execute('ALTER TABLE users ADD COLUMN spotify_token_expires_at INTEGER')
        cursor.execute('ALTER TABLE users ADD COLUMN spotify_connected_at TIMESTAMP')

        print("✅ Added Spotify auth columns to users table")

    # Create taste data table if it doesn't exist
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS spotify_taste_data (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            data_type TEXT NOT NULL,
            time_range TEXT,
            data TEXT NOT NULL,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')

    # Create index for faster lookups
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_taste_data_user
        ON spotify_taste_data (user_id, data_type)
    ''')

    conn.commit()
    conn.close()
    print("✅ Spotify support migration complete!")


def migrate_add_user_source_preferences():
    """Migration: Add per-user source preferences table."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if table already exists
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name='user_source_preferences'")
    if cursor.fetchone():
        conn.close()
        return  # Already migrated

    print("🔄 Running per-user source preferences migration...")

    # Create user_source_preferences table
    # This stores per-user overrides of the global source_preferences
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_source_preferences (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            source_id INTEGER NOT NULL,
            is_enabled INTEGER DEFAULT 1,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (source_id) REFERENCES source_preferences (id),
            UNIQUE(user_id, source_id)
        )
    ''')

    # Create index for faster lookups
    cursor.execute('''
        CREATE INDEX IF NOT EXISTS idx_user_source_prefs
        ON user_source_preferences (user_id)
    ''')

    conn.commit()
    conn.close()
    print("✅ Per-user source preferences migration complete!")

def migrate_add_user_support():
    """Migration: Add user_id columns and create default user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if migration is needed by seeing if user_id column exists
    cursor.execute("PRAGMA table_info(music_suggestions)")
    columns = [col[1] for col in cursor.fetchall()]

    if 'user_id' in columns:
        conn.close()
        return  # Already migrated

    print("🔄 Running user support migration...")

    # Create default user if none exists
    cursor.execute("SELECT id FROM users LIMIT 1")
    if not cursor.fetchone():
        cursor.execute('''
            INSERT INTO users (name, avatar_color) VALUES ('Default', '#2980b9')
        ''')
        print("✅ Created default user")

    # Get default user ID
    cursor.execute("SELECT id FROM users WHERE name = 'Default'")
    row = cursor.fetchone()
    default_user_id = row[0] if row else 1

    # Add user_id to music_suggestions
    cursor.execute('''
        ALTER TABLE music_suggestions ADD COLUMN user_id INTEGER DEFAULT 1
    ''')
    cursor.execute('''
        UPDATE music_suggestions SET user_id = ? WHERE user_id IS NULL OR user_id = 1
    ''', (default_user_id,))

    # Add user_id to user_feedback
    cursor.execute('''
        ALTER TABLE user_feedback ADD COLUMN user_id INTEGER DEFAULT 1
    ''')
    cursor.execute('''
        UPDATE user_feedback SET user_id = ? WHERE user_id IS NULL OR user_id = 1
    ''', (default_user_id,))

    # Add user_id to user_playlists
    cursor.execute('''
        ALTER TABLE user_playlists ADD COLUMN user_id INTEGER DEFAULT 1
    ''')
    cursor.execute('''
        UPDATE user_playlists SET user_id = ? WHERE user_id IS NULL OR user_id = 1
    ''', (default_user_id,))

    conn.commit()
    conn.close()
    print("✅ User support migration complete!")

# User CRUD Functions

def create_user(name, avatar_color='#2980b9'):
    """Create a new user profile."""
    conn = get_db_connection()
    cursor = conn.cursor()

    try:
        cursor.execute('''
            INSERT INTO users (name, avatar_color) VALUES (?, ?)
        ''', (name, avatar_color))
        user_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return user_id
    except sqlite3.IntegrityError:
        conn.close()
        return None  # Name already exists

def get_all_users():
    """Get all user profiles."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, name, avatar_color, created_at FROM users ORDER BY created_at
    ''')

    users = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return users

def get_user_by_id(user_id):
    """Get a specific user by ID."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT id, name, avatar_color, created_at FROM users WHERE id = ?
    ''', (user_id,))

    row = cursor.fetchone()
    conn.close()
    return dict(row) if row else None

def delete_user(user_id):
    """Delete a user and all their data."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if this is the last user
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    if count <= 1:
        conn.close()
        return False  # Can't delete last user

    # Delete user's feedback
    cursor.execute('DELETE FROM user_feedback WHERE user_id = ?', (user_id,))

    # Delete user's playlist links first (junction table)
    cursor.execute('''
        DELETE FROM playlist_suggestions
        WHERE playlist_id IN (SELECT id FROM user_playlists WHERE user_id = ?)
    ''', (user_id,))

    # Delete user's playlists
    cursor.execute('DELETE FROM user_playlists WHERE user_id = ?', (user_id,))

    # Delete user's suggestions
    cursor.execute('DELETE FROM music_suggestions WHERE user_id = ?', (user_id,))

    # Delete the user
    cursor.execute('DELETE FROM users WHERE id = ?', (user_id,))

    conn.commit()
    conn.close()
    return True

def get_user_count():
    """Get total number of users."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT COUNT(*) FROM users")
    count = cursor.fetchone()[0]
    conn.close()
    return count

def ensure_default_user():
    """Ensure at least one user exists, create Default if not."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users LIMIT 1")
    if not cursor.fetchone():
        cursor.execute('''
            INSERT INTO users (name, avatar_color) VALUES ('Default', '#2980b9')
        ''')
        conn.commit()

    conn.close()

# CRUD Functions for Music Suggestions

def save_suggestion(band_name, genre=None, description=None, match_reason=None, sources_used=None, user_id=1):
    """Save a music suggestion to the database."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Convert sources list to comma-separated string
    sources_str = ','.join(sources_used) if sources_used else ''

    cursor.execute('''
        INSERT INTO music_suggestions (band_name, genre, description, match_reason, sources_used, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (band_name, genre, description, match_reason, sources_str, user_id))

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

def save_feedback(suggestion_id, feedback_type, user_id=1):
    """Save or update user feedback (positive/negative/skipped) for a suggestion."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Check if feedback already exists for this suggestion and user
    cursor.execute('''
        SELECT id FROM user_feedback
        WHERE suggestion_id = ? AND user_id = ?
    ''', (suggestion_id, user_id))

    existing = cursor.fetchone()

    if existing:
        # Update existing feedback
        cursor.execute('''
            UPDATE user_feedback
            SET feedback_type = ?, created_at = CURRENT_TIMESTAMP
            WHERE suggestion_id = ? AND user_id = ?
        ''', (feedback_type, suggestion_id, user_id))
    else:
        # Insert new feedback
        cursor.execute('''
            INSERT INTO user_feedback (suggestion_id, feedback_type, user_id)
            VALUES (?, ?, ?)
        ''', (suggestion_id, feedback_type, user_id))

    conn.commit()
    conn.close()
def get_enabled_sources(user_id=1):
    """Get all enabled music discovery sources for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get sources with per-user enabled status
    # If user has a preference, use it; otherwise use global default
    cursor.execute('''
        SELECT sp.source_name, sp.source_url, sp.description
        FROM source_preferences sp
        LEFT JOIN user_source_preferences usp
            ON sp.id = usp.source_id AND usp.user_id = ?
        WHERE COALESCE(usp.is_enabled, sp.is_enabled) = 1
    ''', (user_id,))

    sources = cursor.fetchall()
    conn.close()

    return [dict(source) for source in sources]

def get_all_sources(user_id=1):
    """Get all music sources with per-user enabled/disabled status."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get all sources with per-user enabled status
    # If user has a preference, use it; otherwise use global default
    cursor.execute('''
        SELECT sp.id, sp.source_name, sp.source_url,
               COALESCE(usp.is_enabled, sp.is_enabled) as is_enabled,
               sp.description
        FROM source_preferences sp
        LEFT JOIN user_source_preferences usp
            ON sp.id = usp.source_id AND usp.user_id = ?
        ORDER BY sp.source_name
    ''', (user_id,))

    sources = cursor.fetchall()
    conn.close()

    return [dict(source) for source in sources]

def update_source_preference(source_id, is_enabled, user_id=1):
    """Enable or disable a music source for a specific user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # Insert or update user-specific preference
    cursor.execute('''
        INSERT INTO user_source_preferences (user_id, source_id, is_enabled)
        VALUES (?, ?, ?)
        ON CONFLICT(user_id, source_id)
        DO UPDATE SET is_enabled = excluded.is_enabled
    ''', (user_id, source_id, is_enabled))

    conn.commit()
    conn.close()

def get_user_feedback_history(user_id=1):
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
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC
    ''', (user_id,))

    history = cursor.fetchall()
    conn.close()

    return [dict(row) for row in history]

def get_recently_skipped_bands(user_id=1, days=5):
    """Get bands that were skipped in the last X days for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT DISTINCT ms.band_name
        FROM user_feedback uf
        JOIN music_suggestions ms ON uf.suggestion_id = ms.id
        WHERE uf.feedback_type = 'skipped'
        AND uf.user_id = ?
        AND uf.created_at >= datetime('now', '-' || ? || ' days')
    ''', (user_id, days))

    skipped = cursor.fetchall()
    conn.close()

    return [row['band_name'] for row in skipped]

def get_excluded_bands(user_id=1):
    """Get all bands to exclude from recommendations (recently skipped)."""
    return get_recently_skipped_bands(user_id=user_id, days=5)

def get_full_feedback_history(user_id=1):
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
        WHERE uf.user_id = ?
        ORDER BY uf.created_at DESC
    ''', (user_id,))

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

def get_all_rated_bands(user_id=1):
    """Get all bands that the user has rated (positive, negative, or skipped)."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT DISTINCT ms.band_name
        FROM user_feedback uf
        JOIN music_suggestions ms ON uf.suggestion_id = ms.id
        WHERE uf.user_id = ?
    ''', (user_id,))

    rated = cursor.fetchall()
    conn.close()

    return [row['band_name'] for row in rated]

def get_bands_in_playlists(user_id=1):
    """Get all bands that have been added to playlists for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT DISTINCT ms.id, ms.band_name
        FROM playlist_suggestions ps
        JOIN music_suggestions ms ON ps.suggestion_id = ms.id
        JOIN user_playlists up ON ps.playlist_id = up.id
        WHERE up.user_id = ?
    ''', (user_id,))

    results = cursor.fetchall()
    conn.close()

    return {row['id']: row['band_name'] for row in results}

def save_playlist(playlist_name, spotify_playlist_id, spotify_url, band_count, track_count, user_id=1):
    """
    Save a new playlist to the database.

    Args:
        playlist_name: Name of the playlist
        spotify_playlist_id: Spotify's playlist ID
        spotify_url: URL to the Spotify playlist
        band_count: Number of artists in the playlist
        track_count: Total number of tracks
        user_id: ID of the user who created this playlist

    Returns:
        The ID of the newly created playlist
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO user_playlists (playlist_name, spotify_playlist_id, spotify_url, band_count, track_count, user_id)
        VALUES (?, ?, ?, ?, ?, ?)
    ''', (playlist_name, spotify_playlist_id, spotify_url, band_count, track_count, user_id))

    playlist_id = cursor.lastrowid
    conn.commit()
    conn.close()

    return playlist_id

def link_playlist_to_suggestions(playlist_id, suggestion_ids_with_counts):
    """
    Link a playlist to its music suggestions.

    Args:
        playlist_id: ID of the playlist
        suggestion_ids_with_counts: List of tuples (suggestion_id, track_count)
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    for suggestion_id, track_count in suggestion_ids_with_counts:
        cursor.execute('''
            INSERT INTO playlist_suggestions (playlist_id, suggestion_id, track_count)
            VALUES (?, ?, ?)
        ''', (playlist_id, suggestion_id, track_count))

    conn.commit()
    conn.close()

def get_all_playlists(user_id=1):
    """
    Get all playlists for a user.

    Returns:
        List of playlist dictionaries with details
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT
            id,
            playlist_name,
            spotify_playlist_id,
            spotify_url,
            band_count,
            track_count,
            created_at
        FROM user_playlists
        WHERE user_id = ?
        ORDER BY created_at DESC
    ''', (user_id,))

    playlists = []
    for row in cursor.fetchall():
        playlists.append({
            'id': row['id'],
            'playlist_name': row['playlist_name'],
            'spotify_playlist_id': row['spotify_playlist_id'],
            'spotify_url': row['spotify_url'],
            'band_count': row['band_count'],
            'track_count': row['track_count'],
            'created_at': row['created_at']
        })

    conn.close()
    return playlists

def get_playlist_with_details(playlist_id):
    """
    Get a playlist with all its associated bands.

    Args:
        playlist_id: ID of the playlist

    Returns:
        Dictionary with playlist info and list of bands
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    # Get playlist info
    cursor.execute('''
        SELECT
            id,
            playlist_name,
            spotify_playlist_id,
            spotify_url,
            band_count,
            track_count,
            created_at
        FROM user_playlists
        WHERE id = ?
    ''', (playlist_id,))

    playlist_row = cursor.fetchone()
    if not playlist_row:
        conn.close()
        return None

    playlist = {
        'id': playlist_row['id'],
        'playlist_name': playlist_row['playlist_name'],
        'spotify_playlist_id': playlist_row['spotify_playlist_id'],
        'spotify_url': playlist_row['spotify_url'],
        'band_count': playlist_row['band_count'],
        'track_count': playlist_row['track_count'],
        'created_at': playlist_row['created_at']
    }

    # Get associated bands
    cursor.execute('''
        SELECT
            ms.id,
            ms.band_name,
            ms.genre,
            ps.track_count
        FROM playlist_suggestions ps
        JOIN music_suggestions ms ON ps.suggestion_id = ms.id
        WHERE ps.playlist_id = ?
        ORDER BY ps.created_at
    ''', (playlist_id,))

    bands = []
    for row in cursor.fetchall():
        bands.append({
            'suggestion_id': row['id'],
            'band_name': row['band_name'],
            'genre': row['genre'],
            'track_count': row['track_count']
        })

    playlist['bands'] = bands
    conn.close()
    return playlist

def update_playlist_track_count(playlist_id, additional_tracks):
    """
    Update playlist track count when adding more tracks.

    Args:
        playlist_id: ID of the playlist
        additional_tracks: Number of tracks to add to the count
    """
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE user_playlists
        SET track_count = track_count + ?,
            band_count = (
                SELECT COUNT(DISTINCT suggestion_id)
                FROM playlist_suggestions
                WHERE playlist_id = ?
            )
        WHERE id = ?
    ''', (additional_tracks, playlist_id, playlist_id))

    conn.commit()
    conn.close()

# Spotify Auth CRUD Functions

def save_spotify_auth(user_id, token_info, spotify_user_info):
    """Save Spotify authentication data for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE users SET
            spotify_user_id = ?,
            spotify_display_name = ?,
            spotify_access_token = ?,
            spotify_refresh_token = ?,
            spotify_token_expires_at = ?,
            spotify_connected_at = CURRENT_TIMESTAMP
        WHERE id = ?
    ''', (
        spotify_user_info.get('id'),
        spotify_user_info.get('display_name'),
        token_info.get('access_token'),
        token_info.get('refresh_token'),
        token_info.get('expires_at'),
        user_id
    ))

    conn.commit()
    conn.close()

def get_spotify_auth(user_id):
    """Get Spotify authentication data for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT spotify_user_id, spotify_display_name, spotify_access_token,
               spotify_refresh_token, spotify_token_expires_at, spotify_connected_at
        FROM users WHERE id = ?
    ''', (user_id,))

    row = cursor.fetchone()
    conn.close()

    if row and row['spotify_access_token']:
        return {
            'spotify_user_id': row['spotify_user_id'],
            'spotify_display_name': row['spotify_display_name'],
            'spotify_access_token': row['spotify_access_token'],
            'spotify_refresh_token': row['spotify_refresh_token'],
            'spotify_token_expires_at': row['spotify_token_expires_at'],
            'spotify_connected_at': row['spotify_connected_at']
        }
    return None

def update_spotify_token(user_id, token_info):
    """Update Spotify tokens after refresh."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE users SET
            spotify_access_token = ?,
            spotify_refresh_token = ?,
            spotify_token_expires_at = ?
        WHERE id = ?
    ''', (
        token_info.get('access_token'),
        token_info.get('refresh_token'),
        token_info.get('expires_at'),
        user_id
    ))

    conn.commit()
    conn.close()

def clear_spotify_auth(user_id):
    """Clear Spotify authentication data for a user."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        UPDATE users SET
            spotify_user_id = NULL,
            spotify_display_name = NULL,
            spotify_access_token = NULL,
            spotify_refresh_token = NULL,
            spotify_token_expires_at = NULL,
            spotify_connected_at = NULL
        WHERE id = ?
    ''', (user_id,))

    # Also clear their taste data
    cursor.execute('DELETE FROM spotify_taste_data WHERE user_id = ?', (user_id,))

    conn.commit()
    conn.close()

# Spotify Taste Data CRUD Functions

def save_taste_data(user_id, data_type, time_range, data):
    """Save or update Spotify taste data for a user."""
    import json

    conn = get_db_connection()
    cursor = conn.cursor()

    # Delete existing data of this type for this user
    if time_range:
        cursor.execute('''
            DELETE FROM spotify_taste_data
            WHERE user_id = ? AND data_type = ? AND time_range = ?
        ''', (user_id, data_type, time_range))
    else:
        cursor.execute('''
            DELETE FROM spotify_taste_data
            WHERE user_id = ? AND data_type = ? AND time_range IS NULL
        ''', (user_id, data_type))

    # Insert new data
    cursor.execute('''
        INSERT INTO spotify_taste_data (user_id, data_type, time_range, data)
        VALUES (?, ?, ?, ?)
    ''', (user_id, data_type, time_range, json.dumps(data)))

    conn.commit()
    conn.close()

def get_taste_data(user_id):
    """Get all Spotify taste data for a user."""
    import json

    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT data_type, time_range, data, synced_at
        FROM spotify_taste_data
        WHERE user_id = ?
    ''', (user_id,))

    rows = cursor.fetchall()
    conn.close()

    if not rows:
        return None

    result = {
        'synced_at': None,
        'top_artists': {},
        'followed_artists': [],
        'saved_tracks': []
    }

    for row in rows:
        data_type = row['data_type']
        time_range = row['time_range']
        data = json.loads(row['data'])

        if data_type == 'top_artists':
            result['top_artists'][time_range] = data
        elif data_type == 'followed_artists':
            result['followed_artists'] = data
        elif data_type == 'saved_tracks':
            result['saved_tracks'] = data

        # Track most recent sync time
        if result['synced_at'] is None or row['synced_at'] > result['synced_at']:
            result['synced_at'] = row['synced_at']

    return result

def get_taste_sync_status(user_id):
    """Get sync status for a user's taste data."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute('''
        SELECT MAX(synced_at) as last_synced,
               COUNT(*) as data_count
        FROM spotify_taste_data
        WHERE user_id = ?
    ''', (user_id,))

    row = cursor.fetchone()
    conn.close()

    return {
        'last_synced': row['last_synced'] if row else None,
        'has_data': row['data_count'] > 0 if row else False
    }

# Test function
if __name__ == '__main__':
    print("Initializing database...")
    initialize_database()
    insert_default_sources()
    print("\n✅ Database setup complete!")
    print(f"Database location: {DB_PATH}")
