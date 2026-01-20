# Daily Jams Onboarding System - Design Specification

## Overview
A spotlight-based walkthrough system that introduces new users to Daily Jams' key features. Extends the Starry Night theme with glowing gold accents, smooth animations, and intuitive navigation.

## Visual Preview
**Open `/frontend/onboarding-mockup.html` in a browser to see live, interactive mockups of all states.**

---

## Design Philosophy

### Core Principles
1. **Attention Without Annoyance** - Shining button draws the eye but doesn't scream
2. **Focus Through Dimming** - Spotlight approach removes visual noise
3. **Starry Night Consistency** - Golden glows, night-sky gradients, familiar typography
4. **Progressive Disclosure** - 5 concise steps, not overwhelming
5. **Respects User Time** - Easy to skip, never auto-plays more than once

---

## Component Breakdown

### 1. Shining Button (Trigger)

**Location:** Header navigation, between "DailyJams" title and existing nav links

**Visual Design:**
- Gold gradient background (`--star-gold` to `--star-bright`)
- Rounded pill shape (`border-radius: 999px`)
- Icon: Concentric circles (target/ripple icon)
- Text: "Quick Start"

**Animations:**
1. **Pulse Glow** (2s infinite loop)
   - Scale: 1 → 1.05 → 1
   - Box-shadow intensity increases/decreases
   - Creates breathing effect

2. **Shine Sweep** (3s infinite loop)
   - Diagonal gradient overlay slides across button
   - Simulates light ray passing over surface
   - Pauses between sweeps for subtlety

**Interaction:**
- Hover: Stops animations, lifts button -2px
- Click: Starts onboarding tour
- After onboarding complete: Remains accessible but no animations

**Code Reference:**
```css
.onboarding-trigger-btn {
    animation: pulse-glow 2s ease-in-out infinite;
}

.onboarding-trigger-btn::after {
    animation: shine 3s ease-in-out infinite;
}
```

---

### 2. Overlay System

**Structure:**
```
.onboarding-overlay (fixed, full-screen, z-index: 9999)
  ├── .onboarding-backdrop (dimmed background)
  ├── .onboarding-spotlight (focused element highlight)
  └── .onboarding-tooltip (instructional card)
```

**Backdrop:**
- Color: `rgba(15, 23, 42, 0.92)` (night-darker with 92% opacity)
- Backdrop-filter: `blur(4px)` for depth
- Transition: 0.4s fade-in
- Click target: Clicking backdrop dismisses tour

**Spotlight:**
- Golden border: 3px solid `--star-gold`
- Box-shadow: `0 0 0 9999px rgba(15, 23, 42, 0.92)` creates cutout effect
- Inner glow: `inset 0 0 40px rgba(251, 191, 36, 0.15)`
- Pulse animation: 2s infinite, glow intensity varies
- Border-radius: Inherits from target element
- Transitions: 0.4s smooth when moving between steps

**Technical Approach:**
- Calculate target element's bounding box
- Position spotlight absolutely to match
- Allow interaction with spotlighted element (z-index layering)
- Recalculate on window resize

---

### 3. Tooltip Cards

**Visual Design:**
- Background: Night-sky gradient (`linear-gradient(135deg, var(--night-blue) 0%, var(--night-deep) 100%)`)
- Border: 2px solid `--star-gold`
- Border-radius: `--radius-lg` (16px)
- Max-width: 360px
- Padding: `--space-lg` (24px)
- Box-shadow: Multi-layer (depth + glow)

**Directional Arrow:**
- 20px rotated square with 2 borders
- Positioned based on tooltip placement
- Matches gradient background
- Border matches tooltip border (gold)

**Positioning Logic:**
1. Calculate available space around spotlighted element
2. Prefer: Below > Above > Right > Left
3. If viewport is constrained, center tooltip
4. Arrow points to center of spotlighted element

**Content Structure:**
```
[Step 1 of 5] ← Step indicator (gold, small)
Title ← Heading (star-bright, large, serif)
Description ← Body text (cream, readable line-height)
[Skip] [Next →] ← Action buttons
● ○ ○ ○ ○ ← Progress dots
```

**Typography:**
- Step indicator: 0.85em, 600 weight, gold
- Title: 1.4em, Playfair Display, star-bright, text-shadow
- Description: 1em, Inter, cream, 1.6 line-height
- Buttons: 0.95em, 600 weight

**Button Styles:**
- **Skip:** Transparent bg, blue border, muted text
- **Next/Done:** Gold gradient, dark text, glow shadow
- Icon: 18px Feather icon (arrow-right, check)

**Progress Dots:**
- Inactive: `rgba(96, 165, 250, 0.3)` (blue, faded)
- Active: `--star-gold` with glow
- Size: 8px diameter
- Spacing: 6px gap

**Entrance Animation:**
```css
@keyframes tooltip-enter {
    0% {
        opacity: 0;
        transform: translateY(20px) scale(0.9);
    }
    100% {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}
```
Duration: 0.4s, cubic-bezier bounce

---

## Walkthrough Steps

### Step 1: Vibe Input
**Target:** `#mood` (main vibe text input on index page)
**Title:** "Describe Your Vibe"
**Description:** "Start by typing how you want to feel. Use words like 'energetic', 'chill', 'focused', or 'melancholic'. This is the heart of Daily Jams."
**Tooltip Position:** Below input field
**Why Important:** This is the primary discovery mechanism - users must understand it

---

### Step 2: Discovery Arc
**Target:** `.discovery-arc-section` (sun-to-moon slider)
**Title:** "Discovery Level"
**Description:** "Slide left for familiar artists you might know. Slide right for totally new discoveries. The arc goes from sun (familiar) to moon (unknown)."
**Tooltip Position:** Right of arc (or below on mobile)
**Why Important:** Differentiates Daily Jams from other music apps

---

### Step 3: Swipe Cards
**Target:** `.swipe-cards-wrapper` (on discover.html page)
**Title:** "Swipe to Discover"
**Description:** "Swipe right (or click the green arrow) to add artists to your playlist. Swipe left to pass. Swipe down for more options like 'Already know this artist'."
**Tooltip Position:** Below card
**Why Important:** Core interaction model - must be immediately clear
**Note:** If user isn't on discover page, skip this step (or navigate to discover page before showing)

---

### Step 4: Build Playlist
**Target:** `.btn-create-playlist` (floating button) or `#quick-playlist-btn`
**Title:** "Create Your Playlist"
**Description:** "When you've added artists you like, click here to instantly create a Spotify playlist with their top tracks. Your discoveries become music."
**Tooltip Position:** Above button (since it's floating bottom-right)
**Why Important:** Explains the end goal - turning discoveries into playable music

---

### Step 5: Completion
**Target:** None (tooltip centered on screen)
**Title:** "You're All Set!"
**Description:** "That's it! You now know how to discover music on Daily Jams. Start by describing your vibe, adjust the discovery level, then swipe through artists. Have fun exploring!"
**Tooltip Position:** Centered
**Button:** "Let's Go!" (with checkmark icon)
**Special:** No spotlight - just backdrop and centered tooltip
**Why Important:** Positive reinforcement, clear next action

---

## Interaction Flow

### Trigger Scenarios
1. **First Visit (Auto-trigger):**
   - Check localStorage: `onboardingComplete !== 'true'`
   - Wait 1 second after page load
   - Auto-start tour

2. **Manual Trigger:**
   - User clicks "Quick Start" button
   - Always available in nav
   - Restarts tour from Step 1

3. **No Trigger:**
   - User has completed tour before
   - Or explicitly skipped it
   - Button still visible but doesn't auto-start

### Navigation Controls

**Next Button:**
- Advances to next step
- Updates progress dots
- Moves spotlight (0.4s animation)
- Tooltip fades out/in with new content

**Skip Tour Button:**
- Immediately closes overlay
- Sets localStorage: `onboardingSkipped = 'true'`
- Removes backdrop and spotlight
- Returns focus to page

**ESC Key:**
- Same behavior as "Skip Tour"
- Standard modal dismissal pattern

**Backdrop Click:**
- Same behavior as "Skip Tour"
- Clicking outside tooltip closes tour

**Progress Dots:**
- Visual indicator only (not clickable)
- Could be made clickable for step jumping (future enhancement)

### State Persistence

**localStorage Keys:**
- `onboardingComplete`: 'true' after completing all steps
- `onboardingSkipped`: 'true' if user skipped
- `onboardingLastStep`: (optional) resume capability

**Reset Mechanism:**
- Clicking "Quick Start" button always restarts
- No auto-trigger if completed/skipped
- Could add "Reset Tutorial" in settings (future)

---

## Animation Specifications

### Timing Functions
- **Ease:** General transitions (backdrop, spotlight movement)
- **Ease-in-out:** Looping animations (pulse, shine)
- **Cubic-bezier(0.34, 1.56, 0.64, 1):** Tooltip entrance (slight bounce)

### Duration Standards
- **Fast:** 0.2s (hover states, button feedback)
- **Medium:** 0.4s (spotlight movement, tooltip enter/exit)
- **Slow:** 0.6s (page-level transitions)
- **Loop:** 2s (pulse), 3s (shine)

### Reduced Motion Support
```css
@media (prefers-reduced-motion: reduce) {
    .onboarding-trigger-btn,
    .onboarding-spotlight,
    .onboarding-tooltip {
        animation: none !important;
        transition-duration: 0.01ms !important;
    }
}
```

---

## Accessibility Requirements

### Keyboard Navigation
- **Tab:** Cycles through tooltip buttons (Skip, Next)
- **Shift+Tab:** Reverse cycle
- **Enter/Space:** Activates focused button
- **ESC:** Closes overlay (same as Skip)

### Focus Management
1. When overlay opens: Move focus to first button (Skip or Next)
2. Trap focus within tooltip (no tabbing to background elements)
3. When overlay closes: Return focus to trigger button

### ARIA Attributes
```html
<div class="onboarding-overlay"
     role="dialog"
     aria-modal="true"
     aria-labelledby="tooltip-title"
     aria-describedby="tooltip-description">

  <div class="onboarding-tooltip">
    <h3 id="tooltip-title">Describe Your Vibe</h3>
    <p id="tooltip-description">Start by typing how you want to feel...</p>
  </div>
</div>
```

### Screen Reader Considerations
- Announce step number: "Step 1 of 5"
- Tooltip title is dialog label
- Description provides context
- Button labels are descriptive ("Skip Tour", "Next Step")

### Color Contrast
- Gold (`#fbbf24`) on dark (`#1f2937`): 8.2:1 (AAA)
- Cream (`#fef3c7`) on night-deep (`#1e293b`): 12.1:1 (AAA)
- All text meets WCAG AA minimum (4.5:1)

### Touch Targets
- Buttons: Minimum 44x44px tap target
- Backdrop dismissal: Large target (entire overlay)
- Mobile: Tooltip sized appropriately (min 320px width)

---

## Responsive Behavior

### Desktop (>768px)
- Tooltip max-width: 360px
- Spotlight follows desktop layout
- Arrow pointers work in all 4 directions
- Hover states active

### Tablet (768px - 480px)
- Tooltip max-width: 90vw
- Prefer below/above positions (not left/right)
- Touch events for dismissal

### Mobile (<480px)
- Tooltip max-width: calc(100vw - 32px)
- Always center horizontally
- Prefer below position
- Progress dots remain visible but smaller
- Button text may truncate gracefully

---

## Edge Cases & Error Handling

### Target Element Not Found
- If spotlight target doesn't exist: Skip that step
- Log warning to console (for debugging)
- Continue to next valid step

### Page Navigation Mid-Tour
- Onboarding pauses/closes if page changes
- Could resume on new page if step exists there
- Or restart tour on new page

### Viewport Too Small
- Tooltip centers on screen
- Arrow may be hidden if no room
- Minimum viewport: 320px width

### Long Descriptions
- Tooltip content scrolls if > viewport height
- Max-height: 80vh
- Scroll indicator (gradient fade) at bottom

---

## Implementation Checklist

### Phase 1: Core Structure
- [ ] Create `/static/css/onboarding.css`
- [ ] Create `/static/js/onboarding.js`
- [ ] Add trigger button to header navigation
- [ ] Build overlay HTML structure
- [ ] Implement spotlight positioning logic

### Phase 2: Styling
- [ ] Button shine + pulse animations
- [ ] Backdrop blur effect
- [ ] Tooltip gradient background
- [ ] Directional arrow pseudo-elements
- [ ] Progress dots

### Phase 3: Interaction
- [ ] Click handlers (Next, Skip, backdrop)
- [ ] Keyboard navigation (Tab, ESC)
- [ ] Step progression logic
- [ ] localStorage persistence
- [ ] Focus management

### Phase 4: Responsive
- [ ] Mobile tooltip sizing
- [ ] Touch event handling
- [ ] Viewport detection
- [ ] Position recalculation on resize

### Phase 5: Accessibility
- [ ] ARIA attributes
- [ ] Screen reader testing
- [ ] Keyboard-only testing
- [ ] Reduced motion support
- [ ] Color contrast verification

### Phase 6: Polish
- [ ] Animation timing tweaks
- [ ] Copy review (concise, helpful)
- [ ] Cross-browser testing
- [ ] Performance optimization
- [ ] Error handling

---

## Files to Create

### `/frontend/static/css/onboarding.css`
Contains all styles for:
- Shining button (pulse-glow, shine animations)
- Overlay (backdrop, spotlight, tooltip)
- Responsive breakpoints
- Accessibility overrides

### `/frontend/static/js/onboarding.js`
Contains OnboardingManager class:
```javascript
class OnboardingManager {
    constructor(steps) { }
    start() { }
    nextStep() { }
    previousStep() { }
    skipTour() { }
    calculateSpotlightPosition(target) { }
    calculateTooltipPosition(target) { }
    handleKeyboard(e) { }
    markComplete() { }
}
```

### `/frontend/templates/partials/onboarding.html`
HTML structure for overlay, can be included in base template:
```html
<div class="onboarding-overlay hidden" id="onboarding-overlay">
    <div class="onboarding-backdrop"></div>
    <div class="onboarding-spotlight"></div>
    <div class="onboarding-tooltip">
        <!-- Dynamic content -->
    </div>
</div>
```

### Step Configuration (JSON)
```javascript
const ONBOARDING_STEPS = [
    {
        id: 'vibe-input',
        target: '#mood',
        title: 'Describe Your Vibe',
        description: 'Start by typing how you want to feel...',
        position: 'below'
    },
    // ... more steps
];
```

---

## Copy Guidelines

### Tone
- **Friendly:** Conversational but not cutesy
- **Concise:** Max 2 sentences per tooltip
- **Actionable:** Focus on what user can do
- **Encouraging:** Positive reinforcement

### Avoid
- Jargon or technical terms
- Overly long explanations
- Apologetic language ("Sorry for interrupting")
- Corporate speak

### Good Examples
✓ "Swipe right to add artists to your playlist."
✓ "This slider controls how adventurous your recommendations are."
✓ "Click here to turn discoveries into a Spotify playlist."

### Bad Examples
✗ "Our proprietary algorithm leverages your input to..."
✗ "Please take a moment to familiarize yourself with..."
✗ "This feature allows you to..."

---

## Testing Scenarios

### User Flow Testing
1. **First-time user:** Auto-starts after 1s delay
2. **Returning user:** Doesn't auto-start, button available
3. **Skip early:** Marks as skipped, doesn't auto-start again
4. **Complete tour:** Marks as complete, button still clickable
5. **Mid-tour navigation:** Gracefully handles page changes

### Interaction Testing
1. Click Next through all steps
2. Click Skip on step 3
3. Press ESC on step 2
4. Click backdrop on step 4
5. Tab through buttons, activate with Enter
6. Resize window during tour
7. Try on mobile device (swipe/tap)

### Accessibility Testing
1. Navigate entire tour with keyboard only
2. Use screen reader (NVDA/JAWS/VoiceOver)
3. Enable reduced motion preference
4. Test color contrast in tools
5. Try on low-vision zoom settings

---

## Future Enhancements

### V2 Features (Not in Initial Release)
- **Step Jumping:** Click progress dots to skip to step
- **Tour Replay:** Button in settings to restart
- **Contextual Tips:** Mini-tooltips for specific features
- **Video Demos:** Embed short clips showing interactions
- **Personalization:** Different tours for different user types
- **Analytics:** Track which steps users skip/complete

### Potential Improvements
- Animate spotlight border with SVG path
- Add sound effects (optional, toggle-able)
- Confetti on completion
- Tour for advanced features (separate from onboarding)

---

## Summary

This onboarding system introduces Daily Jams' key features through a visually cohesive, non-intrusive tour. The shining button naturally draws attention, the spotlight system maintains focus, and the tooltip cards provide clear, concise guidance. All interactions respect the user's time and agency - they can skip, dismiss, or complete at their own pace.

The design extends the Starry Night theme seamlessly with golden glows, night-sky gradients, and smooth animations that feel magical without being overwhelming. Accessibility is built-in, not bolted-on, ensuring all users can benefit from the onboarding experience.

**View the mockup file (`/frontend/onboarding-mockup.html`) to see all states in action.**
