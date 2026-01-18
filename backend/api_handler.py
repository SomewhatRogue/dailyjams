import os
from openai import OpenAI
from dotenv import load_dotenv
import json
import requests
from bs4 import BeautifulSoup
import re

# Load environment variables
load_dotenv()

# Discovery levels for the day/night slider (1=day/pure discovery, 5=night/comfort zone)
DISCOVERY_LEVELS = {
    1: {'exclude_known': 'all', 'label': 'Pure Discovery'},      # Exclude ALL known artists
    2: {'exclude_known': 50, 'label': 'Mostly New'},             # Exclude top 50 known
    3: {'exclude_known': 20, 'label': 'Balanced'},               # Exclude top 20 known
    4: {'exclude_known': 10, 'label': 'Familiar Mix'},           # Only exclude top 10
    5: {'exclude_known': 0, 'include_known': True, 'label': 'Comfort Zone'},  # Actively suggest from known
}

# Initialize OpenAI client (using US regional endpoint for business API key)
client = OpenAI(
    api_key=os.getenv('OPENAI_API_KEY'),
    base_url="https://us.api.openai.com/v1"
)

def scrape_reddit_music(genre=None):
    """Scrape trending posts from Reddit r/Music"""
    try:
        url = "https://www.reddit.com/r/Music/hot.json?limit=25"
        headers = {'User-Agent': 'DailyJams/1.0'}
        response = requests.get(url, headers=headers, timeout=5)
        
        if response.status_code == 200:
            data = response.json()
            bands = []
            
            for post in data['data']['children']:
                title = post['data']['title']
                # Look for artist patterns like "Artist - Song" or "[Genre] Artist"
                if ' - ' in title:
                    artist = title.split(' - ')[0].strip()
                    # Remove brackets if present
                    artist = re.sub(r'\[.*?\]', '', artist).strip()
                    if artist and len(artist) > 2 and len(artist) < 50:
                        bands.append(artist)
            
            # Remove duplicates and return
            return list(set(bands))[:10]
        return []
    except Exception as e:
        print(f"Error scraping Reddit: {str(e)}")
        return []

def scrape_pitchfork():
    """Scrape recent reviews from Pitchfork"""
    # For now, return empty - Pitchfork scraping is too unreliable
    # We can add this back with better parsing later
    return []

def search_trending_music(genres=None):
    """
    Search the web for currently trending music.
    Returns a string with trending band/artist information.
    """
    print("🔍 Searching for trending music...")
    
    trending_bands = []
    
    # Scrape Reddit
    reddit_bands = scrape_reddit_music(genres)
    if reddit_bands:
        trending_bands.extend(reddit_bands)
        print(f"✓ Found {len(reddit_bands)} from Reddit: {', '.join(reddit_bands[:5])}")
    
    # Scrape Pitchfork (currently disabled)
    pitchfork_bands = scrape_pitchfork()
    if pitchfork_bands:
        trending_bands.extend(pitchfork_bands)
        print(f"✓ Found {len(pitchfork_bands)} from Pitchfork")
    
    if trending_bands:
        trending_info = "🔥 LIVE TRENDING DATA (scraped from Reddit r/Music):\n\n"
        trending_info += "Currently popular and being discussed:\n"
        trending_info += "\n".join(f"- {band}" for band in trending_bands[:15])
        trending_info += "\n\nPrioritize these artists and similar trending ones in your recommendations."
        return trending_info
    else:
        return "Focus on popular artists from 2024-2025 based on your training data."

def get_user_taste_context(user_id):
    """
    Build taste context from user's synced Spotify data.

    Returns dict with known_artists, top_genres, artist_count or None if no data.
    """
    from database import get_taste_data

    taste = get_taste_data(user_id)
    if not taste:
        return None

    known_artists = set()
    favorite_genres = {}

    # Process each data type
    for data_type, data in taste.items():
        if not data:
            continue

        # Handle both dict (top_artists with time ranges) and list (followed/saved)
        if isinstance(data, dict):
            # top_artists has time_ranges as keys
            for time_range, artists in data.items():
                if isinstance(artists, list):
                    for artist in artists:
                        known_artists.add(artist.get('name', ''))
                        for genre in artist.get('genres', []):
                            favorite_genres[genre] = favorite_genres.get(genre, 0) + 1
        elif isinstance(data, list):
            # followed_artists, saved_tracks
            for artist in data:
                known_artists.add(artist.get('name', ''))
                for genre in artist.get('genres', []):
                    favorite_genres[genre] = favorite_genres.get(genre, 0) + 1

    # Remove empty strings
    known_artists.discard('')

    # Sort genres by frequency
    top_genres = sorted(favorite_genres.items(), key=lambda x: -x[1])[:10]

    return {
        'known_artists': list(known_artists),
        'top_genres': [g[0] for g in top_genres],
        'artist_count': len(known_artists)
    }


def get_music_recommendations(time_of_day, mood, tempo, instruments_yes, instruments_no, sources, excluded_bands=None, genres=None, trending_now=False, discover_new=False, interest=None, user_id=None, discovery_level=3, user_set_genres=False):
    """
    Get music recommendations from ChatGPT based on user preferences.
    """

    # Store trending bands for display
    trending_bands_list = []

    # Build the prompt with only filled-in preferences
    prompt = """You are a music discovery assistant. Based on the user's preferences, recommend 5 bands or artists that match their criteria.

USER PREFERENCES:
"""

    if time_of_day:
        prompt += f"- Time of Day: {time_of_day}\n"

    if mood:
        prompt += f"- Desired Mood/Feeling: {mood}\n"

    if interest:
        prompt += f"- Current Interest/Context: {interest}\n"

    prompt += f"- Tempo: {tempo*20}/100 (0=very slow, 100=very fast)\n"
    
    if instruments_yes:
        prompt += f"- Instruments that SHOULD be present: {', '.join(instruments_yes)}\n"
    
    if instruments_no:
        prompt += f"- Instruments that should NOT be present: {', '.join(instruments_no)}\n"
    
    if genres and len(genres) > 0:
        prompt += f"- Genres: {', '.join(genres)}\n"
    else:
        prompt += "- Genres: Any genre is fine\n"

    # Initialize excluded_bands if None
    if excluded_bands is None:
        excluded_bands = []
    else:
        excluded_bands = list(excluded_bands)  # Make a copy to avoid modifying original

    # Get Spotify taste context if user_id provided
    taste_context = None
    if user_id:
        taste_context = get_user_taste_context(user_id)

    if taste_context:
        # Apply discovery level logic
        level_config = DISCOVERY_LEVELS.get(discovery_level, DISCOVERY_LEVELS[3])
        exclude_limit = level_config.get('exclude_known', 20)
        include_known = level_config.get('include_known', False)

        # Add taste context to prompt if user didn't explicitly set genres
        if not user_set_genres and taste_context['top_genres']:
            prompt += f"\nUSER'S SPOTIFY LISTENING PREFERENCES (use as hints, not strict rules):\n"
            prompt += f"- Their top genres based on listening history: {', '.join(taste_context['top_genres'][:5])}\n"
            prompt += f"- They already know {taste_context['artist_count']} artists\n"

        # Handle exclusions based on discovery level
        if exclude_limit == 'all':
            # Pure discovery - exclude ALL known artists
            excluded_bands.extend(taste_context['known_artists'])
            prompt += f"\nDISCOVERY MODE: Pure Discovery - recommend artists they've likely never heard of.\n"
        elif exclude_limit > 0:
            # Partial exclusion - exclude top N known artists
            excluded_bands.extend(taste_context['known_artists'][:exclude_limit])
            prompt += f"\nDISCOVERY MODE: {level_config['label']} - mix of new discoveries with some they might know.\n"
        elif include_known:
            # Comfort zone - actively suggest from known artists
            prompt += f"\nCOMFORT MODE: The user wants familiar music. Consider these artists they love: {', '.join(taste_context['known_artists'][:15])}\n"
            prompt += "Feel free to suggest artists they already know and love, plus similar ones.\n"

    # Add trending research if enabled
    if trending_now:
        trending_info = search_trending_music(genres)
        prompt += f"\n{trending_info}\n\n"
        
        # Extract band names for counting
        for line in trending_info.split('\n'):
            if line.strip().startswith('- '):
                band = line.strip()[2:]
                trending_bands_list.append(band)
    
    prompt += f"\nRESOURCES TO RESEARCH FROM:\n"
    for source in sources:
        prompt += f"- {source['source_name']}: {source['description']}\n"
    
    if excluded_bands and len(excluded_bands) > 0:
        prompt += f"\nIMPORTANT: DO NOT suggest any of these bands (user has recently skipped them): {', '.join(excluded_bands)}\n"
    
    prompt += """
IMPORTANT: Return ONLY a valid JSON array with exactly this structure:
[
    {
        "band_name": "Band Name",
        "genre": "Genre(s)",
        "description": "Brief description of the band",
        "match_reason": "Why this matches the user's preferences"
    }
]

Return 5 recommendations. Make sure the response is ONLY valid JSON, no other text.
"""
    # DEBUG: Print the full prompt being sent to ChatGPT
    print("\n" + "="*80)
    print("📤 SENDING TO CHATGPT:")
    print("="*80)
    print(prompt)
    print("="*80 + "\n")
    
    try:
        # Call ChatGPT API
        response = client.chat.completions.create(
            model="gpt-5.1",
            messages=[
                {"role": "system", "content": "You are a helpful music discovery assistant. You only respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_completion_tokens=1000
        )
        
        # Extract the response text
        response_text = response.choices[0].message.content.strip()
                # DEBUG: Print the raw response from ChatGPT
        print("\n" + "="*80)
        print("📥 RECEIVED FROM CHATGPT:")
        print("="*80)
        print(response_text)
        print("="*80 + "\n")
        
        # Try to parse as JSON
        try:
            recommendations = json.loads(response_text)
        except json.JSONDecodeError:
            # If it's not valid JSON, try to extract JSON from the response
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            if start_idx != -1 and end_idx != 0:
                json_str = response_text[start_idx:end_idx]
                recommendations = json.loads(json_str)
            else:
                raise ValueError("Could not parse JSON from ChatGPT response")
        
        # Add trending indicator to each recommendation
        if trending_now and trending_bands_list:
            for rec in recommendations:
                rec['trending_enabled'] = True
                rec['trending_count'] = len(trending_bands_list)
        
        return recommendations
    
    except Exception as e:
        print(f"Error calling ChatGPT API: {str(e)}")
        return [{
            "band_name": "Error",
            "genre": "N/A",
            "description": f"Sorry, there was an error getting recommendations: {str(e)}",
            "match_reason": "N/A"
        }]
