#!/usr/bin/env python3
"""
Sunny - DailyJams Design Consultant

A world-class UX/UI design expert specializing in premium, high-end web experiences.
Sunny analyzes the live application and source code to provide sophisticated design
improvements with a bias towards sleek, elegant, minimal aesthetics.

Usage:
    python design_consultant.py                    # Analyze changed files only
    python design_consultant.py --full             # Full analysis of all frontend files
    python design_consultant.py --no-screenshots   # Skip screenshot capture (code-only)

Features:
    - Live app navigation and screenshot analysis (requires selenium)
    - Learns from rejected suggestions to avoid redundancy
    - Tracks file changes to only analyze what's changed
    - Provides specific, implementable code snippets
    - Strong bias towards: clean design, no emojis, sophisticated colors

Requirements:
    - OpenAI API key in .env file
    - App running on http://localhost:5000 (for screenshots)
    - Optional: selenium + ChromeDriver for screenshots
"""

import os
import sys
import json
import hashlib
import base64
from datetime import datetime
from openai import OpenAI
from dotenv import load_dotenv
import time

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
SUNNY_SYSTEM_PROMPT = """You are Sunny, a world-class UX/UI design consultant specializing in premium, high-end web experiences.

## Your Expertise
- Expert-level knowledge of HTML, CSS, JavaScript, and modern web design
- Strong understanding of luxury brand identity and sophisticated user experience
- Deep appreciation for music discovery applications and mood-based interfaces
- Pragmatic perfectionist: beauty matters, but functionality is sacred

## Your Design Philosophy
You have an extremely strong bias towards:
- **Sleek, clean, minimal aesthetics** - Remove visual clutter ruthlessly
- **High-end, luxury feel** - Think Apple, Stripe, Linear - not generic startup
- **Sophisticated color palettes** - Muted, elegant tones; avoid overly saturated colors
- **Typography hierarchy** - Clear, intentional, sophisticated font choices
- **NO EMOJIS** - Emojis are cheap and undermine professionalism. Remove them.
- **Whitespace mastery** - Let elements breathe; avoid cramming
- **Subtle interactions** - Refined micro-interactions over flashy animations

You actively REJECT:
- Generic AI-first-pass creative (gradients everywhere, purple/blue defaults)
- Emoji overuse (they cheapen the experience)
- Overly playful or cutesy design elements
- Cookie-cutter SaaS aesthetics
- Excessive colors and visual noise

## CRITICAL: Accessibility & Readability Requirements
**NEVER sacrifice readability for aesthetics.** This is non-negotiable:

1. **Text Contrast is Sacred**
   - ALL text must have sufficient contrast with its background (WCAG AA minimum: 4.5:1 for body text, 3:1 for large text)
   - When changing a background color, you MUST explicitly update the text color to maintain contrast
   - Light backgrounds (#f5f5f5, #fff, etc.) require dark text (#333, #444, etc.)
   - Dark backgrounds (#2c3e50, #333, etc.) require light text (#fafafa, #fff, etc.)
   - NEVER assume text color will inherit correctly - always specify it explicitly

2. **Think Holistically About Color Changes**
   - Before suggesting a background color change, identify ALL text elements that will be affected
   - Provide explicit color values for: buttons, labels, headings, body text, placeholders
   - If changing button backgrounds from dark to light, change text from white to dark
   - Consider hover states, active states, and focus states

3. **Test Your Suggestions Mentally**
   - Before suggesting a change, visualize: "Can I read white text on a #f5f5f5 background?" → NO
   - If the answer is no, adjust your suggestion to include proper text colors
   - Err on the side of too much contrast rather than too little

4. **Common Mistakes to AVOID**
   - ❌ Changing `.btn-feedback { background: #f5f5f5; }` without adding `color: #333;`
   - ❌ Applying light gray backgrounds while leaving inherited white text
   - ❌ Focusing only on "minimal aesthetic" without ensuring readability
   - ❌ Suggesting sophisticated muted colors that render text invisible

Remember: A beautiful design that users can't read is a failed design. Accessibility is part of luxury design.

## Your Brand Vision for DailyJams
This should feel like a premium music discovery service for discerning listeners:
- **Elegant and refined** - Like a high-end audio equipment brand
- **Sophisticated simplicity** - Minimal but purposeful
- **Intimate and personal** - Quiet confidence, not loud and cheerful
- **Timeless** - Avoid trends; focus on lasting design principles
- **Professional yet warm** - Sophisticated warmth, not corporate coldness

Current problems you'll likely notice:
- Too many emojis throughout the site
- Generic purple gradient color scheme (very 2020 SaaS)
- Need more sophisticated color palette and typography

## Your Analysis Style
1. Analyze screenshots of the live application to see the actual rendered UI
2. Read code to understand the implementation details
3. Identify specific design issues with clear explanations
4. Provide actionable suggestions with code snippets that include BOTH background AND text colors
5. Prioritize suggestions by impact (focus on big wins)
6. Rate implementation complexity honestly
7. NEVER suggest changes that could break functionality OR readability
8. Focus on layout, colors, typography, spacing, and UX flow
9. Avoid animations/transitions for now (they can break things)
10. When you see the live app, be ruthless about removing emojis and improving the color scheme
11. **FOR EVERY COLOR CHANGE**: Verify text will be readable against the new background
12. **IN YOUR CODE SNIPPETS**: Always include explicit text color when changing backgrounds

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


def get_rejected_suggestions():
    """Extract rejected suggestions from DESIGN_SUGGESTIONS.md to avoid repeating them."""
    if not os.path.exists(SUGGESTIONS_FILE):
        return []

    content = read_file_content(SUGGESTIONS_FILE)
    if not content:
        return []

    rejected = []
    lines = content.split('\n')

    for i, line in enumerate(lines):
        if line.strip().startswith('#### [-]'):
            # Get the suggestion title
            title = line.replace('#### [-]', '').strip()

            # Try to get the "Why This Matters" or description
            description = ""
            for j in range(i + 1, min(i + 15, len(lines))):
                if lines[j].strip().startswith('- **Why This Matters:**'):
                    description = lines[j].replace('- **Why This Matters:**', '').strip()
                    break
                elif lines[j].strip().startswith('#### '):
                    break

            rejected.append({
                'title': title,
                'description': description
            })

    return rejected


def capture_screenshots():
    """
    Capture screenshots of the live application.
    Returns list of base64-encoded images or None if selenium not available.
    """
    try:
        from selenium import webdriver
        from selenium.webdriver.chrome.options import Options
        from selenium.webdriver.common.by import By
        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
    except ImportError:
        print("⚠️  Selenium not installed. Skipping screenshot capture.")
        print("💡 Install with: pip install selenium")
        print("📸 Sunny will analyze code only (without visual context)")
        return None

    print("\n📸 Capturing screenshots of live application...")

    # Setup headless Chrome
    chrome_options = Options()
    chrome_options.add_argument('--headless')
    chrome_options.add_argument('--no-sandbox')
    chrome_options.add_argument('--disable-dev-shm-usage')
    chrome_options.add_argument('--window-size=1920,1080')

    screenshots = []

    try:
        driver = webdriver.Chrome(options=chrome_options)

        # Pages to screenshot
        pages = [
            {'url': 'http://localhost:5000/', 'name': 'Home/Index Page'},
            {'url': 'http://localhost:5000/history', 'name': 'History Page'},
            {'url': 'http://localhost:5000/profile', 'name': 'Profile Page'},
        ]

        for page in pages:
            try:
                print(f"   Capturing: {page['name']}")
                driver.get(page['url'])
                time.sleep(2)  # Wait for page load

                # Take screenshot
                screenshot_data = driver.get_screenshot_as_base64()
                screenshots.append({
                    'name': page['name'],
                    'data': screenshot_data
                })

            except Exception as e:
                print(f"   ⚠️  Could not capture {page['name']}: {str(e)}")

        driver.quit()
        print(f"✅ Captured {len(screenshots)} screenshots")
        return screenshots

    except Exception as e:
        print(f"❌ Screenshot capture failed: {str(e)}")
        print("💡 Make sure:")
        print("   1. The app is running on http://localhost:5000")
        print("   2. Chrome/Chromium is installed")
        print("   3. ChromeDriver is installed and in PATH")
        return None


def analyze_with_sunny(files_to_analyze, screenshots=None):
    """
    Send files to Sunny (GPT-4o) for design analysis with optional screenshots.
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

    # Get rejected suggestions
    rejected = get_rejected_suggestions()

    # Construct the analysis prompt
    user_prompt = f"""Please analyze the DailyJams application and provide your expert design suggestions.

## Project Context
Here's the project roadmap to understand the vision:

{milestones[:3000]}  # First 3000 chars to save tokens

"""

    # Add rejected suggestions context
    if rejected:
        user_prompt += "\n## Previously Rejected Suggestions\n"
        user_prompt += "DO NOT suggest similar changes to these (user already decided against them):\n\n"
        for r in rejected[:10]:  # Limit to 10 most recent
            user_prompt += f"- {r['title']}: {r['description']}\n"
        user_prompt += "\n"

    # Add screenshot context
    if screenshots:
        user_prompt += f"\n## Live Application Screenshots\n"
        user_prompt += f"I'm providing {len(screenshots)} screenshots of the live application. "
        user_prompt += "Use these to see the actual rendered UI and make specific, visual design critiques.\n\n"

    user_prompt += "## Source Code Files\n\n"

    for filepath, content in file_contents.items():
        user_prompt += f"\n### {filepath}\n```\n{content[:5000]}\n```\n"  # Limit each file to 5000 chars

    user_prompt += """

Please provide your analysis following your structured format. Remember:
- Functionality is sacred - never suggest changes that could break features
- Be ruthlessly critical of emojis and generic color schemes
- Prioritize big visual wins (color scheme, typography, emoji removal)
- Be specific with code snippets
- Focus on achieving that sleek, high-end, elegant aesthetic

CRITICAL REMINDER - Text Contrast:
- EVERY time you suggest a background color change, you MUST also specify the text color
- Light backgrounds (#f5f5f5, #fff, #eee) need dark text (#333, #444, #555)
- Dark backgrounds (#2c3e50, #333, #1a1a1a) need light text (#fafafa, #fff, #e0e0e0)
- Never leave text color to "inherit" when changing backgrounds
- Include explicit color values in every CSS suggestion: background AND color
- Test mentally: "Can I read [text-color] on [background-color]?" before suggesting
"""

    # Build messages array with screenshots if available
    messages = [
        {"role": "system", "content": SUNNY_SYSTEM_PROMPT}
    ]

    # If we have screenshots, use vision capabilities
    if screenshots:
        content_parts = [{"type": "text", "text": user_prompt}]

        for screenshot in screenshots:
            content_parts.append({
                "type": "image_url",
                "image_url": {
                    "url": f"data:image/png;base64,{screenshot['data']}",
                    "detail": "high"
                }
            })
            content_parts.append({
                "type": "text",
                "text": f"\n^ Screenshot: {screenshot['name']}\n"
            })

        messages.append({"role": "user", "content": content_parts})
    else:
        messages.append({"role": "user", "content": user_prompt})

    # Call OpenAI API
    try:
        response = client.chat.completions.create(
            model="gpt-4o",  # Using GPT-4o for visual understanding
            messages=messages,
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

    # Check for flags
    full_analysis = '--full' in sys.argv
    no_screenshots = '--no-screenshots' in sys.argv

    # Get files to analyze
    files_to_analyze = get_changed_files(full_analysis=full_analysis)

    if not files_to_analyze:
        print("\n✨ No changes detected since last run!")
        print("💡 Use --full flag to run a complete analysis anyway")
        return

    print(f"\n📋 Files to analyze: {len(files_to_analyze)}")
    for f in files_to_analyze:
        print(f"   - {f}")

    # Capture screenshots (unless disabled)
    screenshots = None
    if not no_screenshots:
        screenshots = capture_screenshots()
        if screenshots:
            print(f"📸 Will analyze with {len(screenshots)} screenshots for visual context")
        else:
            print("📝 Proceeding with code-only analysis")

    # Run analysis with Sunny
    analysis = analyze_with_sunny(files_to_analyze, screenshots=screenshots)

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
