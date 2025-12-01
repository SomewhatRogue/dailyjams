import os
from openai import OpenAI
from dotenv import load_dotenv
import json
import requests
from bs4 import BeautifulSoup
import re

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

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

def get_music_recommendations(time_of_day, mood, tempo, instruments_yes, instruments_no, sources, excluded_bands=None, genres=None, trending_now=False):
    """
    Get music recommendations from ChatGPT based on user preferences.
    """
    
    # Store trending bands for display
    trending_bands_list = []
    
    # Build the prompt
    prompt = f"""You are a music discovery assistant. Based on the user's preferences, recommend 5 bands or artists that match their criteria.

USER PREFERENCES:
- Time of Day: {time_of_day}
- Mood: {mood}
- Tempo: {tempo}/100 (0=very slow, 100=very fast)
"""
    
    if instruments_yes:
        prompt += f"- Instruments that SHOULD be present: {', '.join(instruments_yes)}\n"
    
    if instruments_no:
        prompt += f"- Instruments that should NOT be present: {', '.join(instruments_no)}\n"
    
    if genres and len(genres) > 0:
        prompt += f"- Genres: {', '.join(genres)}\n"
    else:
        prompt += "- Genres: Any genre is fine\n"
    
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
    
    try:
        # Call ChatGPT API
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a helpful music discovery assistant. You only respond with valid JSON."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.7,
            max_tokens=1000
        )
        
        # Extract the response text
        response_text = response.choices[0].message.content.strip()
        
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
