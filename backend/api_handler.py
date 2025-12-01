import os
from openai import OpenAI
from dotenv import load_dotenv
import json

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

def get_music_recommendations(time_of_day, mood, tempo, instruments_yes, instruments_no, sources, excluded_bands=None, genres=None):
    """
    Get music recommendations from ChatGPT based on user preferences.
    
    Args:
        time_of_day: String like 'Morning', 'Afternoon', 'Evening', 'Night'
        mood: String describing the desired mood
        tempo: Integer from 0-100 (slow to fast)
        instruments_yes: List of instruments that should be present
        instruments_no: List of instruments that should NOT be present
        sources: List of enabled music discovery sources
        excluded_bands: List of band names to exclude (recently skipped)
        genres: List of selected genres
    
    Returns:
        List of recommendation dictionaries with band_name, genre, description, match_reason
    """
    
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
            return recommendations
        except json.JSONDecodeError:
            # If it's not valid JSON, try to extract JSON from the response
            # Sometimes ChatGPT adds extra text before/after the JSON
            start_idx = response_text.find('[')
            end_idx = response_text.rfind(']') + 1
            if start_idx != -1 and end_idx != 0:
                json_str = response_text[start_idx:end_idx]
                recommendations = json.loads(json_str)
                return recommendations
            else:
                raise ValueError("Could not parse JSON from ChatGPT response")
    
    except Exception as e:
        print(f"Error calling ChatGPT API: {str(e)}")
        # Return a fallback response
        return [{
            "band_name": "Error",
            "genre": "N/A",
            "description": f"Sorry, there was an error getting recommendations: {str(e)}",
            "match_reason": "N/A"
        }]

# Test function
if __name__ == '__main__':
    print("Testing ChatGPT API connection...")
    test_sources = [
        {'source_name': 'Reddit - r/Music', 'description': 'General music discussions'}
    ]
    
    result = get_music_recommendations(
        time_of_day='Morning',
        mood='energetic',
        tempo=75,
        instruments_yes=['guitar', 'drums'],
        instruments_no=['violin'],
        sources=test_sources,
        excluded_bands=[],
        genres=['rock', 'indie']
    )
    
    print("\n✅ API Test Results:")
    print(json.dumps(result, indent=2))
