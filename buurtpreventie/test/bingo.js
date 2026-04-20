import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

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

let unsubscribePlayers = null;
let isRegisterMode = false;

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showPlayerList(snapshot) {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    
    const players = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.online !== false) {
            players.push({ id: doc.id, name: data.name });
        }
    });

    players.sort((a, b) => a.name.localeCompare(b.name, 'nl'));

    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.textContent = player.name;
        playerList.appendChild(div);
    });

    const startBtn = document.getElementById('start-voting-btn');
    startBtn.style.display = players.length >= 2 ? 'block' : 'none';
}

async function createOrUpdatePlayer(user) {
    const playerRef = doc(db, 'players', user.uid);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
        await setDoc(playerRef, {
            name: user.displayName || user.email.split('@')[0],
            email: user.email,
            canSpin: true,
            online: true,
            createdAt: serverTimestamp()
        });
    } else {
        await updateDoc(playerRef, {
            online: true,
            lastSeen: serverTimestamp()
        });
    }
}

function setupOptOutListener(user) {
    const checkbox = document.getElementById('opt-out-check');
    const playerRef = doc(db, 'players', user.uid);

    checkbox.addEventListener('change', async () => {
        await updateDoc(playerRef, {
            canSpin: !checkbox.checked
        });
    });
}

function showError(message) {
    document.getElementById('auth-error').textContent = message;
}

function updateAuthUI() {
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');
    const subtitle = document.querySelector('#auth-screen .subtitle');
    
    if (isRegisterMode) {
        loginBtn.textContent = 'Registreren';
        registerBtn.textContent = 'Al een account? Log in';
        subtitle.textContent = 'Maak een account aan';
    } else {
        loginBtn.textContent = 'Inloggen';
        registerBtn.textContent = 'Registreren';
        subtitle.textContent = 'Log in om te spelen';
    }
}

function initAuth() {
    const loginForm = document.getElementById('login-form');
    const emailInput = document.getElementById('email-input');
    const passwordInput = document.getElementById('password-input');
    const loginBtn = document.getElementById('login-btn');
    const registerBtn = document.getElementById('register-btn');

    registerBtn.addEventListener('click', () => {
        isRegisterMode = !isRegisterMode;
        showError('');
        updateAuthUI();
    });

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = emailInput.value.trim();
        const password = passwordInput.value;

        loginBtn.disabled = true;
        loginBtn.textContent = 'Even geduld...';
        showError('');

        try {
            if (isRegisterMode) {
                await createUserWithEmailAndPassword(auth, email, password);
            } else {
                await signInWithEmailAndPassword(auth, email, password);
            }
        } catch (error) {
            if (error.code === 'auth/invalid-credential') {
                showError('Verkeerd e-mailadres of wachtwoord');
            } else if (error.code === 'auth/email-already-in-use') {
                showError('Dit e-mailadres is al in gebruik');
            } else if (error.code === 'auth/weak-password') {
                showError('Wachtwoord moet minimaal 6 tekens zijn');
            } else {
                showError(error.message);
            }
            loginBtn.disabled = false;
            loginBtn.textContent = isRegisterMode ? 'Registreren' : 'Inloggen';
        }
    });

    onAuthStateChanged(auth, async (user) => {
        if (unsubscribePlayers) {
            unsubscribePlayers();
            unsubscribePlayers = null;
        }

        if (user) {
            await createOrUpdatePlayer(user);

            switchScreen('bingo-lobby');

            unsubscribePlayers = onSnapshot(
                collection(db, 'players'),
                (snapshot) => {
                    showPlayerList(snapshot);
                    const playerData = snapshot.docs.find(d => d.id === user.uid);
                    if (playerData) {
                        const checkbox = document.getElementById('opt-out-check');
                        checkbox.checked = !playerData.data().canSpin;
                    }
                },
                console.error
            );

            setupOptOutListener(user);
        } else {
            switchScreen('auth-screen');
        }
    });
}

initAuth();
