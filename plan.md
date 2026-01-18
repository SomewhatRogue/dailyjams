# DailyJams - Swipe Discovery Feature Plan

## MVP Scope
Replace the current list-based recommendation display with a Tinder-style swipe card interface. Users see one card at a time from a batch of 5 recommendations, make quick decisions via swipe gestures (touch, mouse, or keyboard), and can request more batches while building a playlist across sessions.

## Non-Goals
- Cross-session exclusion (session resets when new preferences submitted)
- Animations beyond basic card movement and confetti
- Mobile app deployment
- Swipe history/undo functionality
- Custom songs-per-artist during swiping (defaults to 3, adjustable only in final playlist modal)

## User Story
As a music discoverer, I want to quickly evaluate artist recommendations with intuitive swipe gestures so that I can build a playlist faster without the cognitive load of seeing all options at once.

## Acceptance Criteria
- [ ] Submit preferences → See first card from batch of 5
- [ ] Swipe right adds artist to playlist candidates (persists across "Generate More")
- [ ] Swipe left marks artist as "pass" for current session only
- [ ] Swipe down opens sub-menu: Love / Skip for now / Not for me (each saves feedback, card dismissed)
- [ ] Swipe up triggers confetti animation
- [ ] All swipes work via: touch, mouse drag, and arrow keys
- [ ] After 5th card, show end card with "Generate More" and "Build Playlist" buttons
- [ ] "Generate More" excludes all seen artists this session (both passed and added)
- [ ] "Build Playlist" opens existing modal with accumulated artists
- [ ] Existing Starry Night design system preserved (colors, fonts, shadows, SVG icons)
- [ ] "Save for Later" removed from feedback flow

## Phase 1 Tasks

### 1. Backend Changes
- **Modify `/api/recommend` endpoint** to accept `excluded_artists` parameter (list of band names to exclude)
- **Session exclusion logic**: Merge `excluded_artists` with existing `excluded_bands` from feedback history
- **Return batch structure**: Response already returns list of recommendations, no change needed

### 2. Frontend HTML Structure
- **Hide existing results section** (`#results`) when swipe mode active
- **Create new swipe container** after form, before results:
  ```html
  <div id="swipe-discovery" class="swipe-container hidden">
    <div id="swipe-cards" class="swipe-cards-wrapper"></div>
    <div id="swipe-end-card" class="swipe-end-card hidden">
      <!-- Generate More / Build Playlist buttons -->
    </div>
  </div>
  ```
- **Card template structure**: Artist image, name, genre, description, match reason (no visible feedback buttons)
- **Down-swipe sub-menu overlay**: Positioned absolutely, appears on downward drag threshold

### 3. Frontend CSS (Swipe Cards)
- **Card stack positioning**: Cards stacked with z-index, top card interactive
- **Card dimensions**: Max 500px width, auto height, centered
- **Transform animations**: `translate()` and `rotate()` for swipe motion
- **Transition classes**: `.swipe-right`, `.swipe-left`, `.swipe-down`, `.swipe-up` with exit animations
- **Sub-menu styling**: Dark overlay, 3 buttons (Love/Skip/Not for me) using existing button styles
- **End card styling**: Matches recommendation card design, 2 prominent buttons
- **Confetti**: CSS-based particle animation (20-30 colored circles, random trajectories)
- **Preserve design tokens**: Use `--star-gold`, `--night-deep`, `--swirl-blue`, `--radius-lg`, `--shadow-glow`

### 4. Frontend JavaScript - State Management
- **New state variables**:
  ```javascript
  let currentBatch = [];           // Current 5 recommendations
  let currentCardIndex = 0;        // Which card is visible (0-4)
  let sessionExcluded = new Set(); // All artists seen this session
  let swipePlaylistCandidates = new Set(); // Artists swiped right (serialized {id, name})
  ```
- **Reset logic**: Clear session state when form submitted with new preferences
- **Accumulation logic**: `swipePlaylistCandidates` persists across batches

### 5. Frontend JavaScript - Swipe Detection
- **Touch events**:
  - `touchstart`: Record start position
  - `touchmove`: Update card transform in real-time
  - `touchend`: If threshold exceeded (>100px horizontal, >80px vertical), trigger action
- **Mouse events**: Mirror touch events (mousedown/mousemove/mouseup)
- **Keyboard events**:
  - Right arrow = swipe right
  - Left arrow = swipe left
  - Down arrow = show sub-menu
  - Up arrow = swipe up (confetti)
- **Visual feedback**: Card follows finger/mouse with slight rotation based on direction
- **Threshold detection**: Different thresholds for horizontal (150px) vs vertical (100px)

### 6. Frontend JavaScript - Swipe Actions
- **Swipe right**:
  1. Add `{id, name}` to `swipePlaylistCandidates`
  2. Add `band_name` to `sessionExcluded`
  3. Apply `.swipe-right` animation class
  4. Advance to next card after animation (300ms)

- **Swipe left**:
  1. Add `band_name` to `sessionExcluded`
  2. Apply `.swipe-left` animation class
  3. Advance to next card

- **Swipe down**:
  1. Show sub-menu overlay with 3 options
  2. Each option calls feedback API with appropriate type (positive/skipped/negative)
  3. Add to `sessionExcluded`
  4. Dismiss card and advance

- **Swipe up**:
  1. Trigger confetti animation (append particle divs, auto-remove after 2s)
  2. Continue showing same card (easter egg, doesn't dismiss)

### 7. Frontend JavaScript - Card Rendering
- **Display batch function**:
  1. Hide form, show swipe container
  2. Render all 5 cards stacked (only top visible)
  3. Attach event listeners to top card
  4. Show card counter: "1 / 5"

- **Advance card function**:
  1. Increment `currentCardIndex`
  2. Remove dismissed card from DOM
  3. If cards remain, update counter
  4. If all 5 done, show end card

### 8. End Card & Flow Control
- **End card buttons**:
  - "Generate More": Call `/api/recommend` with same preferences + `excluded_artists: Array.from(sessionExcluded)`, render new batch
  - "Build Playlist": Convert `swipePlaylistCandidates` to array, call existing `showPlaylistModal()` function

- **Form re-submission**: Clear session state, start fresh batch

### 9. Integration Points
- **Modify `displayRecommendations()`**: Add mode toggle - if swipe mode enabled, call `displaySwipeBatch()` instead
- **Reuse playlist modal**: No changes needed, already accepts array of `{id, name}` objects
- **Reuse feedback API**: Called from down-swipe sub-menu with existing `suggestion_id` and `feedback_type`

### 10. Testing Checklist
- [ ] Touch swipe on mobile device
- [ ] Mouse drag on desktop
- [ ] Arrow keys work in all directions
- [ ] Session exclusion prevents duplicates within session
- [ ] Playlist candidates persist across "Generate More"
- [ ] Form re-submission resets session state
- [ ] Confetti appears on up-swipe
- [ ] Sub-menu buttons save feedback correctly
- [ ] End card buttons navigate properly
- [ ] Design matches Starry Night theme

## Tech Stack
- **Frontend**: Vanilla JavaScript (existing setup)
- **Backend**: Flask (minimal changes to `/api/recommend`)
- **Styling**: CSS3 transforms and transitions
- **Data**: Session storage for swipe state, existing database for feedback

## Run Instructions
```bash
# No changes to run process
cd /home/kyle/projects/dailyjams/backend
python app.py
# Access at http://localhost:5000
```

## Technical Approach for Swipe Gestures

### Gesture Detection Strategy
Use event-based threshold detection rather than physics engine:

1. **Track delta from start**: Calculate `deltaX` and `deltaY` on each move event
2. **Apply transform live**: `card.style.transform = translate(deltaX, deltaY) rotate(deltaX * 0.1deg)`
3. **On release, check thresholds**:
   - `Math.abs(deltaX) > 150` → Horizontal swipe (right if positive, left if negative)
   - `Math.abs(deltaY) > 100 && Math.abs(deltaY) > Math.abs(deltaX)` → Vertical swipe
4. **Animate exit**: Add class with CSS transition, remove card after animation completes

### Sub-Menu Implementation
- Overlay positioned at `bottom: 0` when down-swipe detected (deltaY > 100)
- Three buttons in flexbox row
- Each button triggers feedback API, then dismisses both menu and card
- Click outside sub-menu cancels and resets card position

### Confetti Animation
- Append 25 `<div class="confetti-particle">` elements with random colors from design system
- CSS animation: `@keyframes confetti-fall` with random `translate()` and `rotate()` values
- Auto-remove particles after 2s via `setTimeout()`

## What to Keep vs Replace

### Keep (No Changes)
- Entire preferences form UI
- All backend recommendation logic
- Playlist modal and creation flow
- Spotify integration
- User management
- Collapsible sections
- Starry Night CSS variables and animations

### Replace
- `#results` section display logic (hide when swipe active)
- Feedback button UI (now triggered by gestures instead of visible buttons)
- Recommendation card layout (adapt for single-card swipe view)

### Add (New Components)
- Swipe container and card stack
- Gesture detection event handlers
- Session exclusion state management
- Sub-menu overlay for down-swipe
- End card with batch controls
- Confetti animation system
