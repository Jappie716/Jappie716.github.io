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
const PRIZES = [
    "Een digitale pot pruimen 🍑",
    "Een virtueel goldenticket 🎫",
    "Een jaar gratis virtuele koffie ☕",
    "Een digitale bloem 🌷",
    "Een goldene bingo-bal 🏆",
    "Een emoji-kroon 👑",
    "Een digitaal feest 🎉",
    "Een buur-ambt 💼"
];

let currentUserProfile = null;
let isSpinner = false;
let bingoCard = [];
let markedNumbers = new Set();
let drawnNumbers = new Set();

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            currentUserProfile = snap.data();
            startBingoApp();
        } else {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('onboarding-form').classList.remove('hidden');
        }
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('bingo-app').classList.add('hidden');
    }
});

const getEmail = () => document.getElementById('email').value;
const getPassword = () => document.getElementById('password').value;

document.getElementById('login-btn').onclick = () => signInWithEmailAndPassword(auth, getEmail(), getPassword()).catch(e => alert(e.message));
document.getElementById('register-btn').onclick = () => createUserWithEmailAndPassword(auth, getEmail(), getPassword()).catch(e => alert(e.message));

document.getElementById('save-profile-btn').onclick = async () => {
    const profiel = {
        username: document.getElementById('username').value.trim(),
        huisnummer: document.getElementById('huisnummer').value.trim(),
        leeftijd: document.getElementById('leeftijd').value,
        geslacht: document.getElementById('geslacht').value,
        status: ""
    };
    if(!profiel.username) return alert("Kies een gebruikersnaam!");
    await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
    currentUserProfile = profiel;
    startBingoApp();
};

async function startBingoApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('bingo-app').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
    
    generateBingoCard();
    await joinBingoClub();
    listenToBingoRoom();
    lucide.createIcons();
}

function generateBingoCard() {
    const numbers = new Set();
    while(numbers.size < 24) {
        numbers.add(Math.floor(Math.random() * 75) + 1);
    }
    bingoCard = Array.from(numbers);
    bingoCard.splice(12, 0, "FREE"); // Free space in center
    
    const cardEl = document.getElementById('bingo-card');
    cardEl.innerHTML = '';
    
    bingoCard.forEach((num, index) => {
        const cell = document.createElement('div');
        cell.className = 'bingo-cell' + (num === "FREE" ? ' free-space marked' : '');
        cell.innerText = num === "FREE" ? "FREE" : num;
        cell.dataset.index = index;
        
        if (num !== "FREE") {
            cell.onclick = () => markNumber(num, cell);
        }
        
        cardEl.appendChild(cell);
    });
}

function markNumber(num, cell) {
    if (markedNumbers.has(num)) {
        markedNumbers.delete(num);
        cell.classList.remove('marked');
    } else {
        markedNumbers.add(num);
        cell.classList.add('marked');
    }
    checkForBingo();
}

function checkForBingo() {
    const cells = document.querySelectorAll('.bingo-cell');
    const marked = Array.from(cells).map((c, i) => c.classList.contains('marked') ? i : -1).filter(i => i !== -1);
    
    const winningCombos = [
        [0,1,2,3,4], [5,6,7,8,9], [10,11,12,13,14], [15,16,17,18,19], [20,21,22,23,24], // Rows
        [0,5,10,15,20], [1,6,11,16,21], [2,7,12,17,22], [3,8,13,18,23], [4,9,14,19,24], // Columns
        [0,6,12,18,24], [4,8,12,16,20] // Diagonals
    ];
    
    const hasBingo = winningCombos.some(combo => 
        combo.every(index => cells[index].classList.contains('marked'))
    );
    
    document.getElementById('bingo-btn').disabled = !hasBingo;
    return hasBingo;
}

async function joinBingoClub() {
    await setDoc(doc(db, "bingo_players", auth.currentUser.uid), {
        username: currentUserProfile.username,
        huisnummer: currentUserProfile.huisnummer,
        joinedAt: serverTimestamp(),
        isSpinner: false
    });
}

async function leaveBingoClub() {
    await deleteDoc(doc(db, "bingo_players", auth.currentUser.uid));
    window.location.href = 'index.html';
}

let unsubscribePlayers = null;
let unsubscribeGame = null;

function listenToBingoRoom() {
    // Listen to players in the bingo club
    unsubscribePlayers = onSnapshot(collection(db, "bingo_players"), (snapshot) => {
        const playerList = document.getElementById('player-list');
        playerList.innerHTML = '';
        
        let hasSpinner = false;
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const li = document.createElement('li');
            li.innerHTML = `👤 ${data.username}`;
            
            if (data.isSpinner) {
                li.classList.add('spinner');
                li.innerHTML += `<span class="spinner-badge">DRAAIER</span>`;
                hasSpinner = true;
            }
            
            playerList.appendChild(li);
        });
        
        // Check if we should be spinner
        const isCurrentUserSpinner = snapshot.docs.some(d => d.id === auth.currentUser.uid && d.data().isSpinner);
        
        if (isCurrentUserSpinner) {
            isSpinner = true;
            document.getElementById('spinner-controls').classList.remove('hidden');
            document.getElementById('player-info').classList.add('hidden');
        } else {
            isSpinner = false;
            document.getElementById('spinner-controls').classList.add('hidden');
            document.getElementById('player-info').classList.remove('hidden');
        }
        
        // If no spinner, anyone can become one
        if (!hasSpinner && !isSpinner) {
            document.getElementById('player-info').innerHTML += `
                <button onclick="becomeSpinner()" class="draw-btn" style="margin-top: 15px;">
                    🎰 Word de Draaier
                </button>
            `;
        }
    });
    
    // Listen to game state
    unsubscribeGame = onSnapshot(doc(db, "bingo_game", BINGO_ROOM_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            updateGameUI(data);
        }
    });
}

function updateGameUI(data) {
    // Update drawn numbers
    if (data.drawnNumbers) {
        drawnNumbers = new Set(data.drawnNumbers);
        document.getElementById('drawn-count').innerText = data.drawnNumbers.length;
        
        const container = document.getElementById('drawn-numbers');
        container.innerHTML = '';
        data.drawnNumbers.forEach(num => {
            const chip = document.createElement('span');
            chip.className = 'drawn-number-chip';
            chip.innerText = num;
            container.appendChild(chip);
        });
        
        // Mark numbers on our card
        document.querySelectorAll('.bingo-cell').forEach((cell, index) => {
            const num = bingoCard[index];
            if (num !== "FREE" && data.drawnNumbers.includes(num)) {
                cell.classList.add('marked');
                markedNumbers.add(num);
            }
        });
        
        checkForBingo();
    }
    
    // Show last drawn number
    if (data.lastDrawn) {
        document.getElementById('drawn-number-display').classList.remove('hidden');
        document.getElementById('last-drawn').innerText = data.lastDrawn;
    }
    
    // Show winner
    if (data.winner) {
        showWinner(data.winner, data.prize);
    }
    
    // Show prizes
    if (data.prizes) {
        const prizeList = document.getElementById('prize-list');
        prizeList.innerHTML = '';
        data.prizes.forEach((p, i) => {
            const li = document.createElement('li');
            li.innerHTML = `🏆 ${p.winner} - ${p.prize}`;
            prizeList.appendChild(li);
        });
    }
}

window.becomeSpinner = async () => {
    await updateDoc(doc(db, "bingo_players", auth.currentUser.uid), { isSpinner: true });
    await setDoc(doc(db, "bingo_game", BINGO_ROOM_ID), {
        drawnNumbers: [],
        lastDrawn: null,
        spinner: auth.currentUser.uid,
        winner: null,
        prize: null,
        prizes: [],
        createdAt: serverTimestamp()
    });
};

window.drawNumber = async () => {
    const gameDoc = await getDoc(doc(db, "bingo_game", BINGO_ROOM_ID));
    if (!gameDoc.exists()) return;
    
    const data = gameDoc.data();
    const availableNumbers = [...Array(75).keys()].map(n => n + 1).filter(n => !data.drawnNumbers.includes(n));
    
    if (availableNumbers.length === 0) {
        alert("Alle nummers zijn getrokken! Het spel is voorbij.");
        return;
    }
    
    const newNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    const newDrawnNumbers = [...(data.drawnNumbers || []), newNumber];
    
    await updateDoc(doc(db, "bingo_game", BINGO_ROOM_ID), {
        drawnNumbers: newDrawnNumbers,
        lastDrawn: newNumber
    });
};

window.claimBingo = async () => {
    if (!checkForBingo()) {
        alert("Je hebt nog geen bingo! Completeer een rij, kolom of diagonaal.");
        return;
    }
    
    const prize = PRIZES[Math.floor(Math.random() * PRIZES.length)];
    
    const gameDoc = await getDoc(doc(db, "bingo_game", BINGO_ROOM_ID));
    const data = gameDoc.data();
    
    const newPrizes = [...(data.prizes || []), {
        winner: currentUserProfile.username,
        prize: prize,
        timestamp: Date.now()
    }];
    
    await updateDoc(doc(db, "bingo_game", BINGO_ROOM_ID), {
        winner: currentUserProfile.username,
        prize: prize,
        prizes: newPrizes
    });
    
    showWinner(currentUserProfile.username, prize);
};

function showWinner(username, prize) {
    const announcement = document.getElementById('winner-announcement');
    announcement.classList.remove('hidden');
    announcement.querySelector('.winner-name').innerText = `🎉 ${username} heeft gewonnen!`;
    announcement.querySelector('.winner-prize').innerText = prize;
}

window.closeBingoModal = () => {
    document.getElementById('bingo-modal').classList.add('hidden');
};

document.getElementById('dark-toggle')?.addEventListener('change', (e) => {
    document.body.className = e.target.checked ? 'dark-mode' : 'light-mode';
});