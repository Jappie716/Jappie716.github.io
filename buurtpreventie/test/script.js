import { app, auth, db } from './core/firebase-config.js';
import { state, initApp, navigateTo, showMainApp, showAuthScreen, updatePageTitle } from './core/app.js';
import { initDoorbellModal, listenForDoorbells } from './components/doorbell-modal.js';
import { initAuth } from './pages/auth/auth.js';
import { initWorld } from './pages/world/world.js';
import { initChat, sendChatMessage } from './pages/chat/chat.js';
import { initHuis } from './pages/huis/huis.js';
import { initSettings } from './pages/settings/settings.js';

let doorbellUnsubscribe = null;
let chatUnsubscribe = null;

window.showTab = (id) => navigateTo(id);
window.enterRoom = (roomName) => alert(`Welkom in de ${roomName}!`);
window.ringDoorbell = async (uid, name) => {
    const { ringDoorbell: ring } = await import('./components/doorbell-modal.js');
    ring(uid, name);
};

async function boot() {
    initAuth();
    initDoorbellModal();
    initSettings();
    
    window.addEventListener('tabChange', (e) => {
        const { tab } = e.detail;
        
        if (chatUnsubscribe) {
            chatUnsubscribe();
            chatUnsubscribe = null;
        }
        
        switch (tab) {
            case 'world':
                initWorld();
                break;
            case 'chat':
                chatUnsubscribe = initChat();
                const sendBtn = document.getElementById('send-chat-btn');
                if (sendBtn) sendBtn.onclick = sendChatMessage;
                break;
            case 'huis':
                initHuis();
                break;
        }
        
        updatePageTitle(tab);
    });
    
    state.currentUser = auth.currentUser;
    
    import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js").then(({ onAuthStateChanged }) => {
        onAuthStateChanged(auth, async (user) => {
            if (user) {
                const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                const { doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
                
                const snap = await getDoc(doc(db, "users", user.uid));
                if (snap.exists()) {
                    state.currentUser = user;
                    state.currentProfile = snap.data();
                    showMainApp();
                    doorbellUnsubscribe = listenForDoorbells();
                    initWorld();
                    lucide.createIcons();
                } else {
                    document.getElementById('login-form').classList.add('hidden');
                    document.getElementById('onboarding-form').classList.remove('hidden');
                }
            } else {
                showAuthScreen();
            }
        });
    });
    
    document.getElementById('login-btn').onclick = async () => {
        const { signInWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch (e) {
            alert(e.message);
        }
    };
    
    document.getElementById('register-btn').onclick = async () => {
        const { createUserWithEmailAndPassword } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        const email = document.getElementById('email').value;
        const password = document.getElementById('password').value;
        try {
            await createUserWithEmailAndPassword(auth, email, password);
        } catch (e) {
            alert(e.message);
        }
    };
    
    document.getElementById('save-profile-btn').onclick = async () => {
        const { setDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        const { doc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
        
        const profiel = {
            username: document.getElementById('username').value.trim(),
            straat: document.getElementById('straat').value.trim(),
            leeftijd: document.getElementById('leeftijd').value,
            geslacht: document.getElementById('geslacht').value
        };
        if (!profiel.username) return alert("Kies een gebruikersnaam!");
        
        await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
        state.currentProfile = profiel;
        showMainApp();
        doorbellUnsubscribe = listenForDoorbells();
        initWorld();
    };
    
    document.getElementById('logout-btn').onclick = async () => {
        const { signOut } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js");
        if (doorbellUnsubscribe) {
            doorbellUnsubscribe();
            doorbellUnsubscribe = null;
        }
        await signOut(auth);
    };
}

boot();