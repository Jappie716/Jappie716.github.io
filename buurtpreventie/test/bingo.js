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
const GAME_STATUS_ID = "status";
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
let hasVoted = false;
let allPlayers = [];
let currentDraatje = null;
let canDraw = true;
let drawCooldown = 7;

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
    listenToLobby();
    setupSpinnerCheckbox();
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
        isSpinner: false,
        dontWantSpinner: false,
        votedFor: null
    });
}

window.voteForPlayer = async (targetUid, targetUsername) => {
    if (hasVoted) return;
    
    hasVoted = true;
    await setDoc(doc(db, "bingo_votes", auth.currentUser.uid), {
        votedFor: targetUid,
        votedForName: targetUsername,
        voterUid: auth.currentUser.uid,
        voterName: currentUserProfile.username,
        timestamp: serverTimestamp()
    });
    
    updateVoteButtonState(targetUid);
    checkAllVotesIn();
};

async function leaveBingoClub() {
    await deleteDoc(doc(db, "bingo_players", auth.currentUser.uid));
    window.location.href = 'index.html';
}

let unsubscribePlayers = null;
let unsubscribeGame = null;
let unsubscribeStatus = null;

function setupSpinnerCheckbox() {
    const checkbox = document.getElementById('dont-want-spinner');
    checkbox.addEventListener('change', async () => {
        await updateDoc(doc(db, "bingo_players", auth.currentUser.uid), {
            dontWantSpinner: checkbox.checked
        });
    });
}

function updateVoteButtonState(selectedUid) {
    const buttons = document.querySelectorAll('.vote-btn');
    buttons.forEach(btn => {
        if (btn.dataset.uid === selectedUid) {
            btn.classList.add('voted');
            btn.innerHTML = '✓ Gestemd!';
        } else {
            btn.classList.remove('voted');
        }
    });
}

async function checkAllVotesIn() {
    const votesSnap = await getDoc(doc(db, "bingo_votes", "session"));
    const playersSnap = await getDoc(doc(db, "bingo_votes", "players"));
    
    if (!votesSnap.exists() || !playersSnap.exists()) return;
    
    const totalPlayers = playersSnap.data().players || [];
    const voteDocs = votesSnap.data().votes || [];
    
    if (voteDocs.length === totalPlayers.length) {
        await countVotesAndSelectWinner();
    }
}

async function countVotesAndSelectWinner() {
    const votesSnap = await getDoc(doc(db, "bingo_votes", "session"));
    const votes = votesSnap.data()?.votes || [];
    
    const voteCount = {};
    votes.forEach(v => {
        voteCount[v.votedFor] = (voteCount[v.votedFor] || 0) + 1;
    });
    
    let maxVotes = 0;
    let winners = [];
    
    for (const [uid, count] of Object.entries(voteCount)) {
        if (count > maxVotes) {
            maxVotes = count;
            winners = [uid];
        } else if (count === maxVotes) {
            winners.push(uid);
        }
    }
    
    let winnerUid = winners[0];
    let wasTie = false;
    
    if (winners.length > 1) {
        wasTie = true;
        winnerUid = winners[Math.floor(Math.random() * winners.length)];
    }
    
    const winnerDoc = await getDoc(doc(db, "bingo_players", winnerUid));
    const winnerName = winnerDoc.data()?.username || 'Onbekend';
    
    await setDoc(doc(db, "bingo_game", GAME_STATUS_ID), {
        gameState: 'voting_complete',
        winnerUid: winnerUid,
        winnerName: winnerName,
        wasTie: wasTie,
        announcement: wasTie 
            ? `Het was gelijkspel, de computer heeft ${winnerName} gekozen!`
            : `Er is gestemd: ${winnerName} is de draaier geworden!`
    });
    
    showAnnouncement(wasTie 
        ? `Het was gelijkspel, de computer heeft ${winnerName} gekozen!`
        : `Er is gestemd: ${winnerName} is de draaier geworden!`);
    
    setTimeout(async () => {
        await updateDoc(doc(db, "bingo_players", winnerUid), { isSpinner: true });
        await setDoc(doc(db, "bingo_game", BINGO_ROOM_ID), {
            drawnNumbers: [],
            lastDrawn: null,
            spinner: winnerUid,
            winner: null,
            prize: null,
            prizes: [],
            createdAt: serverTimestamp()
        });
        await setDoc(doc(db, "bingo_game", GAME_STATUS_ID), {
            gameState: 'playing',
            startedAt: serverTimestamp()
        });
    }, 3000);
}

function showAnnouncement(message) {
    const announcement = document.getElementById('bingo-announcements');
    const text = announcement.querySelector('.announcement-text');
    text.innerText = message;
    announcement.classList.remove('hidden');
}

function listenToLobby() {
    unsubscribeStatus = onSnapshot(doc(db, "bingo_game", GAME_STATUS_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            gameState = data.gameState || 'lobby';
            
            if (data.announcement) {
                showAnnouncement(data.announcement);
            }
        } else {
            gameState = 'lobby';
        }
        
        if (gameState === 'lobby' || gameState === 'voting') {
            showLobby(gameState === 'voting');
        } else {
            showGame();
        }
    });
    
    unsubscribePlayers = onSnapshot(collection(db, "bingo_players"), (snapshot) => {
        const lobbyList = document.getElementById('lobby-player-list');
        const playerList = document.getElementById('player-list');
        
        if (lobbyList) lobbyList.innerHTML = '';
        if (playerList) playerList.innerHTML = '';
        
        allPlayers = [];
        let hasSpinner = false;
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            allPlayers.push({ uid: docSnap.id, ...data });
            
            if (lobbyList) {
                const li = document.createElement('li');
                li.innerHTML = `👤 ${data.username}`;
                if (data.isSpinner) {
                    li.classList.add('spinner');
                    li.innerHTML += `<span class="spinner-badge">DRAAIER</span>`;
                }
                lobbyList.appendChild(li);
            }
            
            if (playerList) {
                const li = document.createElement('li');
                li.innerHTML = `👤 ${data.username}`;
                if (data.isSpinner) {
                    li.classList.add('spinner');
                    li.innerHTML += `<span class="spinner-badge">DRAAIER</span>`;
                    hasSpinner = true;
                }
                playerList.appendChild(li);
            }
        });
        
        const statusSnap = allPlayers.find(p => p.uid === auth.currentUser.uid);
        hasVoted = statusSnap?.votedFor ? true : false;
        
        updateVoterList();
        updateDrawerControls();
    });
    
    unsubscribeGame = onSnapshot(doc(db, "bingo_game", BINGO_ROOM_ID), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            currentDraatje = data.spinner;
            updateGameUI(data);
            updateDrawerControls();
        }
    });
}

function updateDrawerControls() {
    const isCurrentUserDraatje = currentDraatje === auth.currentUser.uid;
    
    if (isCurrentUserDraatje) {
        isSpinner = true;
        document.getElementById('spinner-controls')?.classList.remove('hidden');
        document.getElementById('waiting-for-draaier')?.classList.add('hidden');
        document.getElementById('player-info')?.classList.add('hidden');
    } else {
        isSpinner = false;
        document.getElementById('spinner-controls')?.classList.add('hidden');
        document.getElementById('waiting-for-draaier')?.classList.remove('hidden');
        document.getElementById('player-info')?.classList.remove('hidden');
    }
}

let gameState = 'lobby';

function updateVoterList() {
    const voterList = document.getElementById('voter-list');
    if (!voterList) return;
    
    const votingSection = document.getElementById('voting-section');
    const openVotingBtn = document.getElementById('open-voting-btn');
    
    if (gameState === 'voting') {
        votingSection.classList.remove('hidden');
        if (openVotingBtn) openVotingBtn.classList.add('hidden');
    } else if (gameState === 'lobby') {
        votingSection.classList.add('hidden');
        if (openVotingBtn) openVotingBtn.classList.remove('hidden');
    } else {
        votingSection.classList.add('hidden');
        if (openVotingBtn) openVotingBtn.classList.add('hidden');
    }
    
    if (gameState !== 'voting') return;
    
    voterList.innerHTML = '';
    
    allPlayers.forEach(player => {
        if (player.uid === auth.currentUser.uid) return;
        
        const li = document.createElement('li');
        li.innerHTML = `
            <button class="vote-btn" data-uid="${player.uid}" onclick="voteForPlayer('${player.uid}', '${player.username}')">
                👤 ${player.username}
            </button>
        `;
        voterList.appendChild(li);
    });
    
    if (hasVoted) {
        const myVote = allPlayers.find(p => p.uid === auth.currentUser.uid)?.votedFor;
        if (myVote) {
            updateVoteButtonState(myVote);
        }
    }
}

window.startVoting = async () => {
    await setDoc(doc(db, "bingo_game", GAME_STATUS_ID), {
        gameState: 'voting',
        votingStartedAt: serverTimestamp()
    });
    
    await setDoc(doc(db, "bingo_votes", "session"), {
        votes: [],
        startedAt: serverTimestamp()
    });
    
    await setDoc(doc(db, "bingo_votes", "players"), {
        players: allPlayers.map(p => p.uid)
    });
    
hasVoted = false;
    showAnnouncement('🗳️ Stemmen is geopend! Klik op een buur om te stemmen.');
};

function showLobby(showVoting = false) {
    document.getElementById('bingo-lobby').classList.remove('hidden');
    document.getElementById('bingo-app').classList.add('hidden');
    
    if (showVoting) {
        document.getElementById('voting-section').classList.remove('hidden');
        updateVoterList();
    } else {
        document.getElementById('voting-section').classList.add('hidden');
    }
}

function showGame() {
    document.getElementById('bingo-lobby').classList.add('hidden');
    document.getElementById('bingo-app').classList.remove('hidden');
    document.getElementById('bingo-card-section')?.classList.remove('hidden');
    document.getElementById('spinner-controls')?.classList.remove('hidden');
}

function updateGameUI(data) {
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
    }
    
    if (data.lastDrawn) {
        document.getElementById('drawn-number-display').classList.remove('hidden');
        document.getElementById('last-drawn').innerText = data.lastDrawn;
        showGameAnnouncement(`🎯 Getal getrokken: ${data.lastDrawn}!`);
    }
    
    if (data.winner) {
        showWinner(data.winner, data.prize);
    }
    
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

function showGameAnnouncement(message) {
    const announcement = document.getElementById('game-announcements');
    const text = announcement.querySelector('.game-announcement-text');
    text.innerText = message;
    announcement.classList.remove('hidden');
    
    setTimeout(() => {
        announcement.classList.add('hidden');
    }, 5000);
}

window.drawNumber = async () => {
    if (!canDraw) return;
    
    const gameDoc = await getDoc(doc(db, "bingo_game", BINGO_ROOM_ID));
    if (!gameDoc.exists()) return;
    
    const data = gameDoc.data();
    const availableNumbers = [...Array(75).keys()].map(n => n + 1).filter(n => !data.drawnNumbers.includes(n));
    
    if (availableNumbers.length === 0) {
        alert("Alle nummers zijn getrokken! Het spel is voorbij.");
        return;
    }
    
    canDraw = false;
    startDrawCooldown();
    
    const newNumber = availableNumbers[Math.floor(Math.random() * availableNumbers.length)];
    const newDrawnNumbers = [...(data.drawnNumbers || []), newNumber];
    
    await updateDoc(doc(db, "bingo_game", BINGO_ROOM_ID), {
        drawnNumbers: newDrawnNumbers,
        lastDrawn: newNumber
    });
};

function startDrawCooldown() {
    const btn = document.getElementById('draw-number-btn');
    let countdown = drawCooldown;
    
    btn.classList.add('cooldown');
    btn.disabled = true;
    
    const interval = setInterval(() => {
        countdown--;
        if (countdown > 0) {
            btn.innerHTML = `⏳ ${countdown}s wachten...`;
        } else {
            clearInterval(interval);
            canDraw = true;
            btn.classList.remove('cooldown');
            btn.disabled = false;
            btn.innerHTML = `<i data-lucide="dices"></i> Trek een bal`;
            lucide.createIcons();
        }
    }, 1000);
}

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
