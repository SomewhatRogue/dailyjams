import os
import spotipy
from spotipy.oauth2 import SpotifyOAuth
from dotenv import load_dotenv
import random

# Load environment variables
load_dotenv()

# Spotify OAuth configuration
SPOTIFY_CLIENT_ID = os.getenv('SPOTIFY_CLIENT_ID')
SPOTIFY_CLIENT_SECRET = os.getenv('SPOTIFY_CLIENT_SECRET')
SPOTIFY_REDIRECT_URI = os.getenv('SPOTIFY_REDIRECT_URI', 'http://localhost:5000/api/spotify/callback')

# OAuth scope for playlist management
SCOPE = 'playlist-modify-public playlist-modify-private user-library-read'

def get_spotify_oauth():
    """Create and return Spotify OAuth object."""
    return SpotifyOAuth(
        client_id=SPOTIFY_CLIENT_ID,
        client_secret=SPOTIFY_CLIENT_SECRET,
        redirect_uri=SPOTIFY_REDIRECT_URI,
        scope=SCOPE,
        cache_path='.spotify_cache'
    )

def get_spotify_client(token_info=None):
    """
    Get authenticated Spotify client.

    Args:
        token_info: Optional token info dict. If None, will try to get from cache.

    Returns:
        Spotipy client object or None if not authenticated
    """
    try:
        sp_oauth = get_spotify_oauth()

        if token_info is None:
            token_info = sp_oauth.get_cached_token()

        if token_info:
            return spotipy.Spotify(auth=token_info['access_token'])
        return None
    except Exception as e:
        print(f"Error creating Spotify client: {str(e)}")
        return None

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
            return {
                'id': artist['id'],
                'name': artist['name'],
                'uri': artist['uri'],
                'spotify_url': artist['external_urls']['spotify']
            }
        return None
    except Exception as e:
        print(f"Error searching for artist '{artist_name}': {str(e)}")
        return None

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

def get_tracks_for_artists(artist_names, tracks_per_artist=3, randomize=True):
    """
    Get top tracks for multiple artists.

    Args:
        artist_names: List of artist names
        tracks_per_artist: Number of tracks per artist (1-5, default 3)
        randomize: Whether to randomize track order (default True)

    Returns:
        Dict mapping artist names to their track lists, plus list of all track URIs
    """
    try:
        sp = get_spotify_client()
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
