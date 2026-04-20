import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, onSnapshot, serverTimestamp, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

/* ================= CONFIG ================= */

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

/* ================= STATE ================= */

let currentUserProfile = null;
let allPlayers = [];
let hasVoted = false;
let currentSpinner = null;
let canDraw = true;

/* ================= AUTH ================= */

onAuthStateChanged(auth, async (user) => {
    if (!user) return;

    const snap = await getDoc(doc(db, "users", user.uid));
    if (!snap.exists()) return;

    currentUserProfile = snap.data();
    startApp();

    document.getElementById('no-spinner-check').onchange = async (e) => {
        await updateDoc(doc(db, "players", auth.currentUser.uid), {
            wantsToSpin: !e.target.checked
        });
    };
});

/* ================= START ================= */

async function startApp() {
    hide("auth-screen");
    show("bingo-app");

    setText("user-display-name", "👤 " + currentUserProfile.username);

    await joinLobby();
    setupLobbyListeners();
    listen();
}

function setupLobbyListeners() {
    const startVoteBtn = document.getElementById("start-vote-btn");
    if (startVoteBtn) {
        startVoteBtn.addEventListener("click", () => {
            console.log("Start Stemmen geklikt");
        });
    }
}

/* ================= LOBBY ================= */

async function joinLobby() {
    await setDoc(doc(db, "players", auth.currentUser.uid), {
        username: currentUserProfile.username,
        joinedAt: serverTimestamp(),
        isSpinner: false,
        votedFor: null
    });
}

window.leave = async () => {
    await deleteDoc(doc(db, "players", auth.currentUser.uid));
    location.reload();
};

/* ================= LISTENERS ================= */

function listen() {

    // spelers
    onSnapshot(collection(db, "players"), snap => {
        allPlayers = [];

        snap.forEach(d => {
            const data = d.data();
            allPlayers.push({ uid: d.id, ...data });
        });

        renderPlayers();
        updateLobbyUI(allPlayers);
    });

    // gameState
    onSnapshot(doc(db, "game", "state"), snap => {
        if (!snap.exists()) return;

        const state = snap.data().state;

        if (state === "lobby") {
            show("bingo-lobby");
            hide("bingo-app");
        } else {
            hide("bingo-lobby");
            show("bingo-app");
        }
    });
}

/* ================= UI ================= */

function renderPlayers() {
    const list = document.getElementById("player-list");
    if (!list) return;

    list.innerHTML = "";

    allPlayers.forEach(p => {
        const li = document.createElement("li");
        li.innerText = "👤 " + p.username + (p.isSpinner ? " 🎯" : "");
        list.appendChild(li);
    });
}

function updateLobbyUI(players) {
    const list = document.getElementById("lobby-players-list");
    if (!list) return;
    list.innerHTML = "";
    players.forEach(p => {
        const div = document.createElement("div");
        div.className = "player-item";
        div.innerText = "👤 " + p.username + (p.wantsToSpin === false ? " (Kijkt toe)" : "");
        list.appendChild(div);
    });
}

function show(id) {
    document.getElementById(id)?.classList.remove("hidden");
}

function hide(id) {
    document.getElementById(id)?.classList.add("hidden");
}

function setText(id, text) {
    const el = document.getElementById(id);
    if (el) el.innerText = text;
}

function showMessage(msg) {
    console.log("📢", msg);
}

/* ================= VOTING ================= */

window.vote = async (targetUid) => {
    if (hasVoted) return;
    hasVoted = true;

    await updateDoc(doc(db, "players", auth.currentUser.uid), {
        votedFor: targetUid
    });
};

/* ================= DRAW ================= */

window.draw = async () => {
    if (!canDraw) return;

    const ref = doc(db, "game", "main");
    const snap = await getDoc(ref);
    if (!snap.exists()) return;

    const data = snap.data();
    let drawn = data.drawn || [];

    let pool = [];
    for (let i = 1; i <= 75; i++) {
        if (!drawn.includes(i)) pool.push(i);
    }

    if (pool.length === 0) return;

    const number = pool[Math.floor(Math.random() * pool.length)];

    await updateDoc(ref, {
        drawn: [...drawn, number],
        lastNumber: number
    });

    canDraw = false;
    setTimeout(() => canDraw = true, 4000);
};

/* ================= BINGO ================= */

window.claim = async () => {
    await updateDoc(doc(db, "game", "main"), {
        winner: currentUserProfile.username
    });
};
