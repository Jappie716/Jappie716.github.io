import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, where, onSnapshot, serverTimestamp, updateDoc, deleteDoc, increment } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

const BINGO_ROOM_ID = "bingo-club-main";
const PRIZES = ["Een zak pruimen 🍑", "Ere-buurtwacht titel 🎖️", "Gratis kopje koffie bij de buren ☕", "De Gouden Rollator 🏆"];

let currentUserProfile = null;
let myCard = [];
let drawnNumbers = [];
let isReady = false;
let countdownActive = false;

// --- AUTH LOGICA (Redirect naar index als niet ingelogd) ---
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        // NIET ingelogd? Direct terug naar index.html
        window.location.href = 'index.html';
        return;
    }

    // WEL ingelogd? Check of we een profiel hebben
    const snap = await getDoc(doc(db, "users", user.uid));
    if (snap.exists()) {
        currentUserProfile = snap.data();
        startApp(); // Sla inlogscherm over
    } else {
        // Wel account maar geen profiel? Toon onboarding.
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('login-form').classList.add('hidden');
        document.getElementById('onboarding-form').classList.remove('hidden');
    }
});

function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
    
    initBingoLobby();
    initBingoGame();
    lucide.createIcons();
}

// --- LOBBY & TIMER LOGICA ---
function initBingoLobby() {
    const readyBtn = document.getElementById('ready-btn');
    
    readyBtn.onclick = async () => {
        isReady = !isReady;
        readyBtn.innerText = isReady ? "Ik ben er NIET klaar voor" : "Ik ben er klaar voor!";
        readyBtn.classList.toggle('active', isReady);
        
        // Update status in database
        await setDoc(doc(db, "bingo_lobby", auth.currentUser.uid), {
            username: currentUserProfile.username,
            ready: isReady,
            time: serverTimestamp()
        });
    };

    // Luister naar spelers en game status
    onSnapshot(collection(db, "bingo_lobby"), (snapshot) => {
        const list = document.getElementById('lobby-players');
        list.innerHTML = "";
        let readyCount = 0;
        let totalCount = 0;

        snapshot.forEach(doc => {
            const p = doc.data();
            totalCount++;
            if(p.ready) readyCount++;
            list.innerHTML += `<div class="player-chip ${p.ready ? 'ready' : ''}">${p.username} ${p.ready ? '✅' : '⏳'}</div>`;
        });

        // Als iedereen klaar is (of meer dan 1 speler en iedereen heeft 'Ja' gezegd)
        // In dit voorbeeld starten we als er minimaal 1 iemand is en status verandert naar 'starting'
        // Je kunt hier ook 'readyCount === totalCount' gebruiken.
    });

    // Luister naar de Game Status voor de 20s timer
    onSnapshot(doc(db, "bingo_game", BINGO_ROOM_ID), (docSnap) => {
        if (!docSnap.exists()) return;
        const data = docSnap.data();

        if (data.status === 'starting' && !countdownActive) {
            startStartingCountdown();
        } else if (data.status === 'active') {
            openGame();
        }
    });
}

function startStartingCountdown() {
    countdownActive = true;
    const timerDiv = document.getElementById('countdown-timer');
    const secondsSpan = document.getElementById('timer-seconds');
    timerDiv.classList.remove('hidden');

    let seconds = 20;
    const interval = setInterval(() => {
        seconds--;
        secondsSpan.innerText = seconds;
        if (seconds <= 0) {
            clearInterval(interval);
            openGame();
        }
    }, 1000);
}

function openGame() {
    document.getElementById('bingo-lobby').classList.add('hidden');
    document.getElementById('game-container').classList.remove('hidden');
    if (myCard.length === 0) generateCard();
}

// --- GAME LOGICA ---
function generateCard() {
    const grid = document.getElementById('bingo-card');
    grid.innerHTML = "";
    myCard = [];
    const nums = Array.from({length: 75}, (_, i) => i + 1).sort(() => Math.random() - 0.5).slice(0, 25);
    
    nums.forEach(n => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell';
        cell.innerText = n;
        cell.onclick = () => cell.classList.toggle('marked');
        grid.appendChild(cell);
        myCard.push({val: n, marked: false});
    });
}

function initBingoGame() {
    onSnapshot(doc(db, "bingo_game", BINGO_ROOM_ID), (docSnap) => {
        if(!docSnap.exists()) return;
        const data = docSnap.data();
        
        // Update getrokken nummers
        const drawn = data.drawnNumbers || [];
        document.getElementById('drawn-count').innerText = drawn.length;
        document.getElementById('last-number').innerText = data.lastDrawn || "--";
        
        const drawnContainer = document.getElementById('drawn-numbers');
        drawnContainer.innerHTML = drawn.map(n => `<span class="mini-ball">${n}</span>`).join("");
        
        if (data.winner) {
            showWinner(data.winner, data.prize);
        }
    });
}

// --- ADMIN / DRAW ---
document.getElementById('draw-number-btn').onclick = async () => {
    const gameRef = doc(db, "bingo_game", BINGO_ROOM_ID);
    const snap = await getDoc(gameRef);
    const data = snap.data() || { drawnNumbers: [] };
    
    let next;
    do { next = Math.floor(Math.random() * 75) + 1; } 
    while (data.drawnNumbers.includes(next));

    await updateDoc(gameRef, {
        drawnNumbers: [...data.drawnNumbers, next],
        lastDrawn: next,
        status: 'active'
    });
};

window.claimBingo = () => {
    // Simpele check: heb je gewonnen?
    alert("Bingo geclaimd! De spelleider controleert je kaart...");
};

function showWinner(name, prize) {
    const announcement = document.getElementById('winner-announcement');
    announcement.classList.remove('hidden');
    announcement.querySelector('.winner-name').innerText = `🎉 ${name} wint!`;
    announcement.querySelector('.winner-prize').innerText = prize;
}

window.closeBingoModal = () => document.getElementById('bingo-modal').classList.add('hidden');
