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
    get_bands_in_playlists
)
from api_handler import get_music_recommendations
from spotify_handler import (
    get_spotify_oauth, get_spotify_client, get_current_user,
    get_tracks_for_artists, create_playlist, add_tracks_to_playlist,
    get_user_playlists as get_spotify_user_playlists
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

@app.route('/')
def index():
    """Render the main page."""
    return render_template('index.html')

@app.route('/api/recommend', methods=['POST'])
def recommend():
    """Get music recommendations based on user preferences."""
    try:
        # Get data from the request
        data = request.json
        
        time_of_day = data.get('time_of_day', '')
        mood = data.get('mood', '')
        tempo = data.get('tempo', 50)
        instruments_yes = data.get('instruments_yes', [])
        instruments_no = data.get('instruments_no', [])
        genres = data.get('genres', [])
        trending_now = data.get('trending_now', False)
        discover_new = data.get('discover_new', False)
        
        # Get enabled sources
        sources = get_enabled_sources()
        
        # Get excluded bands
        if discover_new:
            # Exclude ALL previously rated bands
            excluded_bands = get_all_rated_bands()
        else:
            # Only exclude recently skipped bands (5-day cooldown)
            excluded_bands = get_excluded_bands()
        
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
            discover_new=discover_new
        )
        
        # Get bands already in playlists
        bands_in_playlists = get_bands_in_playlists()

        # Save each recommendation to database
        saved_recommendations = []
        for rec in recommendations:
            suggestion_id = save_suggestion(
                band_name=rec['band_name'],
                genre=rec.get('genre', ''),
                description=rec.get('description', ''),
                match_reason=rec.get('match_reason', ''),
                sources_used=source_names
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
        print(f"🔍 DEBUG: Received feedback request: {data}") 
        suggestion_id = data.get('suggestion_id')
        feedback_type = data.get('feedback_type')
        
        if not suggestion_id or not feedback_type:
            return jsonify({
                'success': False,
                'error': 'Missing required fields'
            }), 400
        
        save_feedback(suggestion_id, feedback_type)
        
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

@app.route('/history')
def history_page():
    """Render the history page."""
    return render_template('history.html')

@app.route('/api/history', methods=['GET'])
def get_history():
    """Get user's feedback history."""
    try:
        history = get_full_feedback_history()
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
    """Handle Spotify OAuth callback."""
    try:
        sp_oauth = get_spotify_oauth()
        code = request.args.get('code')

        if code:
            token_info = sp_oauth.get_access_token(code)
            session['spotify_token'] = token_info

            # Redirect to main page with success message
            return redirect('/?spotify=connected')
        else:
            return redirect('/?spotify=error')
    except Exception as e:
        print(f"Error in /api/spotify/callback: {str(e)}")
        return redirect('/?spotify=error')

@app.route('/api/spotify/status')
def spotify_status():
    """Check if user is authenticated with Spotify."""
    try:
        sp = get_spotify_client()
        if sp:
            user = get_current_user(sp)
            if user:
                return jsonify({
                    'success': True,
                    'authenticated': True,
                    'user': user
                })

        return jsonify({
            'success': True,
            'authenticated': False
        })
    except Exception as e:
        print(f"Error in /api/spotify/status: {str(e)}")
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
                track_count=len(all_track_uris)
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
        playlists = get_all_playlists()
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