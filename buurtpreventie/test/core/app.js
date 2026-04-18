import { auth, db } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

export const state = {
    currentUser: null,
    currentProfile: null,
    currentTab: 'world'
};

export function initApp() {
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            state.currentUser = user;
            const snap = await getDoc(doc(db, "users", user.uid));
            if (snap.exists()) {
                state.currentProfile = snap.data();
                navigateTo('world');
            } else {
                navigateTo('auth', { onboarding: true });
            }
        } else {
            navigateTo('auth');
        }
    });
}

export function navigateTo(tab, options = {}) {
    state.currentTab = tab;
    
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    const btn = document.querySelector(`.nav-btn[onclick*="${tab}"]`);
    if (btn) btn.classList.add('active');
    
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    const tabEl = document.getElementById(`${tab}-tab`);
    if (tabEl) {
        tabEl.classList.remove('hidden');
        updatePageTitle(tab);
    }
    
    window.dispatchEvent(new CustomEvent('tabChange', { detail: { tab, options } }));
}

export function updatePageTitle(tab) {
    const titles = { world: 'De Wijk', chat: 'BuurtChat', huis: 'Mijn Huis', settings: 'Instellingen', auth: 'Auth' };
    const el = document.getElementById('page-title');
    if (el) el.innerText = titles[tab] || tab.charAt(0).toUpperCase() + tab.slice(1);
}

export function showAuthScreen() {
    document.getElementById('auth-screen').classList.remove('hidden');
    document.getElementById('main-app').classList.add('hidden');
}

export function showMainApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = `👤 ${state.currentProfile.username}`;
}

export async function logout() {
    await signOut(auth);
}

export function showTab(id) {
    navigateTo(id);
}

export function enterRoom(roomName) {
    alert(`Welkom in de ${roomName}!`);
}

if (typeof window !== 'undefined') {
    window.showTab = (id) => navigateTo(id);
    window.enterRoom = (roomName) => alert(`Welkom in de ${roomName}!`);
}

export { navigateTo, updatePageTitle, showAuthScreen, showMainApp, state, logout, showTab, enterRoom };
