import { auth, db } from '../../core/firebase-config.js';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { setDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { showMainApp, state } from '../../core/app.js';

export function initAuth() {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const saveProfileBtn = document.getElementById('save-profile-btn');
    
    if (loginBtn) {
        loginBtn.onclick = () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            signInWithEmailAndPassword(auth, email, password).catch(e => alert(e.message));
        };
    }
    
    if (registerBtn) {
        registerBtn.onclick = () => {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            createUserWithEmailAndPassword(auth, email, password).catch(e => alert(e.message));
        };
    }
    
    if (saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
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
        };
    }
}

export function showLoginForm() {
    document.getElementById('login-form').classList.remove('hidden');
    document.getElementById('onboarding-form').classList.add('hidden');
}

export function showOnboardingForm() {
    document.getElementById('login-form').classList.add('hidden');
    document.getElementById('onboarding-form').classList.remove('hidden');
}