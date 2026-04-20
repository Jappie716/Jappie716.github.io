import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATIE ---
const firebaseConfig = {
  apiKey: "AIzaSyCKbHyMpd5Um3Zpo8BoODQ1_yYpB9EneE0",
  authDomain: "buurtpreventie-b74ad.firebaseapp.com",
  projectId: "buurtpreventie-b74ad",
  storageBucket: "buurtpreventie-b74ad.firebasestorage.app",
  messagingSenderId: "374517472678",
  appId: "1:374517472678:web:8d1b6ecf2c2699769ec367"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUserProfile = null;

// Hulpfuncties
const getEmail = () => document.getElementById('email').value;
const getPassword = () => document.getElementById('password').value;

// --- DIT IS DE BELANGRIJKSTE FIX: Wacht tot de pagina geladen is ---
window.onload = () => {
    console.log("Systeem geactiveerd: Knoppen worden nu gekoppeld...");

    // Inlogknop
    const loginBtn = document.getElementById('login-btn');
    if(loginBtn) {
        loginBtn.onclick = () => {
            console.log("Inlogpoging gestart...");
            signInWithEmailAndPassword(auth, getEmail(), getPassword())
                .then(() => console.log("Inloggen gelukt!"))
                .catch(e => alert("Inloggen mislukt: " + e.message));
        };
    }

    // Registreerknop
    const registerBtn = document.getElementById('register-btn');
    if(registerBtn) {
        registerBtn.onclick = () => {
            console.log("Registratiepoging gestart...");
            createUserWithEmailAndPassword(auth, getEmail(), getPassword())
                .then(() => console.log("Registratie gelukt!"))
                .catch(e => alert("Registratie mislukt: " + e.message));
        };
    }

    // Uitlogknop
    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.onclick = () => signOut(auth);
    }
    
    // Profiel opslaan (Onboarding)
    const saveBtn = document.getElementById('save-profile-btn');
    if(saveBtn) {
        saveBtn.onclick = async () => {
            const profiel = {
                username: document.getElementById('username').value.trim(),
                huisnummer: document.getElementById('huisnummer').value.trim(),
                leeftijd: document.getElementById('leeftijd').value,
                darkMode: false
            };
            await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
            location.reload(); // Ververs om de app te starten
        };
    }
};

// --- AUTH STATUS CONTROLE ---
onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const onboardingForm = document.getElementById('onboarding-form');

    if (user) {
        console.log("Gebruiker herkend:", user.email);
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            currentUserProfile = snap.data();
            authScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
            initAppLogica();
        } else {
            // Geen profiel? Toon onboarding
            authScreen.classList.remove('hidden');
            loginForm.classList.add('hidden');
            onboardingForm.classList.remove('hidden');
        }
    } else {
        console.log("Geen gebruiker ingelogd.");
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
        loginForm.classList.remove('hidden');
        onboardingForm.classList.add('hidden');
    }
});

// Functie voor alles wat pas mag draaien als je bent ingelogd
function initAppLogica() {
    // Hier komen zaken als de chat en de kaart
    console.log("App logica geladen.");
    if (window.lucide) lucide.createIcons();
}
