import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= CONFIG ================= */

const firebaseConfig = { apiKey: "AIzaSyCKbHyMpd5Um3Zpo8BoODQ1_yYpB9EneE0", authDomain: "buurtpreventie-b74ad.firebaseapp.com", projectId: "buurtpreventie-b74ad", storageBucket: "buurtpreventie-b74ad.firebasestorage.app", messagingSenderId: "374517472678", appId: "1:374517472678:web:8d1b6ecf2c2699769ec367" };
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

/* ================= STATE ================= */

let currentUserProfile = null;
let allPlayers = [];
let hasVoted = false;
let currentSpinner = null;
let canDraw = true;

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {
    if (!user) {
        document.getElementById('auth-screen')?.classList.remove('hidden');
        return;
    }

    const snap = await getDoc(doc(db, "users", user.uid));

    if (!snap.exists()) {
        document.getElementById('onboarding-form')?.classList.remove('hidden');
        return;
    }

    currentUserProfile = snap.data();
    startApp();
});

/* ================= LOGIN ================= */

document.getElementById('login-btn')?.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    signInWithEmailAndPassword(auth, email, password)
        .catch(e => alert(e.message));
});

document.getElementById('register-btn')?.addEventListener('click', () => {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    createUserWithEmailAndPassword(auth, email, password)
        .catch(e => alert(e.message));
});

/* ================= PROFILE ================= */

document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    const username = document.getElementById('username').value.trim();
    if (!username) return alert("Naam invullen.");

    const profiel = {
        username,
        huisnummer: document.getElementById('huisnummer').value.trim(),
        leeftijd: document.getElementById('leeftijd').value,
        geslacht: document.getElementById('geslacht').value
    };

    await setDoc(doc(db, "users", auth.currentUser.uid), profiel);

    currentUserProfile = profiel;
    startApp();
});

/* ================= START ================= */

async function startApp() {
    document.getElementById('auth-screen')?.classList.add('hidden');
    document.getElementById('bingo-app')?.classList.remove('hidden');

    document.getElementById('user-display-name').innerText =
        "👤 " + currentUserProfile.username;

    await joinLobby();
    listenRealtime();
}

/* ================= JOIN ================= */

async function joinLobby() {
    await setDoc(doc(db, "players", auth.currentUser.uid), {
        username: currentUserProfile.username,
        joinedAt: serverTimestamp(),
        isSpinner: false,
        votedFor: null
    });
}

/* ================= LISTENERS ================= */

function listenRealtime() {

    // spelers
    onSnapshot(collection(db, "players"), (snap) => {
        allPlayers = [];

        snap.forEach(d => {
            allPlayers.push({
                uid: d.id,
                ...d.data()
            });
        });

        renderPlayers();
    });

    // game
    onSnapshot(doc(db, "game", "main"), (snap) => {
        if (!snap.exists()) return;

        const data = snap.data();
        currentSpinner = data.spinner;

        if (data.lastNumber) {
            document.getElementById('last-number').innerText = data.lastNumber;
        }
    });
}

/* ================= UI ================= */

function renderPlayers() {
    const list = document.getElementById('player-list');
    if (!list) return;

    list.innerHTML = '';

    allPlayers.forEach(p => {
        const li = document.createElement('li');
        li.innerText = "👤 " + p.username;

        if (p.isSpinner) {
            li.innerText += " 🎯";
        }

        list.appendChild(li);
    });
}

/* ================= VOTE ================= */

window.voteForPlayer = async (uid) => {
    if (hasVoted) return;
    hasVoted = true;

    await updateDoc(doc(db, "players", auth.currentUser.uid), {
        votedFor: uid
    });
};

/* ================= DRAW ================= */

window.drawNumber = async () => {
    if (!canDraw) return;

    const ref = doc(db, "game", "main");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    let drawn = data.drawnNumbers || [];

    let pool = [];
    for (let i = 1; i <= 75; i++) {
        if (!drawn.includes(i)) pool.push(i);
    }

    if (pool.length === 0) return alert("Alles is al getrokken");

    const number = pool[Math.floor(Math.random() * pool.length)];

    await updateDoc(ref, {
        drawnNumbers: [...drawn, number],
        lastNumber: number
    });

    canDraw = false;
    setTimeout(() => canDraw = true, 5000);
};

/* ================= BINGO ================= */

window.claimBingo = async () => {
    const ref = doc(db, "game", "main");

    await updateDoc(ref, {
        winner: currentUserProfile.username
    });

    alert("🎉 Bingo!");
};

/* ================= LEAVE ================= */

window.leave = async () => {
    await deleteDoc(doc(db, "players", auth.currentUser.uid));
    location.reload();
};
