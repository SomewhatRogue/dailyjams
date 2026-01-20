/* ===================================
   ONBOARDING MANAGER - DAILYJAMS
   Spotlight walkthrough system
   =================================== */

class OnboardingManager {
    constructor() {
        this.steps = [
            {
                id: 'vibe-input',
                target: '#mood',
                title: 'Describe Your Vibe',
                description: 'Start by typing how you want to feel. Words like "energetic", "chill", "focused", or "melancholic" work great. This is the heart of Daily Jams.',
                position: 'below'
            },
            {
                id: 'discovery-arc',
                target: '.discovery-arc-section',
                title: 'Discovery Level',
                description: 'Slide toward the sun for familiar artists you might know. Slide toward the moon for totally new discoveries.',
                position: 'below'
            },
            {
                id: 'genres',
                target: '[data-section="genres"]',
                title: 'Pick Your Genres',
                description: 'Expand this to select genres you want. Leave it empty and we\'ll explore everything.',
                position: 'below'
            },
            {
                id: 'discover-button',
                target: '#submit-btn',
                title: 'Start Discovering',
                description: 'Hit this button to get personalized music recommendations based on your vibe and preferences.',
                position: 'above'
            },
            {
                id: 'completion',
                target: null,
                title: "You're All Set!",
                description: "That's it! Describe your vibe, tweak the settings if you want, then discover. After you get recommendations, you can swipe through them and build Spotify playlists. Have fun exploring!",
                position: 'center'
            }
        ];

        this.currentStep = 0;
        this.isActive = false;
        this.overlay = null;
        this.spotlight = null;
        this.tooltip = null;
        this.triggerBtn = null;

        this.init();
    }

    init() {
        this.createOverlay();
        this.bindEvents();
        this.checkAutoStart();
        this.updateTriggerButton();
    }

    createOverlay() {
        // Create overlay container
        this.overlay = document.createElement('div');
        this.overlay.className = 'onboarding-overlay';
        this.overlay.setAttribute('role', 'dialog');
        this.overlay.setAttribute('aria-modal', 'true');
        this.overlay.innerHTML = `
            <div class="onboarding-backdrop"></div>
            <div class="onboarding-spotlight hidden"></div>
            <div class="onboarding-tooltip hidden">
                <div class="tooltip-step"></div>
                <h3 class="tooltip-title" id="tooltip-title"></h3>
                <p class="tooltip-description" id="tooltip-description"></p>
                <div class="tooltip-buttons">
                    <button class="tooltip-btn tooltip-btn-skip">Skip Tour</button>
                    <button class="tooltip-btn tooltip-btn-next">
                        Next
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="m9 18 6-6-6-6"/>
                        </svg>
                    </button>
                </div>
                <div class="tooltip-progress"></div>
            </div>
        `;

        document.body.appendChild(this.overlay);

        this.spotlight = this.overlay.querySelector('.onboarding-spotlight');
        this.tooltip = this.overlay.querySelector('.onboarding-tooltip');

        // Find trigger button (added by template)
        this.triggerBtn = document.querySelector('.onboarding-trigger-btn');
    }

    bindEvents() {
        // Backdrop click
        const backdrop = this.overlay.querySelector('.onboarding-backdrop');
        backdrop.addEventListener('click', () => this.skipTour());

        // Button clicks
        this.overlay.querySelector('.tooltip-btn-skip').addEventListener('click', () => this.skipTour());
        this.overlay.querySelector('.tooltip-btn-next').addEventListener('click', () => this.nextStep());

        // Keyboard navigation
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));

        // Trigger button
        if (this.triggerBtn) {
            this.triggerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.start();
            });
        }

        // Window resize - recalculate positions
        window.addEventListener('resize', () => {
            if (this.isActive) {
                this.showStep(this.currentStep);
            }
        });
    }

    handleKeyboard(e) {
        if (!this.isActive) return;

        switch (e.key) {
            case 'Escape':
                this.skipTour();
                break;
            case 'Enter':
            case ' ':
                if (document.activeElement.classList.contains('tooltip-btn-next')) {
                    this.nextStep();
                } else if (document.activeElement.classList.contains('tooltip-btn-skip')) {
                    this.skipTour();
                }
                break;
            case 'Tab':
                // Trap focus within tooltip
                this.trapFocus(e);
                break;
        }
    }

    trapFocus(e) {
        const focusableElements = this.tooltip.querySelectorAll('button');
        const firstElement = focusableElements[0];
        const lastElement = focusableElements[focusableElements.length - 1];

        if (e.shiftKey && document.activeElement === firstElement) {
            e.preventDefault();
            lastElement.focus();
        } else if (!e.shiftKey && document.activeElement === lastElement) {
            e.preventDefault();
            firstElement.focus();
        }
    }

    checkAutoStart() {
        const completed = localStorage.getItem('onboardingComplete');
        const skipped = localStorage.getItem('onboardingSkipped');

        if (!completed && !skipped) {
            // Auto-start after a short delay for first-time users
            setTimeout(() => {
                this.start();
            }, 1500);
        }
    }

    updateTriggerButton() {
        if (!this.triggerBtn) return;

        const completed = localStorage.getItem('onboardingComplete');
        if (completed) {
            this.triggerBtn.classList.add('completed');
        }
    }

    start() {
        this.currentStep = 0;
        this.isActive = true;
        this.overlay.classList.add('active');
        this.spotlight.classList.remove('hidden');
        this.tooltip.classList.remove('hidden');

        this.showStep(0);
    }

    showStep(index) {
        const step = this.steps[index];
        if (!step) return;

        // Update step indicator
        this.tooltip.querySelector('.tooltip-step').textContent = `Step ${index + 1} of ${this.steps.length}`;
        this.tooltip.querySelector('.tooltip-title').textContent = step.title;
        this.tooltip.querySelector('.tooltip-description').textContent = step.description;

        // Update button text for last step
        const nextBtn = this.tooltip.querySelector('.tooltip-btn-next');
        if (index === this.steps.length - 1) {
            nextBtn.innerHTML = `
                Let's Go!
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M20 6 9 17l-5-5"/>
                </svg>
            `;
        } else {
            nextBtn.innerHTML = `
                Next
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="m9 18 6-6-6-6"/>
                </svg>
            `;
        }

        // Update progress dots
        this.updateProgressDots(index);

        // Position spotlight and tooltip
        if (step.target) {
            const targetElement = document.querySelector(step.target);
            if (targetElement) {
                // Scroll element into view FIRST, then position after scroll completes
                this.scrollToElementAndPosition(targetElement, step.position);
                this.spotlight.classList.remove('hidden');
            } else {
                // Target not found, skip to center
                this.spotlight.classList.add('hidden');
                this.positionTooltipCenter();
            }
        } else {
            // No target (completion step)
            this.spotlight.classList.add('hidden');
            this.positionTooltipCenter();
        }

        // Focus management
        setTimeout(() => {
            this.tooltip.querySelector('.tooltip-btn-next').focus();
        }, 400);
    }

    scrollToElementAndPosition(element, position) {
        // Scroll element into view first
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });

        // Wait for scroll to complete, then position
        // Using a timeout since scrollIntoView doesn't have a callback
        setTimeout(() => {
            this.positionSpotlight(element);
            this.positionTooltip(element, position);
        }, 350);
    }

    positionSpotlight(element) {
        const rect = element.getBoundingClientRect();
        const padding = 10;

        // Use viewport-relative positioning (fixed positioning in CSS)
        this.spotlight.style.top = `${rect.top - padding}px`;
        this.spotlight.style.left = `${rect.left - padding}px`;
        this.spotlight.style.width = `${rect.width + padding * 2}px`;
        this.spotlight.style.height = `${rect.height + padding * 2}px`;

        // Match border radius of target if applicable
        const computedStyle = window.getComputedStyle(element);
        this.spotlight.style.borderRadius = computedStyle.borderRadius || 'var(--radius-md)';
    }

    positionTooltip(targetElement, position) {
        const rect = targetElement.getBoundingClientRect();
        const tooltipRect = this.tooltip.getBoundingClientRect();
        const padding = 20;
        const arrowOffset = 15;

        // Remove all arrow classes
        this.tooltip.classList.remove('arrow-top', 'arrow-bottom', 'arrow-left', 'arrow-right', 'no-arrow');

        let top, left;

        // Use viewport-relative positioning (fixed positioning in CSS)
        switch (position) {
            case 'below':
                top = rect.bottom + arrowOffset;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                this.tooltip.classList.add('arrow-top');
                break;
            case 'above':
                top = rect.top - tooltipRect.height - arrowOffset;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                this.tooltip.classList.add('arrow-bottom');
                break;
            case 'right':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.right + arrowOffset;
                this.tooltip.classList.add('arrow-left');
                break;
            case 'left':
                top = rect.top + (rect.height / 2) - (tooltipRect.height / 2);
                left = rect.left - tooltipRect.width - arrowOffset;
                this.tooltip.classList.add('arrow-right');
                break;
            default:
                top = rect.bottom + arrowOffset;
                left = rect.left + (rect.width / 2) - (tooltipRect.width / 2);
                this.tooltip.classList.add('arrow-top');
        }

        // Keep tooltip within viewport
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        if (left < padding) left = padding;
        if (left + tooltipRect.width > viewportWidth - padding) {
            left = viewportWidth - tooltipRect.width - padding;
        }

        // Keep tooltip within vertical viewport
        if (top < padding) top = padding;
        if (top + tooltipRect.height > viewportHeight - padding) {
            top = viewportHeight - tooltipRect.height - padding;
        }

        this.tooltip.style.top = `${top}px`;
        this.tooltip.style.left = `${left}px`;
    }

    positionTooltipCenter() {
        this.tooltip.classList.add('no-arrow');

        const tooltipRect = this.tooltip.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const left = (viewportWidth - tooltipRect.width) / 2;
        const top = (viewportHeight - tooltipRect.height) / 2;

        this.tooltip.style.left = `${left}px`;
        this.tooltip.style.top = `${top}px`;
    }

    updateProgressDots(currentIndex) {
        const progressContainer = this.tooltip.querySelector('.tooltip-progress');
        progressContainer.innerHTML = this.steps.map((_, index) => {
            let className = 'progress-dot';
            if (index < currentIndex) className += ' completed';
            if (index === currentIndex) className += ' active';
            return `<div class="${className}"></div>`;
        }).join('');
    }

    nextStep() {
        if (this.currentStep < this.steps.length - 1) {
            this.currentStep++;
            this.showStep(this.currentStep);
        } else {
            this.complete();
        }
    }

    previousStep() {
        if (this.currentStep > 0) {
            this.currentStep--;
            this.showStep(this.currentStep);
        }
    }

    skipTour() {
        localStorage.setItem('onboardingSkipped', 'true');
        this.close();
    }

    complete() {
        localStorage.setItem('onboardingComplete', 'true');
        this.updateTriggerButton();
        this.close();
    }

    close() {
        this.isActive = false;
        this.overlay.classList.remove('active');
        this.spotlight.classList.add('hidden');
        this.tooltip.classList.add('hidden');

        // Return focus to trigger button
        if (this.triggerBtn) {
            this.triggerBtn.focus();
        }
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.onboardingManager = new OnboardingManager();
});
