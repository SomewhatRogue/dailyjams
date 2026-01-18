from flask import Flask, render_template, request, jsonify, redirect, session
import os
import sys

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import (
    initialize_database, insert_default_sources, save_suggestion, save_user_preferences,
    save_feedback, get_enabled_sources, get_excluded_bands, get_full_feedback_history,
    get_all_sources, update_source_preference, add_new_source, delete_source,
    get_all_rated_bands, save_playlist, link_playlist_to_suggestions,
    get_all_playlists, get_playlist_with_details, update_playlist_track_count,
    get_bands_in_playlists, migrate_add_user_support, migrate_add_spotify_support,
    ensure_default_user, create_user, get_all_users, get_user_by_id, delete_user,
    get_user_count, save_spotify_auth, get_spotify_auth, update_spotify_token,
    clear_spotify_auth, save_taste_data, get_taste_data, get_taste_sync_status
)
from api_handler import get_music_recommendations
from spotify_handler import (
    get_spotify_oauth, get_spotify_client, get_current_user,
    get_tracks_for_artists, create_playlist, add_tracks_to_playlist,
    get_user_playlists as get_spotify_user_playlists, get_artist_images,
    get_spotify_client_for_user, sync_all_taste_data
)

app = Flask(__name__,
            template_folder='../frontend/templates',
            static_folder='../frontend/static')

# Set secret key for sessions (needed for Spotify OAuth)
app.secret_key = os.getenv('FLASK_SECRET_KEY', 'dev-secret-key-change-in-production')

# Initialize database on startup
with app.app_context():
    initialize_database()
    insert_default_sources()
    migrate_add_user_support()
    migrate_add_spotify_support()
    ensure_default_user()

def get_current_user_id():
    """Get the current user ID from session, defaulting to 1."""
    return session.get('current_user_id', 1)

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

# User Profile Routes

@app.route('/users')
def users_page():
    """Render the user selection page."""
    return render_template('users.html')

@app.route('/api/users', methods=['GET'])
def list_users():
    """Get all user profiles."""
    try:
        users = get_all_users()
        return jsonify({
            'success': True,
            'users': users
        })
    except Exception as e:
        print(f"Error in GET /api/users: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/users', methods=['POST'])
def add_user():
    """Create a new user profile."""
    try:
        data = request.json
        name = data.get('name', '').strip()
        avatar_color = data.get('avatar_color', '#2980b9')

        if not name:
            return jsonify({
                'success': False,
                'error': 'Name is required'
            }), 400

        user_id = create_user(name, avatar_color)

        if user_id is None:
            return jsonify({
                'success': False,
                'error': 'A user with that name already exists'
            }), 400

        return jsonify({
            'success': True,
            'user_id': user_id,
            'message': f'User "{name}" created!'
        })
    except Exception as e:
        print(f"Error in POST /api/users: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
def remove_user(user_id):
    """Delete a user profile."""
    try:
        # Don't allow deleting current user while logged in as them
        if get_current_user_id() == user_id:
            # Switch to another user first
            users = get_all_users()
            other_user = next((u for u in users if u['id'] != user_id), None)
            if other_user:
                session['current_user_id'] = other_user['id']

        success = delete_user(user_id)

        if not success:
            return jsonify({
                'success': False,
                'error': 'Cannot delete the last user'
            }), 400

        return jsonify({
            'success': True,
            'message': 'User deleted'
        })
    except Exception as e:
        print(f"Error in DELETE /api/users/{user_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/users/current', methods=['GET'])
def current_user():
    """Get the currently active user."""
    try:
        user_id = get_current_user_id()
        user = get_user_by_id(user_id)

        if not user:
            # Fallback to first user if current doesn't exist
            users = get_all_users()
            if users:
                user = users[0]
                session['current_user_id'] = user['id']

        return jsonify({
            'success': True,
            'user': user
        })
    except Exception as e:
        print(f"Error in GET /api/users/current: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/users/switch', methods=['POST'])
def switch_user():
    """Switch to a different user profile."""
    try:
        data = request.json
        user_id = data.get('user_id')

        if not user_id:
            return jsonify({
                'success': False,
                'error': 'User ID is required'
            }), 400

        user = get_user_by_id(user_id)
        if not user:
            return jsonify({
                'success': False,
                'error': 'User not found'
            }), 404

        session['current_user_id'] = user_id

        return jsonify({
            'success': True,
            'user': user,
            'message': f'Switched to {user["name"]}'
        })
    except Exception as e:
        print(f"Error in POST /api/users/switch: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/recommend', methods=['POST'])
def recommend():
    """Get music recommendations based on user preferences."""
    try:
        # Get data from the request
        data = request.json
        
        time_of_day = data.get('time_of_day', '')
        mood = data.get('mood', '')
        interest = data.get('interest', '')
        tempo = data.get('tempo', 50)
        instruments_yes = data.get('instruments_yes', [])
        instruments_no = data.get('instruments_no', [])
        genres = data.get('genres', [])
        trending_now = data.get('trending_now', False)
        discover_new = data.get('discover_new', False)
        discovery_level = data.get('discovery_level', 3)  # 1=pure discovery, 5=comfort zone
        excluded_artists = data.get('excluded_artists', [])  # Session-based exclusions from swipe UI

        # Check if user explicitly set genres (for taste context override logic)
        user_set_genres = len(genres) > 0

        # Get current user
        user_id = get_current_user_id()

        # Get enabled sources
        sources = get_enabled_sources()

        # Get excluded bands for this user
        if discover_new:
            # Exclude ALL previously rated bands
            excluded_bands = get_all_rated_bands(user_id)
        else:
            # Only exclude recently skipped bands (5-day cooldown)
            excluded_bands = get_excluded_bands(user_id)

        # Merge session exclusions (from swipe UI) with database exclusions
        excluded_bands = list(set(excluded_bands + excluded_artists))
        
        # Get list of source names for tracking
        source_names = [s['source_name'] for s in sources]
        
        # Call ChatGPT to get recommendations
        recommendations = get_music_recommendations(
            time_of_day=time_of_day,
            mood=mood,
            tempo=tempo,
            instruments_yes=instruments_yes,
            instruments_no=instruments_no,
            sources=sources,
            excluded_bands=excluded_bands,
            genres=genres,
            trending_now=trending_now,
            discover_new=discover_new,
            interest=interest,
            user_id=user_id,
            discovery_level=discovery_level,
            user_set_genres=user_set_genres
        )

        # Fetch artist images from Spotify
        band_names = [rec['band_name'] for rec in recommendations]
        artist_images = get_artist_images(band_names)

        # Add images to recommendations
        for rec in recommendations:
            rec['image_url'] = artist_images.get(rec['band_name'])

        # Get bands already in playlists for this user
        bands_in_playlists = get_bands_in_playlists(user_id)

        # Save each recommendation to database
        saved_recommendations = []
        for rec in recommendations:
            suggestion_id = save_suggestion(
                band_name=rec['band_name'],
                genre=rec.get('genre', ''),
                description=rec.get('description', ''),
                match_reason=rec.get('match_reason', ''),
                sources_used=source_names,
                user_id=user_id
            )

            # Save the preferences that generated this suggestion
            save_user_preferences(
                suggestion_id=suggestion_id,
                time_of_day=time_of_day,
                mood=mood,
                tempo=tempo,
                instruments_yes=instruments_yes,
                instruments_no=instruments_no
            )

            # Add the ID to the recommendation for frontend use
            rec['id'] = suggestion_id

            # Check if this band is in any playlists
            rec['in_playlist'] = suggestion_id in bands_in_playlists

            saved_recommendations.append(rec)

        return jsonify({
            'success': True,
            'recommendations': saved_recommendations
        })
    
    except Exception as e:
        print(f"Error in /api/recommend: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/feedback', methods=['POST'])
def feedback():
    """Save user feedback on a suggestion."""
    try:
        data = request.json
        suggestion_id = data.get('suggestion_id')
        feedback_type = data.get('feedback_type')

        if not suggestion_id or not feedback_type:
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400

        user_id = get_current_user_id()
        save_feedback(suggestion_id, feedback_type, user_id)
        
        return jsonify({
            'success': True,
            'message': 'Feedback saved!'
        })
    
    except Exception as e:
        print(f"Error in /api/feedback: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sources', methods=['GET'])
def sources():
    """Get all available music sources."""
    try:
        sources_list = get_enabled_sources()
        return jsonify({
            'success': True,
            'sources': sources_list
        })
    except Exception as e:
        print(f"Error in /api/sources: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/discover')
def discover_page():
    """Render the swipe discovery page."""
    return render_template('discover.html')

@app.route('/history')
def history_page():
    """Render the history page."""
    return render_template('history.html')

@app.route('/api/history', methods=['GET'])
def get_history():
    """Get user's feedback history."""
    try:
        user_id = get_current_user_id()
        history = get_full_feedback_history(user_id)
        return jsonify({
            'success': True,
            'history': history
        })
    except Exception as e:
        print(f"Error in /api/history: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/history-demo')
def history_demo_page():
    """Render the history page with demo data (for design testing)."""
    return render_template('history-demo.html')

@app.route('/api/history-demo', methods=['GET'])
def get_history_demo():
    """Get demo history data for design testing."""
    demo_history = [
        {
            'id': 1, 'band_name': 'Khruangbin', 'genre': 'Psychedelic Soul, Funk',
            'description': 'A Houston-based trio known for their global music influences, blending funk, soul, and psychedelia with Thai and Middle Eastern sounds.',
            'match_reason': 'Perfect for late night vibes with their hypnotic grooves',
            'feedback_type': 'positive', 'time_of_day': 'night', 'mood': 'relaxed, dreamy',
            'tempo': 3, 'instruments_yes': 'guitar,bass', 'instruments_no': '',
            'created_at': '2025-01-15T22:30:00'
        },
        {
            'id': 2, 'band_name': 'Japanese Breakfast', 'genre': 'Indie Pop, Dream Pop',
            'description': 'Michelle Zauner\'s project blending shoegaze textures with catchy pop melodies and deeply personal lyrics.',
            'match_reason': 'Matches your afternoon energy with uplifting yet introspective tones',
            'feedback_type': 'positive', 'time_of_day': 'afternoon', 'mood': 'reflective',
            'tempo': 4, 'instruments_yes': 'synth', 'instruments_no': '',
            'created_at': '2025-01-14T15:20:00'
        },
        {
            'id': 3, 'band_name': 'King Gizzard & The Lizard Wizard', 'genre': 'Psychedelic Rock, Garage Rock',
            'description': 'Prolific Australian band exploring everything from thrash metal to microtonal music.',
            'match_reason': 'High energy for your upbeat morning request',
            'feedback_type': 'skipped', 'time_of_day': 'morning', 'mood': 'energetic',
            'tempo': 5, 'instruments_yes': '', 'instruments_no': 'electronic',
            'created_at': '2025-01-13T09:15:00'
        },
        {
            'id': 4, 'band_name': 'Floating Points', 'genre': 'Electronic, Ambient',
            'description': 'Sam Shepherd creates expansive electronic soundscapes that blend jazz, classical, and ambient textures.',
            'match_reason': 'Deep listening for your contemplative evening mood',
            'feedback_type': 'save_later', 'time_of_day': 'evening', 'mood': 'contemplative',
            'tempo': 2, 'instruments_yes': 'piano,synth', 'instruments_no': '',
            'created_at': '2025-01-12T19:45:00'
        },
        {
            'id': 5, 'band_name': 'Car Seat Headrest', 'genre': 'Indie Rock, Lo-fi',
            'description': 'Will Toledo\'s emotionally raw songwriting with fuzzy guitars and anthemic hooks.',
            'match_reason': 'Matches your afternoon energy request',
            'feedback_type': 'negative', 'time_of_day': 'afternoon', 'mood': 'angsty',
            'tempo': 4, 'instruments_yes': 'guitar', 'instruments_no': '',
            'created_at': '2025-01-11T14:30:00'
        }
    ]
    return jsonify({'success': True, 'history': demo_history})

@app.route('/profile')
def profile_page():
    """Render the profile/settings page."""
    return render_template('profile.html')

@app.route('/api/sources/all', methods=['GET'])
def get_sources():
    """Get all music sources with their enabled status."""
    try:
        sources = get_all_sources()
        return jsonify({
            'success': True,
            'sources': sources
        })
    except Exception as e:
        print(f"Error in /api/sources/all: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sources/update', methods=['POST'])
def update_sources():
    """Update source enabled/disabled status."""
    try:
        data = request.json
        source_id = data.get('source_id')
        is_enabled = data.get('is_enabled')
        
        if source_id is None or is_enabled is None:
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        update_source_preference(source_id, is_enabled)
        
        return jsonify({
            'success': True,
            'message': 'Source preference updated!'
        })
    except Exception as e:
        print(f"Error in /api/sources/update: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sources/add', methods=['POST'])
def add_source():
    """Add a new custom music source."""
    try:
        data = request.json
        source_name = data.get('source_name')
        source_url = data.get('source_url', '')
        description = data.get('description', '')
        is_enabled = data.get('is_enabled', 1)
        
        if not source_name:
            return jsonify({
                'success': False,
                'error': 'Source name is required'
            }), 400
        
        source_id = add_new_source(source_name, source_url, description, is_enabled)
        
        if source_id is None:
            return jsonify({
                'success': False,
                'error': 'Source name already exists'
            }), 400
        
        return jsonify({
            'success': True,
            'message': 'Source added successfully!',
            'source_id': source_id
        })
    except Exception as e:
        print(f"Error in /api/sources/add: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/sources/delete', methods=['POST'])
def delete_source_route():
    """Delete a custom music source."""
    try:
        data = request.json
        source_id = data.get('source_id')
        
        if not source_id:
            return jsonify({
                'success': False,
                'error': 'Source ID is required'
            }), 400
        
        delete_source(source_id)
        
        return jsonify({
            'success': True,
            'message': 'Source deleted successfully!'
        })
    except Exception as e:
        print(f"Error in /api/sources/delete: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

# Spotify Integration Routes

@app.route('/api/spotify/login')
def spotify_login():
    """Initiate Spotify OAuth flow."""
    try:
        # Get the return page from query parameters (default to home page)
        return_page = request.args.get('return_page', '/')
        session['spotify_oauth_return_page'] = return_page

        sp_oauth = get_spotify_oauth()
        auth_url = sp_oauth.get_authorize_url()
        return jsonify({
            'success': True,
            'auth_url': auth_url
        })
    except Exception as e:
        print(f"Error in /api/spotify/login: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/spotify/callback')
def spotify_callback():
    """Handle Spotify OAuth callback - saves tokens per DailyJams user."""
    try:
        sp_oauth = get_spotify_oauth()
        code = request.args.get('code')

        if code:
            token_info = sp_oauth.get_access_token(code)

            # Keep in session for backwards compatibility
            session['spotify_token'] = token_info

            # Get Spotify user info
            import spotipy
            sp = spotipy.Spotify(auth=token_info['access_token'])
            spotify_user = sp.me()
            spotify_user_info = {
                'id': spotify_user['id'],
                'display_name': spotify_user.get('display_name', spotify_user['id'])
            }

            # Save to database per DailyJams user
            user_id = get_current_user_id()
            save_spotify_auth(user_id, token_info, spotify_user_info)

            # Redirect back to the page where OAuth was initiated
            redirect_page = session.get('spotify_oauth_return_page', '/')
            session.pop('spotify_oauth_return_page', None)  # Clean up
            return redirect(f'{redirect_page}?spotify=connected')
        else:
            redirect_page = session.get('spotify_oauth_return_page', '/')
            session.pop('spotify_oauth_return_page', None)
            return redirect(f'{redirect_page}?spotify=error')
    except Exception as e:
        print(f"Error in /api/spotify/callback: {str(e)}")
        redirect_page = session.get('spotify_oauth_return_page', '/')
        session.pop('spotify_oauth_return_page', None)
        return redirect(f'{redirect_page}?spotify=error')

@app.route('/api/spotify/status')
def spotify_status():
    """Check if current DailyJams user is connected to Spotify."""
    try:
        user_id = get_current_user_id()

        # Check per-user connection from database
        auth_data = get_spotify_auth(user_id)
        if auth_data and auth_data.get('spotify_user_id'):
            # Get sync status too
            sync_status = get_taste_sync_status(user_id)
            return jsonify({
                'success': True,
                'authenticated': True,
                'connected': True,
                'spotify_user_id': auth_data['spotify_user_id'],
                'spotify_display_name': auth_data['spotify_display_name'],
                'connected_at': auth_data.get('spotify_connected_at'),
                'taste_synced': sync_status is not None,
                'last_sync': sync_status
            })

        # Fallback: check legacy file-based auth
        sp = get_spotify_client()
        if sp:
            user = get_current_user(sp)
            if user:
                return jsonify({
                    'success': True,
                    'authenticated': True,
                    'connected': False,  # Has legacy auth but not per-user
                    'user': user,
                    'message': 'Connected via legacy auth. Re-connect to link to your profile.'
                })

        return jsonify({
            'success': True,
            'authenticated': False,
            'connected': False
        })
    except Exception as e:
        print(f"Error in /api/spotify/status: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/spotify/disconnect', methods=['POST'])
def spotify_disconnect():
    """Disconnect current user's Spotify account."""
    try:
        user_id = get_current_user_id()
        clear_spotify_auth(user_id)

        return jsonify({
            'success': True,
            'message': 'Spotify disconnected'
        })
    except Exception as e:
        print(f"Error in /api/spotify/disconnect: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/spotify/sync', methods=['POST'])
def spotify_sync_taste():
    """Sync current user's Spotify taste data (top artists, followed artists, saved tracks)."""
    try:
        user_id = get_current_user_id()

        # Verify user is connected
        auth_data = get_spotify_auth(user_id)
        if not auth_data or not auth_data.get('spotify_user_id'):
            return jsonify({
                'success': False,
                'error': 'Not connected to Spotify'
            }), 401

        # Sync all taste data
        result = sync_all_taste_data(user_id)

        if result['success']:
            return jsonify({
                'success': True,
                'message': 'Taste data synced successfully',
                'synced': result['synced']
            })
        else:
            return jsonify({
                'success': False,
                'error': result.get('error', 'Failed to sync taste data')
            }), 500

    except Exception as e:
        print(f"Error in /api/spotify/sync: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/spotify/taste', methods=['GET'])
def get_spotify_taste():
    """Get current user's synced Spotify taste data."""
    try:
        user_id = get_current_user_id()
        taste_data = get_taste_data(user_id)

        if taste_data:
            return jsonify({
                'success': True,
                'taste_data': taste_data
            })
        else:
            return jsonify({
                'success': True,
                'taste_data': None,
                'message': 'No taste data synced yet'
            })
    except Exception as e:
        print(f"Error in /api/spotify/taste: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/spotify/test-previews')
def test_preview_urls():
    """Test if Spotify preview URLs are available for this app."""
    try:
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'authenticated': False,
                'error': 'Not authenticated with Spotify. Please connect first at /api/spotify/login'
            })

        # Test with a well-known artist (Radiohead - should have tracks)
        from spotify_handler import search_artist, get_artist_top_tracks

        test_artists = ['Radiohead', 'Taylor Swift', 'Kendrick Lamar']
        results = []

        for artist_name in test_artists:
            artist = search_artist(artist_name, sp)
            if artist:
                tracks = get_artist_top_tracks(artist['id'], limit=3, sp=sp)
                track_results = []
                for track in tracks:
                    track_results.append({
                        'name': track['name'],
                        'preview_url': track.get('preview_url'),
                        'has_preview': track.get('preview_url') is not None
                    })
                results.append({
                    'artist': artist_name,
                    'image_url': artist.get('image_url'),
                    'tracks': track_results,
                    'previews_available': sum(1 for t in track_results if t['has_preview'])
                })

        total_tracks = sum(len(r['tracks']) for r in results)
        total_previews = sum(r['previews_available'] for r in results)

        return jsonify({
            'success': True,
            'authenticated': True,
            'summary': {
                'total_tracks_checked': total_tracks,
                'tracks_with_previews': total_previews,
                'preview_rate': f"{(total_previews/total_tracks)*100:.0f}%" if total_tracks > 0 else "0%",
                'previews_working': total_previews > 0
            },
            'details': results
        })

    except Exception as e:
        print(f"Error in /api/spotify/test-previews: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/spotify/tracks', methods=['POST'])
def get_tracks():
    """Get top tracks for selected artists."""
    try:
        data = request.json
        artist_configs = data.get('artists', [])  # List of {band_name, suggestion_id, track_count}

        if not artist_configs:
            return jsonify({
                'success': False,
                'error': 'No artists provided'
            }), 400

        # Check authentication
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'error': 'Not authenticated with Spotify'
            }), 401

        # Get tracks for each artist
        artists_data = {}
        for config in artist_configs:
            band_name = config['band_name']
            track_count = config.get('track_count', 3)

            result = get_tracks_for_artists([band_name], tracks_per_artist=track_count, randomize=False)

            if band_name in result['artists']:
                artists_data[band_name] = result['artists'][band_name]
                artists_data[band_name]['suggestion_id'] = config['suggestion_id']
                artists_data[band_name]['track_count'] = track_count

        return jsonify({
            'success': True,
            'artists': artists_data
        })
    except Exception as e:
        print(f"Error in /api/spotify/tracks: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/spotify/create-playlist', methods=['POST'])
def create_spotify_playlist():
    """Create a new Spotify playlist or add to existing one."""
    try:
        data = request.json
        playlist_name = data.get('playlist_name')
        selected_tracks = data.get('selected_tracks', {})  # {artist_name: {track_uris: [], suggestion_id, track_count}}
        existing_playlist_id = data.get('existing_playlist_id')  # Optional: add to existing

        # Check authentication
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'error': 'Not authenticated with Spotify'
            }), 401

        # Get current user
        user = get_current_user(sp)
        if not user:
            return jsonify({
                'success': False,
                'error': 'Could not get Spotify user info'
            }), 500

        # Collect all track URIs
        all_track_uris = []
        suggestion_track_counts = []  # [(suggestion_id, track_count)]

        for artist_name, artist_data in selected_tracks.items():
            track_uris = artist_data.get('track_uris', [])
            all_track_uris.extend(track_uris)
            suggestion_track_counts.append((
                artist_data.get('suggestion_id'),
                len(track_uris)
            ))

        if not all_track_uris:
            return jsonify({
                'success': False,
                'error': 'No tracks selected'
            }), 400

        # Randomize track order
        import random
        random.shuffle(all_track_uris)

        # Create or update playlist on Spotify
        if existing_playlist_id:
            # Add to existing playlist
            success = add_tracks_to_playlist(existing_playlist_id, all_track_uris, sp)

            if not success:
                return jsonify({
                    'success': False,
                    'error': 'Failed to add tracks to playlist'
                }), 500

            # Update database
            db_playlist_id = data.get('db_playlist_id')
            if db_playlist_id:
                link_playlist_to_suggestions(db_playlist_id, suggestion_track_counts)
                update_playlist_track_count(db_playlist_id, len(all_track_uris))

            # Get playlist details for response
            from spotify_handler import get_user_playlists as get_spotify_user_playlists
            user_playlists = get_spotify_user_playlists(sp)
            spotify_playlist = next((p for p in user_playlists if p['id'] == existing_playlist_id), None)

            return jsonify({
                'success': True,
                'message': f'Added {len(all_track_uris)} tracks to playlist',
                'playlist': spotify_playlist
            })
        else:
            # Create new playlist
            if not playlist_name:
                return jsonify({
                    'success': False,
                    'error': 'Playlist name is required'
                }), 400

            spotify_playlist = create_playlist(
                user_id=user['id'],
                playlist_name=playlist_name,
                track_uris=all_track_uris,
                is_public=True,
                description=f'Created by DailyJams - {len(selected_tracks)} artists, {len(all_track_uris)} tracks',
                sp=sp
            )

            if not spotify_playlist:
                return jsonify({
                    'success': False,
                    'error': 'Failed to create playlist on Spotify'
                }), 500

            # Save to database
            db_playlist_id = save_playlist(
                playlist_name=playlist_name,
                spotify_playlist_id=spotify_playlist['id'],
                spotify_url=spotify_playlist['url'],
                band_count=len(selected_tracks),
                track_count=len(all_track_uris),
                user_id=get_current_user_id()
            )

            # Link suggestions to playlist
            link_playlist_to_suggestions(db_playlist_id, suggestion_track_counts)

            return jsonify({
                'success': True,
                'message': 'Playlist created successfully!',
                'playlist': spotify_playlist,
                'db_playlist_id': db_playlist_id
            })

    except Exception as e:
        print(f"Error in /api/spotify/create-playlist: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/playlists', methods=['GET'])
def get_playlists():
    """Get all user's DailyJams playlists."""
    try:
        user_id = get_current_user_id()
        playlists = get_all_playlists(user_id)
        return jsonify({
            'success': True,
            'playlists': playlists
        })
    except Exception as e:
        print(f"Error in /api/playlists: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/playlists/<int:playlist_id>', methods=['GET'])
def get_playlist_details(playlist_id):
    """Get details for a specific playlist."""
    try:
        playlist = get_playlist_with_details(playlist_id)
        if not playlist:
            return jsonify({
                'success': False,
                'error': 'Playlist not found'
            }), 404

        return jsonify({
            'success': True,
            'playlist': playlist
        })
    except Exception as e:
        print(f"Error in /api/playlists/{playlist_id}: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

@app.route('/api/spotify/user-playlists', methods=['GET'])
def get_spotify_playlists():
    """Get user's playlists from Spotify (for selecting existing playlists to add to)."""
    try:
        sp = get_spotify_client()
        if not sp:
            return jsonify({
                'success': False,
                'error': 'Not authenticated with Spotify'
            }), 401

        playlists = get_spotify_user_playlists(sp)

        return jsonify({
            'success': True,
            'playlists': playlists
        })
    except Exception as e:
        print(f"Error in /api/spotify/user-playlists: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500

if __name__ == '__main__':
    print("🎵 Starting DailyJams server...")
    print("🌐 Open your browser and go to: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)