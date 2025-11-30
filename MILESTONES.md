# DailyJams MVP - Development Milestones

## Project Overview
DailyJams helps with music discovery based on current mood, time of day, and instrument preferences. The system uses ChatGPT to suggest bands based on user preferences and learns from feedback over time.

---

## Milestone 1: Project Foundation & Setup ✅ COMPLETE

**Goal:** Get development environment ready and project structure in place

**Tasks:**
- [x] Set up development environment (Python 3.9+, pip, virtualenv)
- [x] Install Git and configure GitHub
- [x] Initialize GitHub repository
- [x] Create .gitignore for Python projects
- [x] Create README.md with project description
- [x] Set up project structure (folders for backend, frontend, database)
- [x] Install core dependencies (Flask, OpenAI, python-dotenv)
- [x] Create requirements.txt file
- [x] Set up environment variables (.env file for ChatGPT API key)
- [x] Make first commit and push to GitHub

---

## Milestone 2: Database Schema & Basic Backend

**Goal:** Set up data storage and create basic Flask application

**Tasks:**
- [ ] Design database schema
  - Tables: users, music_suggestions, user_feedback, source_preferences
  - Document schema in this file
- [ ] Create database initialization script (database.py)
  - SQLite connection functions
  - Functions to initialize tables
  - CRUD operations (Create, Read, Update, Delete)
- [ ] Build basic Flask application (app.py)
  - Flask initialization
  - Basic route for home page
  - Test server runs locally
- [ ] Create API handler for ChatGPT (api_handler.py)
  - Connect to ChatGPT API
  - Format user preferences into prompt
  - Test API connection
- [ ] Create data models
  - UserPreferences structure
  - MusicSuggestion structure
  - SourcePreferences structure

---

## Milestone 3: User Interface - Basic Input Form

**Goal:** Create the UI where users input music preferences

**Tasks:**
- [ ] Create HTML structure (index.html)
  - Form layout
  - Sections: time of day, mood, instruments, tempo slider
  - "Get Recommendations" button
- [ ] Add CSS styling (style.css)
  - Clean, simple design
  - Responsive layout
  - Style form elements
- [ ] Build time-of-day selector
  - Dropdown/button group (Morning, Afternoon, Evening, Night)
  - Optional auto-detect
- [ ] Build mood input
  - Text input or dropdown with common moods
  - Tag-style selection
- [ ] Create instrument toggle section
  - "Advanced Options" expandable section
  - Yes/no/neutral toggles for instruments
  - Common instruments: sax, violin, clarinet, guitar, piano, drums
- [ ] Create tempo slider
  - Range slider (slow to fast)
  - Display current value
  - Labels (Slow, Medium, Fast)

---

## Milestone 4: Source Management UI

**Goal:** Allow users to select which sources ChatGPT should research

**Tasks:**
- [ ] Design source preferences interface
  - "Settings" or "Sources" page/modal
  - List sources with toggle switches
- [ ] Define default music discovery sources
  - Research quality sources (Reddit subreddits, music blogs, RateYourMusic, etc.)
  - Create list of default source URLs/identifiers
- [ ] Create source toggle functionality
  - UI toggles for each source
  - Save preferences to database
  - Load saved preferences on page load
- [ ] Add source descriptions
  - Brief description for each source
  - Help users understand what each provides

---

## Milestone 5: Backend Logic - Preference to Prompt

**Goal:** Convert user inputs into effective ChatGPT prompts

**Tasks:**
- [ ] Create prompt engineering module
  - Convert preferences to ChatGPT prompt
  - Include time of day, mood, instruments, tempo
- [ ] Integrate source preferences into prompt
  - Add selected sources to prompt
  - Instruct ChatGPT to research from specific sources
- [ ] Format prompt for optimal results
  - Structure for band names, descriptions, and match reasons
  - Request structured output (JSON or formatted text)
- [ ] Add error handling
  - Handle missing/incomplete inputs
  - Handle API failures gracefully
  - Add retry logic
- [ ] Test prompt variations
  - Create test cases with different combinations
  - Refine based on result quality

---

## Milestone 6: Recommendation Display

**Goal:** Show ChatGPT's suggestions in an organized way

**Tasks:**
- [ ] Design recommendation results layout
  - Card-based or list-based layout
  - Show: band name, genre, description
  - Show why it matches preferences
- [ ] Create results page/section
  - HTML template for displaying results
  - Style for readability
  - Loading state during API response
- [ ] Implement AJAX for recommendations
  - JavaScript to send form data to backend
  - Receive and display results without page reload
  - Loading spinner during API call
- [ ] Parse ChatGPT response
  - Extract band names and info
  - Handle various response formats
  - Store suggestions in database
- [ ] Add "no results" handling
  - Friendly message if no suggestions found
  - Option to adjust preferences and retry

---

## Milestone 7: User Feedback System

**Goal:** Allow users to rate suggestions and store feedback for learning

**Tasks:**
- [ ] Add feedback buttons to each suggestion
  - "Thumbs up" and "thumbs down" buttons
  - Or star rating system
  - Clear, easy-to-use design
- [ ] Create feedback submission endpoint
  - Flask route to receive feedback
  - Validate feedback data
  - Store in database with timestamp
- [ ] Link feedback to user preferences
  - Store original preference inputs with feedback
  - Create relationship between suggestion and feedback
- [ ] Build feedback retrieval system
  - Get user's feedback history
  - Aggregate positive/negative feedback
- [ ] Display feedback history (optional for MVP)
  - Simple page showing past suggestions and ratings
  - Allow users to review feedback

---

## Milestone 8: Learning System Foundation

**Goal:** Use feedback to improve future recommendations

**Tasks:**
- [ ] Create feedback analysis module
  - Analyze user's feedback patterns
  - Identify instruments/moods/tempos with positive feedback
  - Identify patterns with negative feedback
- [ ] Enhance prompt with user history
  - Include preference patterns in ChatGPT prompt
  - Tell ChatGPT about liked/disliked bands
  - Request suggestions aligned with positive patterns
- [ ] Build preference learning algorithm (simple version)
  - Weight instruments/moods based on feedback
  - Create "user profile" from aggregated feedback
  - Update profile after each feedback
- [ ] Test learning improvements
  - Verify recommendations improve after feedback
  - Create test scenarios to validate learning

---

## Milestone 9: Polish & User Experience

**Goal:** Make the app smooth, intuitive, and production-ready

**Tasks:**
- [ ] Add input validation
  - Validate form inputs on frontend
  - Validate on backend
  - Show helpful error messages
- [ ] Improve error messages
  - User-friendly messages
  - Suggestions for fixing errors
  - Clear styling
- [ ] Add loading states
  - Spinner while waiting for recommendations
  - Disable submit button during processing
  - Progress indicators
- [ ] Create user guide/help
  - Tooltips for UI elements
  - "How to Use" section
  - Examples of good preference combinations
- [ ] Optimize performance
  - Minimize API calls
  - Cache common results (optional)
  - Optimize database queries
- [ ] Mobile responsiveness
  - Ensure UI works on phone/tablet
  - Test all interactions on different screen sizes

---

## Milestone 10: Documentation & Deployment

**Goal:** Document everything and set up for local deployment

**Tasks:**
- [ ] Write comprehensive README
  - Installation instructions
  - How to set up API key
  - How to run the application
  - Troubleshooting section
- [ ] Create setup script
  - Bash script to automate setup
  - Install dependencies, create database, set up environment
- [ ] Document code
  - Add docstrings to all functions
  - Comment complex logic
  - Create inline documentation
- [ ] Create local deployment guide
  - Step-by-step instructions for Ubuntu VM
  - How to access from other devices on home network (optional)
  - How to start/stop the server
- [ ] GitHub documentation
  - Update repository README with project overview
  - Create CONTRIBUTING.md
  - Add screenshots of UI
- [ ] Create backup/restore procedures
  - Document database backup
  - How to restore from backup
  - How to export user data

---

## Day 1 Minimum Viable Product (MVP) Goal

**What we're building today:**
- ✅ Milestone 1: Project Foundation & Setup - COMPLETE
- Milestone 2: Database Schema & Basic Backend
- Milestone 3: User Interface - Basic Input Form
- Milestone 5: Backend Logic - Preference to Prompt
- Milestone 6: Recommendation Display

**End Result:** A working UI where you input mood/instruments/tempo, it sends to ChatGPT, and shows band suggestions.

---

## Future Enhancements (Post-MVP)

- Integration with Spotify/Apple Music APIs
- Social sharing of recommendations
- Playlist generation
- Community features (share your preferences/discoveries)
- Advanced learning algorithms (ML-based recommendation engine)
- Mobile app version
