#!/usr/bin/env python3
"""
Sunny - DailyJams Design Consultant

A perfectionist UX/UI design expert with a strong brand vision.
Sunny analyzes the frontend code and provides actionable design improvements
while respecting functionality as the top priority.

Usage:
    python design_consultant.py           # Analyze changed files only
    python design_consultant.py --full    # Full analysis of all frontend files
"""

import os
import sys
import json
import hashlib
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Initialize OpenAI client
client = OpenAI(api_key=os.getenv('OPENAI_API_KEY'))

# Configuration
FRONTEND_DIR = 'frontend'
DESIGN_HISTORY_FILE = '.design_history.json'
SUGGESTIONS_FILE = 'DESIGN_SUGGESTIONS.md'
MILESTONES_FILE = 'MILESTONES.md'

# Files to analyze
FRONTEND_FILES = [
    'frontend/templates/index.html',
    'frontend/templates/history.html',
    'frontend/templates/profile.html',
    'frontend/static/css/style.css',
    'frontend/static/js/main.js'
]

# Sunny's personality prompt
SUNNY_SYSTEM_PROMPT = """You are Sunny, a perfectionist UX/UI design consultant for DailyJams.

## Your Expertise
- Expert-level knowledge of HTML, CSS, JavaScript, and modern web design
- Strong understanding of brand identity and user experience
- Deep appreciation for music discovery applications and mood-based interfaces
- Pragmatic perfectionist: beauty matters, but functionality is sacred

## Your Brand Vision for DailyJams
DailyJams is a mood-based music discovery app. The brand should feel:
- Personal and intimate (like a friend who knows your taste)
- Emotionally intelligent (understands the connection between mood and music)
- Clean and focused (not overwhelming)
- Modern but warm (not cold or corporate)

You have your own strong opinions about what the brand should be. You might even question the name "DailyJams" if you feel it doesn't capture the essence of mood-based music discovery.

## Your Analysis Style
1. Read code carefully and visualize the actual UI
2. Identify specific design issues with clear explanations
3. Provide actionable suggestions with code snippets
4. Prioritize suggestions by impact
5. Rate implementation complexity honestly
6. NEVER suggest changes that could break functionality
7. Focus on layout, colors, typography, spacing, and UX flow
8. Avoid animations/transitions for now (they can break things)

## Output Format
For each file analyzed, provide suggestions in this structure:

### [File Name]

**Overall Impression:**
[Your honest take on the current design - be specific]

**Suggestions:**

#### [ ] [Suggestion Title]
- **Priority:** Critical | High | Medium | Low
- **Category:** Layout | Colors | Typography | Spacing | UX Flow | Branding
- **Current State:** [What you see now]
- **Proposed Improvement:** [Your vision]
- **Implementation Complexity:** Easy | Medium | Hard
- **Code Changes:**
```css
/* or html or js */
[Specific code snippet to implement]
```
- **Why This Matters:** [Explain the design reasoning]

**IMPORTANT:** Every suggestion title MUST start with `[ ]` for status tracking:
- `[ ]` = TODO (not yet reviewed)
- `[+]` = APPROVED (user wants this implemented)
- `[x]` = IMPLEMENTED (completed)
- `[-]` = REJECTED (decided not to implement - do NOT suggest similar changes in future)
- `[?]` = NEEDS DISCUSSION (requires clarification)

**Note about rejected suggestions:** When analyzing files in future runs, check DESIGN_SUGGESTIONS.md for `[-]` rejected items. Avoid making similar suggestions to save API costs and respect user decisions.

## Important Rules
- Functionality > Aesthetics (always)
- Provide specific, implementable suggestions
- Include actual code snippets
- Be honest but constructive
- Focus on what matters most
- Don't worry about accessibility yet
"""


def get_file_hash(filepath):
    """Calculate SHA256 hash of a file."""
    if not os.path.exists(filepath):
        return None

    with open(filepath, 'rb') as f:
        return hashlib.sha256(f.read()).hexdigest()


def load_design_history():
    """Load the design history tracking file."""
    if not os.path.exists(DESIGN_HISTORY_FILE):
        return {
            'last_run': None,
            'files': {}
        }

    with open(DESIGN_HISTORY_FILE, 'r') as f:
        return json.load(f)


def save_design_history(history):
    """Save the design history tracking file."""
    with open(DESIGN_HISTORY_FILE, 'w') as f:
        json.dump(history, f, indent=2)


def get_changed_files(full_analysis=False):
    """
    Get list of files that have changed since last run.
    If full_analysis=True or first run, return all files.
    """
    history = load_design_history()
    changed_files = []

    # First run or full analysis requested
    if full_analysis or history['last_run'] is None:
        print("🔍 Running full analysis (first run or --full flag)")
        return FRONTEND_FILES

    # Check each file for changes
    for filepath in FRONTEND_FILES:
        current_hash = get_file_hash(filepath)
        previous_hash = history['files'].get(filepath)

        if current_hash != previous_hash:
            changed_files.append(filepath)
            print(f"📝 Detected changes in: {filepath}")

    return changed_files


def read_file_content(filepath):
    """Read and return file content."""
    if not os.path.exists(filepath):
        return None

    with open(filepath, 'r', encoding='utf-8') as f:
        return f.read()


def read_milestones():
    """Read the MILESTONES.md file for context."""
    return read_file_content(MILESTONES_FILE)


def analyze_with_sunny(files_to_analyze):
    """
    Send files to Sunny (GPT-4o) for design analysis.
    """
    print(f"\n💭 Sunny is analyzing {len(files_to_analyze)} file(s)...")

    # Read all file contents
    file_contents = {}
    for filepath in files_to_analyze:
        content = read_file_content(filepath)
        if content:
            file_contents[filepath] = content

    # Read milestones for context
    milestones = read_milestones()

    # Construct the analysis prompt
    user_prompt = f"""Please analyze these DailyJams frontend files and provide your expert design suggestions.

## Project Context
Here's the project roadmap to understand the vision:

{milestones[:3000]}  # First 3000 chars to save tokens

## Files to Analyze

"""

    for filepath, content in file_contents.items():
        user_prompt += f"\n### {filepath}\n```\n{content[:5000]}\n```\n"  # Limit each file to 5000 chars

    user_prompt += """

Please provide your analysis following your structured format. Remember:
- Functionality is sacred - never suggest changes that could break features
- Be specific with code snippets
- Prioritize by impact
- Focus on layout, colors, typography, spacing, and UX flow
- You can be opinionated about the brand vision
"""

    # Call OpenAI API
    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # Using GPT-4o for visual understanding
            messages=[
                {"role": "system", "content": SUNNY_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt}
            ],
            temperature=0.7,
            max_tokens=4000
        )

        return response.choices[0].message.content

    except Exception as e:
        print(f"❌ Error calling OpenAI API: {str(e)}")
        return None


def append_to_suggestions_file(analysis_content):
    """Append Sunny's analysis to DESIGN_SUGGESTIONS.md"""

    # Create header for this analysis session
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    header = f"""
---

# Design Review Session: {timestamp}

"""

    # Read existing content or create new file
    existing_content = ""
    if os.path.exists(SUGGESTIONS_FILE):
        existing_content = read_file_content(SUGGESTIONS_FILE)
    else:
        # Create initial file with intro
        existing_content = """# DailyJams Design Suggestions
## By Sunny, Design Consultant

This document contains design recommendations from Sunny, our perfectionist UX/UI consultant.
Each section represents a design review session with timestamped suggestions.

**Remember:** Functionality always takes priority over aesthetics.

"""

    # Append new analysis
    full_content = existing_content + header + analysis_content + "\n"

    with open(SUGGESTIONS_FILE, 'w', encoding='utf-8') as f:
        f.write(full_content)

    print(f"✅ Suggestions written to {SUGGESTIONS_FILE}")


def update_file_hashes():
    """Update the design history with current file hashes."""
    history = load_design_history()
    history['last_run'] = datetime.now().isoformat()

    for filepath in FRONTEND_FILES:
        file_hash = get_file_hash(filepath)
        if file_hash:
            history['files'][filepath] = file_hash

    save_design_history(history)
    print(f"✅ Updated design history: {DESIGN_HISTORY_FILE}")


def main():
    """Main execution function."""
    print("🌞 Sunny - DailyJams Design Consultant")
    print("=" * 50)

    # Check for --full flag
    full_analysis = '--full' in sys.argv

    # Get files to analyze
    files_to_analyze = get_changed_files(full_analysis=full_analysis)

    if not files_to_analyze:
        print("\n✨ No changes detected since last run!")
        print("💡 Use --full flag to run a complete analysis anyway")
        return

    print(f"\n📋 Files to analyze: {len(files_to_analyze)}")
    for f in files_to_analyze:
        print(f"   - {f}")

    # Run analysis with Sunny
    analysis = analyze_with_sunny(files_to_analyze)

    if analysis:
        print("\n✨ Analysis complete!")
        print(f"📊 Estimated tokens used: ~{len(analysis.split())}")

        # Append to suggestions file
        append_to_suggestions_file(analysis)

        # Update file hashes
        update_file_hashes()

        print(f"\n💡 Check {SUGGESTIONS_FILE} for Sunny's recommendations!")
        print("🎨 Implement suggestions that align with your vision")
        print("⚠️  Always test functionality after design changes")
    else:
        print("\n❌ Analysis failed. Check error messages above.")
        sys.exit(1)


if __name__ == '__main__':
    main()
