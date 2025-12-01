from flask import Flask, render_template, request, jsonify
import os
import sys

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import initialize_database, insert_default_sources, save_suggestion, save_user_preferences, save_feedback, get_enabled_sources, get_excluded_bands, get_full_feedback_history, get_all_sources, update_source_preference
from api_handler import get_music_recommendations

app = Flask(__name__, 
            template_folder='../frontend/templates',
            static_folder='../frontend/static')

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
        
        # Get enabled sources
        sources = get_enabled_sources()
        
        # Get excluded bands (recently skipped)
        excluded_bands = get_excluded_bands()
        
        # Call ChatGPT to get recommendations
        recommendations = get_music_recommendations(
            time_of_day=time_of_day,
            mood=mood,
            tempo=tempo,
            instruments_yes=instruments_yes,
            instruments_no=instruments_no,
            sources=sources,
            excluded_bands=excluded_bands,
            genres=genres
        )
        
        # Save each recommendation to database
        saved_recommendations = []
# Get list of source names for tracking
        source_names = [s['source_name'] for s in sources]
        
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
        feedback_type = data.get('feedback_type')  # 'positive', 'negative', or 'skipped'
        
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

if __name__ == '__main__':
    print("🎵 Starting DailyJams server...")
    print("🌐 Open your browser and go to: http://localhost:5000")
    app.run(debug=True, host='0.0.0.0', port=5000)
