import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import random

# Load environment variables from project root
env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env')
load_dotenv(env_path)

# Spotify OAuth configuration
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', 'http://localhost:5000/api/spotify/callback')

# OAuth scope for playlist management and taste data
SCOPE = 'playlist-modify-public playlist-modify-private user-library-read user-top-read user-follow-read'

def get_spotify_oauth(force_new_auth=False):
    """Create and return Spotify OAuth object.

    Args:
        force_new_auth: If True, forces Spotify to show login dialog
                       (use when connecting a new user)
    """
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        scope=SCOPE,
        cache_path=None,  # No file cache - we use database per-user
        show_dialog=force_new_auth  # Force login dialog for new connections
    )

def get_spotify_client(token_info=None, user_id=None):
    """
    Get authenticated Spotify client.

    Priority:
    1. If user_id provided, use per-user database tokens (recommended)
    2. If token_info provided, use that directly
    3. Fallback to file cache (legacy, not recommended for multi-user)

    Args:
        token_info: Optional token info dict.
        user_id: Optional DailyJams user ID to load tokens from database.

    Returns:
        Spotipy client object or None if not authenticated
    """
    try:
        # Priority 1: Use per-user database tokens
        if user_id is not None:
            return get_spotify_client_for_user(user_id)

        # Priority 2: Use provided token info
        if token_info is not None:
            return spotipy.Spotify(auth=token_info['access_token'])

        # Priority 3: Fallback to file cache (legacy)
        sp_oauth = get_spotify_oauth()
        cached_token = sp_oauth.get_cached_token()
        if cached_token:
            return spotipy.Spotify(auth=cached_token['access_token'])

        return None
    except Exception as e:
        print(f"Error creating Spotify client: {str(e)}")
        return None


def get_spotify_client_for_user(user_id):
    """
    Get authenticated Spotify client for a specific DailyJams user.

    Loads token from database and refreshes if expired.

    Args:
        user_id: DailyJams user ID

    Returns:
        Spotipy client object or None if user not connected to Spotify
    """
    from database import get_spotify_auth, update_spotify_token
    import time

    try:
        auth_data = get_spotify_auth(user_id)
        if not auth_data:
            return None

        # Check if token is expired (with 60 second buffer)
        if auth_data['spotify_token_expires_at'] and auth_data['spotify_token_expires_at'] < time.time() + 60:
            # Token expired or about to expire, refresh it
            refreshed_token = refresh_user_token(user_id, auth_data['spotify_refresh_token'])
            if not refreshed_token:
                return None
            access_token = refreshed_token['access_token']
        else:
            access_token = auth_data['spotify_access_token']

        return spotipy.Spotify(auth=access_token)
    except Exception as e:
        print(f"Error getting Spotify client for user {user_id}: {str(e)}")
        return None


def refresh_user_token(user_id, refresh_token):
    """
    Refresh an expired Spotify token and save to database.

    Args:
        user_id: DailyJams user ID
        refresh_token: Spotify refresh token

    Returns:
        New token info dict or None if refresh failed
    """
    from database import update_spotify_token

    try:
        sp_oauth = get_spotify_oauth()
        token_info = sp_oauth.refresh_access_token(refresh_token)

        if token_info:
            # Save new token to database
            update_spotify_token(user_id, token_info)
            return token_info
        return None
    except Exception as e:
        print(f"Error refreshing token for user {user_id}: {str(e)}")
        return None


# ============ Taste Data Functions ============

def get_user_top_artists(sp, time_range='medium_term', limit=50):
    """
    Fetch user's top artists from Spotify.

    Args:
        sp: Authenticated Spotify client
        time_range: 'short_term' (4 weeks), 'medium_term' (6 months), 'long_term' (years)
        limit: Number of artists to fetch (max 50)

    Returns:
        List of artist dicts with name, genres, id
    """
    try:
        results = sp.current_user_top_artists(limit=limit, time_range=time_range)
        return [
            {'name': a['name'], 'genres': a.get('genres', []), 'id': a['id']}
            for a in results['items']
        ]
    except Exception as e:
        print(f"Error fetching top artists ({time_range}): {str(e)}")
        return []


def get_user_followed_artists(sp, limit=50):
    """
    Fetch artists the user follows on Spotify.

    Args:
        sp: Authenticated Spotify client
        limit: Number of artists to fetch (max 50)

    Returns:
        List of artist dicts with name, genres, id
    """
    try:
        results = sp.current_user_followed_artists(limit=limit)
        return [
            {'name': a['name'], 'genres': a.get('genres', []), 'id': a['id']}
            for a in results['artists']['items']
        ]
    except Exception as e:
        print(f"Error fetching followed artists: {str(e)}")
        return []


def get_user_saved_tracks_artists(sp, limit=50):
    """
    Fetch unique artists from user's saved/liked tracks.

    Args:
        sp: Authenticated Spotify client
        limit: Number of saved tracks to scan (max 50)

    Returns:
        List of artist dicts with name, id (no genres available from tracks)
    """
    try:
        results = sp.current_user_saved_tracks(limit=limit)
        artists = {}

        for item in results['items']:
            for artist in item['track']['artists']:
                if artist['id'] not in artists:
                    artists[artist['id']] = {'name': artist['name'], 'id': artist['id'], 'genres': []}

        return list(artists.values())
    except Exception as e:
        print(f"Error fetching saved tracks artists: {str(e)}")
        return []


def sync_all_taste_data(user_id):
    """
    Sync all Spotify taste data for a user.

    Args:
        user_id: DailyJams user ID

    Returns:
        Dict with sync results or error
    """
    from database import save_taste_data
    import json

    sp = get_spotify_client_for_user(user_id)
    if not sp:
        return {'success': False, 'error': 'Not connected to Spotify'}

    try:
        # Fetch all taste data
        top_short = get_user_top_artists(sp, 'short_term')
        top_medium = get_user_top_artists(sp, 'medium_term')
        top_long = get_user_top_artists(sp, 'long_term')
        followed = get_user_followed_artists(sp)
        saved = get_user_saved_tracks_artists(sp)

        # Save to database
        save_taste_data(user_id, 'top_artists', 'short_term', json.dumps(top_short))
        save_taste_data(user_id, 'top_artists', 'medium_term', json.dumps(top_medium))
        save_taste_data(user_id, 'top_artists', 'long_term', json.dumps(top_long))
        save_taste_data(user_id, 'followed_artists', None, json.dumps(followed))
        save_taste_data(user_id, 'saved_tracks', None, json.dumps(saved))

        return {
            'success': True,
            'synced': {
                'top_artists_short': len(top_short),
                'top_artists_medium': len(top_medium),
                'top_artists_long': len(top_long),
                'followed_artists': len(followed),
                'saved_track_artists': len(saved)
            }
        }
    except Exception as e:
        print(f"Error syncing taste data for user {user_id}: {str(e)}")
        return {'success': False, 'error': str(e)}

def search_artist(artist_name, sp=None):
    """
    Search for an artist on Spotify.

    Args:
        artist_name: Name of the artist to search for
        sp: Optional Spotify client (will create one if not provided)

    Returns:
        Artist object with id, name, uri, or None if not found
    """
    try:
        if sp is None:
            sp = get_spotify_client()
            if sp is None:
                return None

        results = sp.search(q=f'artist:{artist_name}', type='artist', limit=1)

        if results['artists']['items']:
            artist = results['artists']['items'][0]
            # Get the best image (first one is usually largest)
            image_url = None
            if artist.get('images') and len(artist['images']) > 0:
                image_url = artist['images'][0]['url']
            return {
                'id': artist['id'],
                'name': artist['name'],
                'uri': artist['uri'],
                'spotify_url': artist['external_urls']['spotify'],
                'image_url': image_url
            }
        return None
    except Exception as e:
        print(f"Error searching for artist '{artist_name}': {str(e)}")
        return None

def get_artist_images(artist_names, user_id=None):
    """
    Get images for multiple artists.

    Args:
        artist_names: List of artist names
        user_id: Optional DailyJams user ID for per-user auth

    Returns:
        Dict mapping artist names to their image URLs
    """
    try:
        sp = get_spotify_client(user_id=user_id)
        if sp is None:
            print("Spotify not authenticated - cannot fetch artist images")
            return {}

        images = {}
        for artist_name in artist_names:
            artist = search_artist(artist_name, sp)
            if artist and artist.get('image_url'):
                images[artist_name] = artist['image_url']
            else:
                images[artist_name] = None

        return images
    except Exception as e:
        print(f"Error getting artist images: {str(e)}")
        return {}

def get_artist_top_tracks(artist_id, market='US', limit=5, sp=None):
    """
    Get top tracks for an artist.

    Args:
        artist_id: Spotify artist ID
        market: Market/country code (default: US)
        limit: Number of tracks to return (max 10, default 5)
        sp: Optional Spotify client

    Returns:
        List of track objects with id, name, uri, preview_url
    """
    try:
        if sp is None:
            sp = get_spotify_client()
            if sp is None:
                return []

        results = sp.artist_top_tracks(artist_id, country=market)
        tracks = []

        for track in results['tracks'][:limit]:
            tracks.append({
                'id': track['id'],
                'name': track['name'],
                'uri': track['uri'],
                'preview_url': track.get('preview_url'),
                'spotify_url': track['external_urls']['spotify'],
                'duration_ms': track['duration_ms'],
                'album': track['album']['name']
            })

        return tracks
    except Exception as e:
        print(f"Error getting top tracks for artist {artist_id}: {str(e)}")
        return []

def create_playlist(user_id, playlist_name, track_uris, is_public=True, description=None, sp=None):
    """
    Create a new Spotify playlist with tracks.

    Args:
        user_id: Spotify user ID
        playlist_name: Name for the new playlist
        track_uris: List of track URIs to add
        is_public: Whether playlist should be public (default True)
        description: Optional playlist description
        sp: Optional Spotify client

    Returns:
        Playlist object with id, name, url, or None if failed
    """
    try:
        if sp is None:
            sp = get_spotify_client()
            if sp is None:
                return None

        # Create the playlist
        playlist = sp.user_playlist_create(
            user=user_id,
            name=playlist_name,
            public=is_public,
            description=description or f'Created by DailyJams - {len(track_uris)} tracks'
        )

        # Add tracks to the playlist
        if track_uris:
            sp.playlist_add_items(playlist['id'], track_uris)

        return {
            'id': playlist['id'],
            'name': playlist['name'],
            'url': playlist['external_urls']['spotify'],
            'uri': playlist['uri'],
            'track_count': len(track_uris)
        }
    except Exception as e:
        print(f"Error creating playlist: {str(e)}")
        return None

def add_tracks_to_playlist(playlist_id, track_uris, sp=None):
    """
    Add tracks to an existing playlist.

    Args:
        playlist_id: Spotify playlist ID
        track_uris: List of track URIs to add
        sp: Optional Spotify client

    Returns:
        True if successful, False otherwise
    """
    try:
        if sp is None:
            sp = get_spotify_client()
            if sp is None:
                return False

        sp.playlist_add_items(playlist_id, track_uris)
        return True
    except Exception as e:
        print(f"Error adding tracks to playlist {playlist_id}: {str(e)}")
        return False

def get_user_playlists(sp=None):
    """
    Get user's playlists (only those created by DailyJams).

    Args:
        sp: Optional Spotify client

    Returns:
        List of playlist objects
    """
    try:
        if sp is None:
            sp = get_spotify_client()
            if sp is None:
                return []

        playlists = []
        results = sp.current_user_playlists(limit=50)

        for playlist in results['items']:
            # Filter for playlists that contain "DailyJams" in description or are owned by user
            if playlist['owner']['id'] == sp.me()['id']:
                playlists.append({
                    'id': playlist['id'],
                    'name': playlist['name'],
                    'url': playlist['external_urls']['spotify'],
                    'track_count': playlist['tracks']['total'],
                    'is_public': playlist['public']
                })

        return playlists
    except Exception as e:
        print(f"Error getting user playlists: {str(e)}")
        return []

def get_current_user(sp=None):
    """
    Get current authenticated user's info.

    Args:
        sp: Optional Spotify client

    Returns:
        User object with id, display_name, email, or None if not authenticated
    """
    try:
        if sp is None:
            sp = get_spotify_client()
            if sp is None:
                return None

        user = sp.me()
        return {
            'id': user['id'],
            'display_name': user.get('display_name', user['id']),
            'email': user.get('email'),
            'spotify_url': user['external_urls']['spotify']
        }
    except Exception as e:
        print(f"Error getting current user: {str(e)}")
        return None

def get_tracks_for_artists(artist_names, tracks_per_artist=3, randomize=True, user_id=None, sp=None):
    """
    Get top tracks for multiple artists.

    Args:
        artist_names: List of artist names
        tracks_per_artist: Number of tracks per artist (1-5, default 3)
        randomize: Whether to randomize track order (default True)
        user_id: Optional DailyJams user ID for per-user auth
        sp: Optional pre-authenticated Spotify client

    Returns:
        Dict mapping artist names to their track lists, plus list of all track URIs
    """
    try:
        if sp is None:
            sp = get_spotify_client(user_id=user_id)
        if sp is None:
            return {'artists': {}, 'all_track_uris': [], 'error': 'Not authenticated'}

        artists_tracks = {}
        all_track_uris = []

        for artist_name in artist_names:
            # Search for artist
            artist = search_artist(artist_name, sp)
            if not artist:
                print(f"Artist not found: {artist_name}")
                continue

            # Get top tracks
            tracks = get_artist_top_tracks(artist['id'], limit=tracks_per_artist, sp=sp)

            artists_tracks[artist_name] = {
                'artist_info': artist,
                'tracks': tracks
            }

            # Collect track URIs
            for track in tracks:
                all_track_uris.append(track['uri'])

        # Randomize track order if requested
        if randomize and all_track_uris:
            random.shuffle(all_track_uris)

        return {
            'artists': artists_tracks,
            'all_track_uris': all_track_uris
        }
    except Exception as e:
        print(f"Error getting tracks for artists: {str(e)}")
        return {'artists': {}, 'all_track_uris': [], 'error': str(e)}

# Test function
if __name__ == '__main__':
    print("Testing Spotify API connection...")

    # Test OAuth
    sp_oauth = get_spotify_oauth()
    print(f"Auth URL: {sp_oauth.get_authorize_url()}")

    # Test client (will only work if already authenticated)
    sp = get_spotify_client()
    if sp:
        user = get_current_user(sp)
        print(f"\n✅ Authenticated as: {user['display_name']}")

        # Test artist search
        artist = search_artist('The National', sp)
        if artist:
            print(f"\n✅ Found artist: {artist['name']}")

            # Test top tracks
            tracks = get_artist_top_tracks(artist['id'], limit=3, sp=sp)
            print(f"\n✅ Top tracks:")
            for track in tracks:
                print(f"   - {track['name']}")
    else:
        print("\n⚠️  Not authenticated. Visit auth URL to authenticate.")
