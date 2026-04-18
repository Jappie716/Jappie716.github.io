import { navigateTo } from '../core/app.js';
import { state } from '../core/app.js';

export function renderSidebar() {
    return `
        <aside class="sidebar">
            <div class="sidebar-logo">🛡️ BuurtWacht</div>
            <nav>
                <button onclick="showTab('world')" class="nav-btn active" data-tab="world"><i data-lucide="map"></i> De Wijk</button>
                <button onclick="showTab('chat')" class="nav-btn" data-tab="chat"><i data-lucide="message-circle"></i> BuurtChat</button>
                <button onclick="showTab('huis')" class="nav-btn" data-tab="huis"><i data-lucide="home"></i> Mijn Huis</button>
                <button onclick="showTab('settings')" class="nav-btn" data-tab="settings"><i data-lucide="settings"></i> Instellingen</button>
            </nav>
            <div class="sidebar-footer">
                <div id="user-display-name">...</div>
            </div>
        </aside>
    `;
}

export function initSidebar() {
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.onclick = () => {
            const tab = btn.dataset.tab;
            document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            navigateTo(tab);
        };
    });
}

window.showTab = (id) => navigateTo(id);