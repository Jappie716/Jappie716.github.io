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
const PRIZES = ["Pruimen", "Goldenticket", "Gratis koffie", "Bloem", "Bingo-bal", "Kroon", "Feest", "Buur-ambt"];

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
let gameState = 'lobby';
let votingTimerInterval = null;

onAuthStateChanged(auth, async function(user) {
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

document.getElementById('login-btn').onclick = function() {
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    signInWithEmailAndPassword(auth, email, password).catch(function(e) { alert(e.message); });
};

document.getElementById('register-btn').onclick = function() {
    var email = document.getElementById('email').value;
    var password = document.getElementById('password').value;
    createUserWithEmailAndPassword(auth, email, password).catch(function(e) { alert(e.message); });
};

document.getElementById('save-profile-btn').onclick = async function() {
    var username = document.getElementById('username').value.trim();
    if (!username) { alert("Kies een gebruikersnaam!"); return; }
    
    var profiel = {
        username: username,
        huisnummer: document.getElementById('huisnummer').value.trim(),
        leeftijd: document.getElementById('leeftijd').value,
        geslacht: document.getElementById('geslacht').value,
        status: ""
    };
    
    await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
    currentUserProfile = profiel;
    startBingoApp();
};

async function startBingoApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('bingo-app').classList.remove('hidden');
    document.getElementById('user-display-name').innerHTML = `<i data-lucide="user"></i> ${currentUserProfile.username}`;
    
    generateBingoCard();
    await joinBingoClub();
    listenToLobby();
    setupSpinnerCheckbox();
    lucide.createIcons();
}

function generateBingoCard() {
    var numbers = new Set();
    while (numbers.size < 24) { numbers.add(Math.floor(Math.random() * 75) + 1); }
    bingoCard = Array.from(numbers);
    bingoCard.splice(12, 0, "FREE");
    
    var cardEl = document.getElementById('bingo-card');
    cardEl.innerHTML = '';
    
    bingoCard.forEach(function(num, index) {
        var cell = document.createElement('div');
        cell.className = num === "FREE" ? 'bingo-cell free-space marked' : 'bingo-cell';
        cell.innerText = num;
        cell.dataset.index = index;
        if (num !== "FREE") { cell.onclick = function() { markNumber(num, cell); }; }
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
    var cells = document.querySelectorAll('.bingo-cell');
    var combos = [[0,1,2,3,4],[5,6,7,8,9],[10,11,12,13,14],[15,16,17,18,19],[20,21,22,23,24],[0,5,10,15,20],[1,6,11,16,21],[2,7,12,17,22],[3,8,13,18,23],[4,9,14,19,24],[0,6,12,18,24],[4,8,12,16,20]];
    var hasBingo = combos.some(function(c) { return c.every(function(i) { return cells[i].classList.contains('marked'); }); });
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

window.voteForPlayer = async function(targetUid, targetUsername) {
    if (hasVoted) return;
    hasVoted = true;
    
    await setDoc(doc(db, "bingo_players", auth.currentUser.uid), { votedFor: targetUid };
    
    var me = allPlayers.find(function(p) { return p.uid === auth.currentUser.uid; });
    if (me) me.votedFor = targetUid;
    
    updateVoteButtonState(targetUid);
};

async function leaveBingoClub() {
    await deleteDoc(doc(db, "bingo_players", auth.currentUser.uid);
    window.location.href = "index.html";
}

function setupSpinnerCheckbox() {
    var checkbox = document.getElementById('dont-want-spinner');
    checkbox.addEventListener('change', async function() {
        await updateDoc(doc(db, "bingo_players", auth.currentUser.uid), { dontWantSpinner: checkbox.checked });
    });
}

function updateVoteButtonState(uid) {
    var btns = document.querySelectorAll('.vote-btn');
    btns.forEach(function(btn) {
        if (btn.dataset.uid === uid) { btn.classList.add('voted'); btn.innerText = "✓ Gestemd!"; }
        else { btn.classList.remove('voted'); }
    });
}

function showAnnouncement(msg) {
    var el = document.getElementById('bingo-announcements');
    el.querySelector('.announcement-text').innerText = msg;
    el.classList.remove('hidden');
}

function listenToLobby() {
    unsubscribeStatus = onSnapshot(doc(db, "bingo_game", GAME_STATUS_ID, function(snap) {
        if (snap.exists()) {
            var d = snap.data();
            gameState = d.gameState || 'lobby';
            if (d.announcement) showAnnouncement(d.announcement);
        } else { gameState = 'lobby'; }
        
        if (gameState === 'lobby') {
            document.getElementById('lobby-options').classList.remove('hidden');
            showLobby(false);
        } else if (gameState === 'voting') {
            document.getElementById('lobby-options').classList.add('hidden');
            showLobby(true);
        } else { showGame(); }
    });
    
    unsubscribePlayers = onSnapshot(collection(db, "bingo_players"), function(snap) {
        var l1 = document.getElementById('lobby-player-list');
        var l2 = document.getElementById('player-list');
        if (l1) l1.innerHTML = '';
        if (l2) l2.innerHTML = '';
        allPlayers = [];
        
        snap.forEach(function(ds) {
            var data = ds.data();
            allPlayers.push({ uid: ds.id, username: data.username, isSpinner: data.isSpinner, dontWantSpinner: data.dontWantSpinner });
            if (l1) {
                var li = document.createElement('li');
                li.innerHTML = "👤 " + data.username + (data.isSpinner ? '<span class="spinner-badge">DRAAIER</span>' : '');
                if (data.isSpinner) li.classList.add('spinner');
                l1.appendChild(li);
            }
            if (l2) {
                var li2 = document.createElement('li');
                li2.innerHTML = "👤 " + data.username + (data.isSpinner ? '<span class="spinner-badge">DRAAIER</span>' : '');
                if (data.isSpinner) li2.classList.add('spinner');
                l2.appendChild(li2);
            }
        });
        updateVoterList();
        updateDrawerControls();
    });
    
    unsubscribeGame = onSnapshot(doc(db, "bingo_game", BINGO_ROOM_ID, function(snap) {
        if (snap.exists()) {
            var d = snap.data();
            currentDraatje = d.spinner;
            updateGameUI(d);
            updateDrawerControls();
        }
    });
}

function updateDrawerControls() {
    var isMe = currentDraatje === auth.currentUser.uid;
    document.getElementById('spinner-controls').classList.toggle('hidden', !isMe);
    document.getElementById('waiting-for-draaier').classList.toggle('hidden', isMe);
    document.getElementById('player-info').classList.toggle('hidden', isMe);
}

function updateVoterList() {
    var vl = document.getElementById('voter-list');
    var vs = document.getElementById('voting-section');
    var vb = document.getElementById('open-voting-btn');
    if (!vl) return;
    
    if (gameState === 'voting') { vs.classList.remove('hidden'); if (vb) vb.classList.add('hidden'); }
    else if (gameState === 'lobby') { vs.classList.add('hidden'); if (vb) vb.classList.remove('hidden'); }
    else { vs.classList.add('hidden'); if (vb) vb.classList.add('hidden'); }
    
    if (gameState !== 'voting') return;
    if (!allPlayers || allPlayers.length === 0) return;
    
    vl.innerHTML = '';
    allPlayers.forEach(function(p) {
        if (p.uid === auth.currentUser.uid || !p.username) return;
        var btn = document.createElement('button');
        btn.className = 'vote-btn';
        btn.dataset.uid = p.uid;
        btn.innerHTML = '<i data-lucide="user"></i> ' + p.username;
        btn.onclick = (function(u, n) { return function() { window.voteForPlayer(u, n); }; })(p.uid, p.username);
        var li = document.createElement('li');
        li.appendChild(btn);
        vl.appendChild(li);
    });
    
    var me = allPlayers.find(function(p) { return p.uid === auth.currentUser.uid; });
    if (me && me.votedFor) updateVoteButtonState(me.votedFor);
}

window.startVoting = async function() {
    gameState = 'voting';
    await setDoc(doc(db, "bingo_game", GAME_STATUS_ID), { gameState: 'voting', votingStartedAt: serverTimestamp() };
    await setDoc(doc(db, "bingo_votes", "session"), { votes: [], startedAt: serverTimestamp() };
    await setDoc(doc(db, "bingo_votes", "players"), { players: allPlayers.map(function(p) { return p.uid; }) });
    
    hasVoted = false;
    showAnnouncement("Stemmen is geopend! Klik op een buur.");
    document.getElementById('lobby-options').classList.add('hidden');
    startVotingTimer();
};

function startVotingTimer() {
    var t = document.getElementById('voting-timer');
    var c = document.getElementById('timer-countdown');
    var left = 30;
    t.classList.remove('hidden');
    c.innerText = left;
    
    votingTimerInterval = setInterval(function() {
        left--;
        c.innerText = left;
        if (left <= 0) { clearInterval(votingTimerInterval); endVoting(); }
    }, 1000);
}

async function endVoting() {
    if (!canDraw) {
        clearInterval(votingTimerInterval);
        canDraw = true;
    }
    
    var st = await getDoc(doc(db, "bingo_game", GAME_STATUS_ID);
    if (st.exists() && st.data().gameState !== 'voting') return;
    
    var votes = [];
    var playerIds = [];
    
    allPlayers.forEach(function(p) {
        if (p.votedFor) {
            votes.push({ votedFor: p.votedFor, voterUid: p.uid });
        }
        playerIds.push(p.uid);
    });
    
    var players = playerIds;
    var winnerUid = null;
    var winnerName = 'Niemand';
    var wasTie = false;
    
    if (votes.length > 0) {
        var vc = {};
        votes.forEach(function(v) { vc[v.votedFor] = (vc[v.votedFor] || 0) + 1; });
        var max = 0; var wins = [];
        for (var u in vc) { if (vc[u] > max) { max = vc[u]; wins = [u]; } else if (vc[u] === max) { wins.push(u); } }
        winnerUid = wins[0];
        if (wins.length > 1) { wasTie = true; winnerUid = wins[Math.floor(Math.random() * wins.length)]; }
        var ws = await getDoc(doc(db, "bingo_players", winnerUid));
        winnerName = ws.exists() ? ws.data().username : 'Onbekend';
    } else if (players.length > 0) {
        var avail = players.filter(function(p) { var pl = allPlayers.find(function(a) { return a.uid === p; }); return pl && !pl.dontWantSpinner; });
        if (avail.length > 0) {
            winnerUid = avail[Math.floor(Math.random() * avail.length)];
            var ws2 = await getDoc(doc(db, "bingo_players", winnerUid));
            winnerName = ws2.exists() ? ws2.data().username : 'Onbekend';
        } else { winnerName = 'Niemand beschikbaar'; }
    }
    
    document.getElementById('voting-timer').classList.add('hidden');
    document.getElementById('lobby-options').classList.remove('hidden');
    
    if (winnerUid) {
        var txt = wasTie ? ("Het was gelijkspel, computer koos " + winnerName) : (winnerName + " is de draaier!");
        await setDoc(doc(db, "bingo_game", GAME_STATUS_ID), { gameState: 'voting_complete', winnerUid: winnerUid, winnerName: winnerName, wasTie: wasTie, announcement: txt });
        showAnnouncement(txt);
        setTimeout(async function() {
            await updateDoc(doc(db, "bingo_players", winnerUid), { isSpinner: true });
            await setDoc(doc(db, "bingo_game", BINGO_ROOM_ID), { drawnNumbers: [], lastDrawn: null, spinner: winnerUid, winner: null, prize: null, prizes: [], createdAt: serverTimestamp() });
            await setDoc(doc(db, "bingo_game", GAME_STATUS_ID), { gameState: 'playing', startedAt: serverTimestamp() });
        }, 3000);
    } else {
        await setDoc(doc(db, "bingo_game", GAME_STATUS_ID), { gameState: 'lobby', announcement: 'Geen geldige draaier. Probeer opnieuw!' });
        showAnnouncement('Geen geldige draaier. Probeer opnieuw!');
    }
}

function showLobby(voting) {
    document.getElementById('bingo-lobby').classList.remove('hidden');
    document.getElementById('bingo-app').classList.add('hidden');
    document.getElementById('voting-section').classList.toggle('hidden', !voting);
    if (!voting) document.getElementById('lobby-options').classList.remove('hidden');
    if (voting) updateVoterList();
}

function showGame() {
    document.getElementById('bingo-lobby').classList.add('hidden');
    document.getElementById('bingo-app').classList.remove('hidden');
    document.getElementById('bingo-card-section').classList.remove('hidden');
    document.getElementById('spinner-controls').classList.remove('hidden');
}

function updateGameUI(d) {
    if (d.drawnNumbers) {
        document.getElementById('drawn-count').innerText = d.drawnNumbers.length;
        var cn = document.getElementById('drawn-numbers');
        cn.innerHTML = '';
        d.drawnNumbers.forEach(function(n) {
            var s = document.createElement('span');
            s.className = 'drawn-number-chip';
            s.innerText = n;
            cn.appendChild(s);
        });
    }
    if (d.lastDrawn) {
        document.getElementById('drawn-number-display').classList.remove('hidden');
        document.getElementById('last-drawn').innerText = d.lastDrawn;
        showGameAnnouncement("Getal getrokken: " + d.lastDrawn);
    }
    if (d.winner) showWinner(d.winner, d.prize);
    if (d.prizes) {
        var pl = document.getElementById('prize-list');
        pl.innerHTML = '';
        d.prizes.forEach(function(p) {
            var li = document.createElement('li');
            li.innerHTML = '🏆 ' + p.winner + ' - ' + p.prize;
            pl.appendChild(li);
        });
    }
}

function showGameAnnouncement(msg) {
    var el = document.getElementById('game-announcements');
    el.querySelector('.game-announcement-text').innerText = msg;
    el.classList.remove('hidden');
    setTimeout(function() { el.classList.add('hidden'); }, 5000);
}

window.drawNumber = async function() {
    if (!canDraw) return;
    var gs = await getDoc(doc(db, "bingo_game", BINGO_ROOM_ID));
    if (!gs.exists()) return;
    var d = gs.data();
    var arr = [];
    for (var i = 1; i <= 75; i++) { if ((d.drawnNumbers || []).indexOf(i) === -1) arr.push(i); }
    if (arr.length === 0) { alert("Alle getrokken!"); return; }
    
    canDraw = false;
    startDrawCooldown();
    
    var n = arr[Math.floor(Math.random() * arr.length)];
    await updateDoc(doc(db, "bingo_game", BINGO_ROOM_ID), { drawnNumbers: (d.drawnNumbers || []).concat([n]), lastDrawn: n });
};

function startDrawCooldown() {
    var btn = document.getElementById('draw-number-btn');
    var cnt = drawCooldown;
    btn.classList.add('cooldown');
    btn.disabled = true;
    var iv = setInterval(function() {
        cnt--;
        if (cnt > 0) { btn.innerText = cnt + "s wachten..."; }
        else { clearInterval(iv); canDraw = true; btn.classList.remove('cooldown'); btn.disabled = false; btn.innerHTML = "<i data-lucide></i> Trek een bal"; lucide.createIcons(); }
    }, 1000);
}

window.claimBingo = async function() {
    if (!checkForBingo()) { alert("Nog geen bingo!"); return; }
    var p = PRIZES[Math.floor(Math.random() * PRIZES.length)];
    var gs = await getDoc(doc(db, "bingo_game", BINGO_ROOM_ID));
    var d = gs.data();
    var np = (d.prizes || []).concat([{ winner: currentUserProfile.username, prize: p, timestamp: Date.now() }]);
    await updateDoc(doc(db, "bingo_game", BINGO_ROOM_ID), { winner: currentUserProfile.username, prize: p, prizes: np });
    showWinner(currentUserProfile.username, p);
};

function showWinner(u, p) {
    var a = document.getElementById('winner-announcement');
    a.classList.remove('hidden');
    a.querySelector('.winner-name').innerText = "🎉 " + u + " heeft gewonnen!";
    a.querySelector('.winner-prize').innerText = p;
}

window.closeBingoModal = function() { document.getElementById('bingo-modal').classList.add('hidden'); };
