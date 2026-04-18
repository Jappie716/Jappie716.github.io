import { showLoginForm, showOnboardingForm } from './auth.js';

export function handleAuthView(options = {}) {
    if (options.onboarding) {
        showOnboardingForm();
    } else {
        showLoginForm();
    }
}