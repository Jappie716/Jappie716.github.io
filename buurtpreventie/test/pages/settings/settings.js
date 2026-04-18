import { logout, showAuthScreen } from '../../core/app.js';

export function initSettings() {
    const darkToggle = document.getElementById('dark-toggle');
    const logoutBtn = document.getElementById('logout-btn');
    
    if (darkToggle) {
        darkToggle.onchange = (e) => {
            document.body.className = e.target.checked ? 'dark-mode' : 'light-mode';
        };
    }
    
    if (logoutBtn) {
        logoutBtn.onclick = async () => {
            await logout();
        };
    }
}