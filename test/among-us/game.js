// Firebase Config
const firebaseConfig = {
    apiKey: "AIzaSyA0K4geAuueVfiItB_98-LkqRTnpYNUNvM",
    authDomain: "gameparadise-80490.firebaseapp.com",
    projectId: "gameparadise-80490",
    storageBucket: "gameparadise-80490.firebasestorage.app",
    messagingSenderId: "335620903527",
    appId: "1:335620903527:web:1bc1e01a386bf6e4e7fac2"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();

let gameState = {
    currentUser: null,
    currentGame: null,
    currentPlayer: null,
    isHost: false,
    role: null,
    gameStarted: false,
    players: [],
    tasks: [],
    votes: {},
    myVote: null,
    votingActive: false,
    emergencyCooldown: false,
    canKill: false,
    killCooldown: false
};

const PLAYER_COLORS = ['#ff4d4d', '#4da6ff', '#4dff88', '#ffcc00', '#ff884d', '#ff88cc', '#aa88ff', '#ffffff', '#88ff88', '#888888'];

const MAPS = {
    skeld: {
        name: 'The Skeld',
        rooms: [
            { id: 'cafeteria', x: 100, y: 100, w: 120, h: 80, name: 'Cafeteria' },
            { id: 'weapons', x: 250, y: 50, w: 80, h: 60, name: 'Weapons' },
            { id: 'o2', x: 380, y: 50, w: 80, h: 60, name: 'O2' },
            { id: 'navigation', x: 500, y: 50, w: 100, h: 70, name: 'Navigation' },
            { id: 'shields', x: 100, y: 220, w: 80, h: 60, name: 'Shields' },
            { id: 'medbay', x: 220, y: 200, w: 80, h: 70, name: 'MedBay' },
            { id: 'security', x: 340, y: 180, w: 80, h: 60, name: 'Security' },
            { id: 'admin', x: 460, y: 160, w: 80, h: 60, name: 'Admin' },
            { id: 'electrical', x: 100, y: 340, w: 80, h: 60, name: 'Electrical' },
60, name:            { id: 'lowerengine', x: 220, y: 320, w: 80, h: 60, name: 'Lower Engine' },
            { id: 'upperengine', x: 340, y: 320, w: 80, h: 60, name: 'Upper Engine' },
            { id: 'reactor', x: 480, y: 300, w: 80, h: 80, name: 'Reactor' },
            { id: 'storage', x: 600, y: 150, w: 80, h: 100, name: 'Storage' },
            { id: 'vents', x: 500, y: 420, w: 100, h: 80, name: 'Vent Network' }
        ],
        taskLocations: {
            'cafeteria': ['Fix Wires', 'Empty Chute'],
            'weapons': ['Clear Asteroids'],
            'o2': ['Clean O2 Filter', 'Replace Water Jug'],
            'navigation': ['Chart Course'],
            'shields': ['Align Engine Output'],
            'medbay': ['Submit Scan', 'Clean Vent'],
            'security': ['Monitor Cameras'],
            'admin': ['Download Data'],
            'electrical': ['Fix Wiring', 'Reset Breakers'],
            'lowerengine': ['Align Engine'],
            'upperengine': ['Align Engine'],
            'reactor': ['Start Reactor', 'Unlock Manifolds'],
            'storage': ['Clean Trash']
        }
    },
    mira: {
        name: 'Mira HQ',
        rooms: [
            { id: 'launchpad', x: 50, y: 50, w: 100, h: 80, name: 'Launchpad' },
            { id: 'comms', x: 180, y: 50, w: 80, h: 60, name: 'Comms' },
            { id: 'storage', x: 300, y: 50, w: 80, h: 60, name: 'Storage' },
            { id: 'admin', x: 420, y: 50, w: 80, h: 60, name: 'Admin' },
            { id: 'medbay', x: 50, y: 180, w: 100, h: 70, name: 'MedBay' },
            { id: 'laboratory', x: 180, y: 160, w: 100, h: 80, name: 'Laboratory' },
            { id: 'balcony', x: 330, y: 150, w: 80, h: 60, name: 'Balcony' },
            { id: 'reactor', x: 50, y: 300, w: 100, h: 80, name: 'Reactor' },
            { id: 'office', x: 180, y: 280, w: 80, h: 60, name: 'Office' },
            { id: 'hallway', x: 300, y: 260, w: 120, h: 80, name: 'Hallway' },
            { id: 'vault', x: 450, y: 200, w: 80, h: 80, name: 'Vault' }
        ],
        taskLocations: {
            'launchpad': ['Prime Launcher'],
            'comms': ['Reboot WiFi'],
            'storage': ['Fill Canisters'],
            'admin': ['Download Data'],
            'medbay': ['Submit Scan'],
            'laboratory': ['Process Data', 'Unlock Containers'],
            'balcony': ['Clear Debris'],
            'reactor': ['Start Reactor'],
            'office': ['Fix Wiring'],
            'vault': ['Enter ID Code']
        }
    },
    polus: {
        name: 'Polus',
        rooms: [
            { id: 'dropship', x: 50, y: 50, w: 100, h: 80, name: 'Dropship' },
            { id: 'weapons', x: 180, y: 30, w: 80, h: 60, name: 'Weapons' },
            { id: 'o2', x: 300, y: 30, w: 80, h: 60, name: 'O2' },
            { id: 'nav', x: 420, y: 30, w: 80, h: 60, name: 'Nav' },
            { id: 'shields', x: 50, y: 180, w: 80, h: 60, name: 'Shields' },
            { id: 'teleporters', x: 160, y: 160, w: 80, h: 70, name: 'Teleporters' },
            { id: 'admin', x: 280, y: 150, w: 80, h: 60, name: 'Admin' },
            { id: 'electrical', x: 400, y: 140, w: 80, h: 60, name: 'Electrical' },
            { id: 'medbay', x: 50, y: 290, w: 100, h: 80, name: 'MedBay' },
            { id: 'laboratory', x: 180, y: 270, w: 100, h: 80, name: 'Laboratory' },
            { id: 'storage', x: 320, y: 260, w: 80, h: 60, name: 'Storage' },
            { id: 'office', x: 440, y: 240, w: 80, h: 60, name: 'Office' },
            { id: 'seismic', x: 50, y: 420, w: 120, h: 80, name: 'Seismic' },
            { id: 'lavapool', x: 220, y: 400, w: 80, h: 60, name: 'Lava Pool' },
            { id: 'snowfield', x: 350, y: 380, w: 100, h: 80, name: 'Snowfield' }
        ],
        taskLocations: {
            'dropship': ['Drop Ship'],
            'weapons': ['Clear Asteroids'],
            'o2': ['Replace Water Jug'],
            'nav': ['Chart Course'],
            'shields': ['Align Engine'],
            'teleporters': ['Reset Tefs'],
            'admin': ['Download Data'],
            'electrical': ['Fix Wiring'],
            'medbay': ['Submit Scan'],
            'laboratory': ['Unlock Manifolds'],
            'storage': ['Clean Up'],
            'office': ['Scan Board'],
            'seismic': ['Inspect Sample'],
            'lavapool': ['Place Artifact'],
            'snowfield': ['Record Temperature']
        }
    }
};

function generateGameCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 6; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
}

function showNotification(message, duration = 3000) {
    const notif = document.getElementById('notification');
    notif.textContent = message;
    notif.classList.remove('hidden');
    setTimeout(() => notif.classList.add('hidden'), duration);
}

function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
    document.getElementById(screenId).classList.remove('hidden');
}

function showLoginRequired() {
    document.getElementById('login-required').classList.remove('hidden');
}

function hideLoginRequired() {
    document.getElementById('login-required').classList.add('hidden');
}

// Auth handlers - Homepage
document.getElementById('google-login').addEventListener('click', () => {
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => showNotification('Inloggen mislukt: ' + err.message));
});

document.getElementById('guest-login').addEventListener('click', () => {
    const name = document.getElementById('guest-name').value.trim();
    if (!name) {
        showNotification('Voer een naam in');
        return;
    }
    auth.signInAnonymously().then(() => {
        gameState.currentUser = {
            uid: 'guest_' + Date.now(),
            displayName: name,
            isGuest: true
        };
        hideLoginRequired();
        showScreen('lobby-screen');
        document.getElementById('user-name-display').textContent = name;
        subscribeToGames();
    }).catch(err => showNotification('Inloggen mislukt: ' + err.message));
});

// Modal handlers
document.getElementById('modal-google-login').addEventListener('click', () => {
    hideLoginRequired();
    const provider = new firebase.auth.GoogleAuthProvider();
    auth.signInWithPopup(provider).catch(err => showNotification('Inloggen mislukt: ' + err.message));
});

document.getElementById('modal-guest-play').addEventListener('click', () => {
    const name = prompt('Voer je naam in:');
    if (!name || !name.trim()) {
        showNotification('Voer een naam in');
        return;
    }
    hideLoginRequired();
    auth.signInAnonymously().then(() => {
        gameState.currentUser = {
            uid: 'guest_' + Date.now(),
            displayName: name.trim(),
            isGuest: true
        };
        showScreen('lobby-screen');
        document.getElementById('user-name-display').textContent = name.trim();
        subscribeToGames();
    }).catch(err => showNotification('Inloggen mislukt: ' + err.message));
});

document.getElementById('logout-btn').addEventListener('click', () => {
    auth.signOut();
    gameState.currentUser = null;
    showScreen('homepage');
    if (gamesUnsubscribe) gamesUnsubscribe();
});

// Auth state listener
auth.onAuthStateChanged((user) => {
    if (user) {
        gameState.currentUser = {
            uid: user.uid,
            displayName: user.displayName || user.email?.split('@')[0] || 'Speler',
            email: user.email,
            photoURL: user.photoURL,
            isGuest: user.isAnonymous
        };
        hideLoginRequired();
        showScreen('lobby-screen');
        document.getElementById('user-name-display').textContent = gameState.currentUser.displayName;
        subscribeToGames();
    } else {
        showScreen('homepage');
    }
});

// Game creation
document.getElementById('create-game-btn').addEventListener('click', async () => {
    if (!gameState.currentUser) {
        showLoginRequired();
        return;
    }
    
    const gameName = document.getElementById('game-name').value.trim() || 'Spel ' + generateGameCode();
    const map = document.getElementById('map-select').value;
    const impostorCount = parseInt(document.getElementById('impostor-count').value);
    
    const gameCode = generateGameCode();
    
    try {
        await db.collection('amongus_map').doc(gameCode).set({
            name: gameName,
            map: map,
            impostorCount: impostorCount,
            hostId: gameState.currentUser.uid,
            hostName: gameState.currentUser.displayName,
            status: 'waiting',
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            gameStarted: false,
            emergencyUsed: false,
            votingActive: false
        });
        
        joinGame(gameCode, true);
        showNotification('Spel aangemaakt!');
    } catch (err) {
        showNotification('Fout bij maken spel: ' + err.message);
    }
});

// Join game
document.getElementById('join-game-btn').addEventListener('click', () => {
    if (!gameState.currentUser) {
        showLoginRequired();
        return;
    }
    
    const code = document.getElementById('join-code').value.trim().toUpperCase();
    if (code.length !== 6) {
        showNotification('Ongeldige spelcode');
        return;
    }
    joinGame(code, false);
});

async function joinGame(gameCode, asHost = false) {
    try {
        const gameDoc = await db.collection('amongus_map').doc(gameCode).get();
        if (!gameDoc.exists) {
            showNotification('Spel niet gevonden');
            return;
        }
        
        const gameData = gameDoc.data();
        
        if (gameData.status === 'playing') {
            showNotification('Spel is al bezig');
            return;
        }
        
        gameState.currentGame = gameCode;
        gameState.isHost = asHost || gameData.hostId === gameState.currentUser.uid;
        
        const playerRef = db.collection('amongus_map').doc(gameCode).collection('players').doc(gameState.currentUser.uid);
        const playerData = {
            uid: gameState.currentUser.uid,
            name: gameState.currentUser.displayName,
            color: 0,
            isAlive: true,
            isHost: gameState.isHost,
            x: 100,
            y: 100,
            currentRoom: 'cafeteria',
            tasksCompleted: 0,
            joinedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await playerRef.set(playerData);
        
        gameState.currentPlayer = playerData;
        
        showScreen('game-screen');
        document.getElementById('game-code-display').textContent = gameCode;
        
        if (gameState.isHost) {
            document.getElementById('start-game-btn').classList.remove('hidden');
            document.getElementById('waiting-host').classList.add('hidden');
        } else {
            document.getElementById('start-game-btn').classList.add('hidden');
            document.getElementById('waiting-host').classList.remove('hidden');
        }
        
        subscribeToGame(gameCode);
        
    } catch (err) {
        showNotification('Fout bij joinen: ' + err.message);
    }
}

let gamesUnsubscribe = null;
function subscribeToGames() {
    if (gamesUnsubscribe) gamesUnsubscribe();
    
    gamesUnsubscribe = db.collection('amongus_map')
        .where('status', '==', 'waiting')
        .onSnapshot((snapshot) => {
            const gamesList = document.getElementById('games-list');
            if (!gamesList) return;
            gamesList.innerHTML = '';
            
            snapshot.forEach(doc => {
                const game = doc.data();
                const div = document.createElement('div');
                div.className = 'game-item';
                div.innerHTML = `
                    <div class="game-name">${game.name}</div>
                    <div class="game-info">${MAPS[game.map]?.name || game.map} - ${game.impostorCount} Impostor(s)</div>
                `;
                div.onclick = () => {
                    document.getElementById('join-code').value = doc.id;
                };
                gamesList.appendChild(div);
            });
        });
}

let gameUnsubscribe = null;
let playersUnsubscribe = null;
let chatUnsubscribe = null;
let votesUnsubscribe = null;

function subscribeToGame(gameCode) {
    if (gameUnsubscribe) gameUnsubscribe();
    if (playersUnsubscribe) playersUnsubscribe();
    if (chatUnsubscribe) chatUnsubscribe();
    if (votesUnsubscribe) votesUnsubscribe();
    
    gameUnsubscribe = db.collection('amongus_map').doc(gameCode)
        .onSnapshot((doc) => {
            if (!doc.exists) {
                showNotification('Spel is verwijderd');
                showScreen('lobby-screen');
                return;
            }
            
            const game = doc.data();
            document.getElementById('player-count').textContent = `Spelers: ${gameState.players.length}/10`;
            
            if (game.status === 'playing' && !gameState.gameStarted) {
                startGame(game);
            }
            
            if (game.votingActive && !gameState.votingActive) {
                startVoting();
            } else if (!game.votingActive && gameState.votingActive) {
                endVoting();
            }
            
            if (gameState.currentUser.email === 'someoeneheilig@gmail.com' || 
                gameState.currentUser.email === 'melle1337k@gmail.com') {
                document.getElementById('admin-panel').classList.remove('hidden');
            }
        });
    
    playersUnsubscribe = db.collection('amongus_map').doc(gameCode).collection('players')
        .onSnapshot((snapshot) => {
            gameState.players = [];
            snapshot.forEach(doc => {
                gameState.players.push({ id: doc.id, ...doc.data() });
            });
            updatePlayersList();
            updateMap();
        });
    
    chatUnsubscribe = db.collection('amongus_map').doc(gameCode).collection('chat')
        .orderBy('timestamp', 'asc')
        .onSnapshot((snapshot) => {
            const chatMessages = document.getElementById('chat-messages');
            if (!chatMessages) return;
            chatMessages.innerHTML = '';
            snapshot.forEach(doc => {
                const msg = doc.data();
                const div = document.createElement('div');
                div.className = 'chat-message';
                if (msg.type === 'system') {
                    div.classList.add('system');
                    div.textContent = msg.text;
                } else {
                    div.innerHTML = `<span class="sender" style="color:${PLAYER_COLORS[msg.color || 0]}">${msg.name}:</span> <span class="text">${msg.text}</span>`;
                }
                chatMessages.appendChild(div);
            });
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    
    votesUnsubscribe = db.collection('amongus_map').doc(gameCode).collection('votes')
        .onSnapshot((snapshot) => {
            gameState.votes = {};
            snapshot.forEach(doc => {
                gameState.votes[doc.id] = doc.data();
            });
            if (gameState.votingActive) {
                updateVotingUI();
            }
        });
}

function updatePlayersList() {
    const list = document.getElementById('players-list');
    if (!list) return;
    list.innerHTML = '';
    
    gameState.players.forEach((player, index) => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.innerHTML = `
            <div class="player-color-dot" style="background:${PLAYER_COLORS[player.color || index % 10]}"></div>
            <span class="player-name">${player.name}${player.isHost ? ' 👑' : ''}</span>
            <span class="player-status ${player.isAlive ? 'alive' : 'dead'}">${player.isAlive ? '🔵' : '💀'}</span>
        `;
        if (gameState.role === 'impostor' && player.isAlive && !player.isImpostor) {
            div.style.cursor = 'pointer';
            div.onclick = () => selectKillTarget(player);
        }
        list.appendChild(div);
    });
}

function updateMap() {
    const svg = document.getElementById('game-map');
    if (!svg) return;
    svg.innerHTML = '';
    
    if (!gameState.currentGame) return;
    
    const mapData = MAPS.skeld;
    
    mapData.rooms.forEach(room => {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', room.x);
        rect.setAttribute('y', room.y);
        rect.setAttribute('width', room.w);
        rect.setAttribute('height', room.h);
        rect.setAttribute('fill', '#2a2a4a');
        rect.setAttribute('stroke', '#4a4a6a');
        rect.setAttribute('stroke-width', '2');
        rect.setAttribute('rx', '5');
        svg.appendChild(rect);
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', room.x + room.w/2);
        text.setAttribute('y', room.y + room.h/2 + 4);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', '#888');
        text.setAttribute('font-size', '9');
        text.textContent = room.name;
        svg.appendChild(text);
    });
    
    gameState.players.forEach((player, index) => {
        if (!player.isAlive && gameState.role !== 'impostor') return;
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', player.x || (100 + index * 50));
        circle.setAttribute('cy', player.y || 150);
        circle.setAttribute('r', '15');
        circle.setAttribute('fill', PLAYER_COLORS[player.color || index % 10]);
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '2');
        svg.appendChild(circle);
        
        const name = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        name.setAttribute('x', player.x || (100 + index * 50));
        name.setAttribute('y', (player.y || 150) - 20);
        name.setAttribute('text-anchor', 'middle');
        name.setAttribute('fill', '#fff');
        name.setAttribute('font-size', '10');
        name.textContent = player.name.split(' ')[0];
        svg.appendChild(name);
    });
}

document.getElementById('start-game-btn').addEventListener('click', async () => {
    if (!gameState.isHost) return;
    
    const gameRef = db.collection('amongus_map').doc(gameState.currentGame);
    await gameRef.update({
        status: 'playing',
        gameStarted: true
    });
    
    const impostorCount = (await gameRef.get()).data().impostorCount;
    const shuffled = [...gameState.players].sort(() => Math.random() - 0.5);
    
    for (let i = 0; i < shuffled.length; i++) {
        const isImpostor = i < impostorCount;
        await db.collection('amongus_map').doc(gameState.currentGame)
            .collection('players').doc(shuffled[i].id)
            .update({ isImpostor: isImpostor });
        
        if (shuffled[i].id === gameState.currentUser.uid) {
            gameState.role = isImpostor ? 'impostor' : 'crewmate';
        }
    }
    
    const mapData = MAPS.skeld;
    const tasks = [];
    
    for (const room of mapData.rooms) {
        const roomTasks = mapData.taskLocations[room.id] || [];
        roomTasks.forEach(taskName => {
            tasks.push({
                name: taskName,
                room: room.id,
                completed: false,
                location: { x: room.x + room.w/2, y: room.y + room.h/2 }
            });
        });
    }
    
    const crewmates = shuffled.slice(impostorCount);
    const tasksPerPlayer = Math.ceil(tasks.length / crewmates.length);
    
    for (let i = 0; i < crewmates.length; i++) {
        const playerTasks = tasks.slice(i * tasksPerPlayer, (i + 1) * tasksPerPlayer);
        await db.collection('amongus_map').doc(gameState.currentGame)
            .collection('players').doc(crewmates[i].id)
            .update({ tasks: playerTasks });
    }
    
    for (const imp of shuffled.slice(0, impostorCount)) {
        await db.collection('amongus_map').doc(gameState.currentGame)
            .collection('players').doc(imp.id)
            .update({ tasks: [] });
    }
});

async function startGame(game) {
    gameState.gameStarted = true;
    const myPlayer = gameState.players.find(p => p.id === gameState.currentUser.uid);
    gameState.role = myPlayer?.isImpostor ? 'impostor' : 'crewmate';
    
    showScreen('role-screen');
    
    const roleIcon = document.getElementById('role-icon');
    const roleText = document.getElementById('role-text');
    const roleDesc = document.getElementById('role-description');
    
    if (gameState.role === 'impostor') {
        roleIcon.className = 'role-icon impostor';
        roleText.textContent = '🧑‍🚀 Impostor';
        roleDesc.textContent = 'Vermoed alle Crewmates zonder gepakt te worden!';
        document.getElementById('kill-btn').classList.remove('hidden');
        document.getElementById('sabotage-btn').classList.remove('hidden');
    } else {
        roleIcon.className = 'role-icon crewmate';
        roleText.textContent = '👨‍🚀 Crewmate';
        roleDesc.textContent = 'Voltooi je taken en vind de Impostor(s)!';
        document.getElementById('tasks-panel').classList.remove('hidden');
    }
    
    const playerData = gameState.players.find(p => p.id === gameState.currentUser.uid);
    if (playerData?.tasks) {
        gameState.tasks = playerData.tasks;
        updateTasksList();
    }
}

function updateTasksList() {
    const list = document.getElementById('tasks-list');
    if (!list) return;
    list.innerHTML = '';
    
    const completed = gameState.tasks.filter(t => t.completed).length;
    const progress = gameState.tasks.length > 0 ? Math.round((completed / gameState.tasks.length) * 100) : 0;
    
    document.getElementById('task-progress').textContent = `Voortgang: ${progress}%`;
    
    gameState.tasks.forEach((task, index) => {
        const div = document.createElement('div');
        div.className = `task-item ${task.completed ? 'completed' : ''}`;
        div.innerHTML = `
            <div class="task-status"></div>
            <span>${task.name}</span>
        `;
        if (!task.completed) {
            div.onclick = () => completeTask(index);
        }
        list.appendChild(div);
    });
}

async function completeTask(index) {
    if (gameState.role !== 'crewmate' || gameState.tasks[index]?.completed) return;
    
    gameState.tasks[index].completed = true;
    updateTasksList();
    
    await db.collection('amongus_map').doc(gameState.currentGame)
        .collection('players').doc(gameState.currentUser.uid)
        .update({ 
            tasks: gameState.tasks,
            tasksCompleted: firebase.firestore.FieldValue.increment(1)
        });
    
    checkTasksWin();
}

async function checkTasksWin() {
    const allTasks = gameState.players
        .filter(p => !p.isImpostor)
        .reduce((sum, p) => sum + (p.tasks?.filter(t => t.completed).length || 0), 0);
    
    const totalTasks = gameState.players
        .filter(p => !p.isImpostor)
        .reduce((sum, p) => sum + (p.tasks?.length || 0), 0);
    
    if (totalTasks > 0 && allTasks >= totalTasks) {
        await endGame('crewmates');
    }
}

document.getElementById('emergency-btn').addEventListener('click', async () => {
    if (!gameState.currentUser) {
        showLoginRequired();
        return;
    }
    if (gameState.emergencyCooldown) {
        showNotification('Noodsmeeting nog niet beschikbaar');
        return;
    }
    
    await db.collection('amongus_map').doc(gameState.currentGame).update({
        votingActive: true,
        votingType: 'emergency',
        votingStartTime: firebase.firestore.FieldValue.serverTimestamp(),
        emergencyUsed: true
    });
    
    gameState.emergencyCooldown = true;
    setTimeout(() => gameState.emergencyCooldown = false, 60000);
    
    addSystemMessage('🔔 Noodsmeeting is geopend!');
});

let selectedKillTarget = null;

function selectKillTarget(player) {
    if (gameState.role !== 'impostor' || !player.isAlive) return;
    if (gameState.killCooldown) {
        showNotification('Nog even wachten om te doden');
        return;
    }
    
    selectedKillTarget = player;
    showNotification(`Klik nogmaals om ${player.name} te doden`);
}

document.getElementById('kill-btn').addEventListener('click', async () => {
    if (!selectedKillTarget) {
        showNotification('Selecteer een speler om te doden');
        return;
    }
    
    gameState.killCooldown = true;
    setTimeout(() => gameState.killCooldown = false, 30000);
    
    await db.collection('amongus_map').doc(gameState.currentGame)
        .collection('players').doc(selectedKillTarget.id)
        .update({ isAlive: false });
    
    addSystemMessage(`💀 ${selectedKillTarget.name} is vermoord!`);
    
    checkWinCondition();
    
    selectedKillTarget = null;
});

async function checkWinCondition() {
    const players = gameState.players;
    const aliveCrewmates = players.filter(p => p.isAlive && !p.isImpostor).length;
    const aliveImpostors = players.filter(p => p.isAlive && p.isImpostor).length;
    
    if (aliveImpostors === 0) {
        await endGame('crewmates');
    } else if (aliveImpostors >= aliveCrewmates) {
        await endGame('impostors');
    }
}

async function endGame(winner) {
    await db.collection('amongus_map').doc(gameState.currentGame).update({
        status: 'ended',
        winner: winner
    });
    
    showScreen('result-screen');
    
    const title = document.getElementById('result-title');
    const message = document.getElementById('result-message');
    
    if (winner === 'crewmates') {
        title.textContent = '🎉 Crewmates Winnen!';
        title.className = 'crewmates-win';
        message.textContent = 'De Impostors zijn gevonden of alle taken zijn voltooid!';
    } else {
        title.textContent = '😈 Impostors Winnen!';
        title.className = 'impostors-win';
        message.textContent = 'De Impostors hebben het schip overgenomen!';
    }
}

async function startVoting() {
    gameState.votingActive = true;
    gameState.myVote = null;
    
    showScreen('voting-screen');
    
    const votingBody = document.getElementById('voting-body');
    const votingResults = document.getElementById('voting-results');
    votingBody.classList.remove('hidden');
    votingResults.classList.add('hidden');
    
    const optionsDiv = document.getElementById('voting-options');
    optionsDiv.innerHTML = '';
    
    const alivePlayers = gameState.players.filter(p => p.isAlive);
    
    alivePlayers.forEach(player => {
        const div = document.createElement('div');
        div.className = 'voting-option';
        div.innerHTML = `
            <div style="width:30px;height:30px;background:${PLAYER_COLORS[player.color || 0]};border-radius:50%;margin:0 auto 10px;"></div>
            <div>${player.name}</div>
        `;
        div.onclick = () => castVote(player);
        optionsDiv.appendChild(div);
    });
    
    let timeLeft = 30;
    const timerEl = document.getElementById('voting-timer');
    const timer = setInterval(() => {
        timeLeft--;
        timerEl.textContent = `Tijd over: ${timeLeft}s`;
        if (timeLeft <= 0) clearInterval(timer);
    }, 1000);
    
    setTimeout(async () => {
        if (gameState.votingActive) {
            await finishVoting();
        }
    }, 30000);
}

async function castVote(player) {
    if (gameState.myVote) return;
    
    gameState.myVote = player.id;
    
    await db.collection('amongus_map').doc(gameState.currentGame)
        .collection('votes').doc(gameState.currentUser.uid).set({
        targetId: player.id,
        targetName: player.name,
        voterId: gameState.currentUser.uid,
        voterName: gameState.currentUser.displayName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification(`Gestemt op ${player.name}`);
    
    document.querySelectorAll('.voting-option').forEach(opt => {
        if (opt.querySelector('div:last-child').textContent === player.name) {
            opt.classList.add('selected');
        }
    });
}

async function finishVoting() {
    const voteCounts = {};
    gameState.players.forEach(p => voteCounts[p.id] = 0);
    
    Object.values(gameState.votes).forEach(vote => {
        voteCounts[vote.targetId] = (voteCounts[vote.targetId] || 0) + 1;
    });
    
    document.getElementById('voting-body').classList.add('hidden');
    document.getElementById('voting-results').classList.remove('hidden');
    
    const resultsDiv = document.getElementById('vote-results');
    resultsDiv.innerHTML = '';
    
    const sorted = Object.entries(voteCounts).sort((a, b) => b[1] - a[1]);
    
    sorted.forEach(([playerId, count]) => {
        const player = gameState.players.find(p => p.id === playerId);
        if (!player || count === 0) return;
        
        const div = document.createElement('div');
        div.className = 'vote-result-item';
        div.innerHTML = `
            <div style="display:flex;align-items:center;gap:10px;">
                <div style="width:20px;height:20px;background:${PLAYER_COLORS[player.color || 0]};border-radius:50%;"></div>
                <span>${player.name}</span>
            </div>
            <span class="vote-count">${count} stem(men)</span>
        `;
        resultsDiv.appendChild(div);
    });
    
    const totalVotes = Object.values(gameState.votes).length;
    const maxVotes = sorted[0]?.[1] || 0;
    
    if (maxVotes > totalVotes / 2) {
        const ejectedId = sorted[0][0];
        const ejected = gameState.players.find(p => p.id === ejectedId);
        
        if (ejected) {
            await db.collection('amongus_map').doc(gameState.currentGame)
                .collection('players').doc(ejectedId).update({ isAlive: false });
            
            addSystemMessage(`🗳️ ${ejected.name} is weggestemd!`);
            
            if (ejected.isImpostor) {
                await endGame('crewmates');
                return;
            } else {
                await checkWinCondition();
            }
        }
    }
    
    // Reset voting
    await db.collection('amongus_map').doc(gameState.currentGame).update({
        votingActive: false
    });
}

async function endVoting() {
    gameState.votingActive = false;
    gameState.myVote = null;
    showScreen('game-screen');
}

document.getElementById('skip-vote').addEventListener('click', async () => {
    if (gameState.myVote) {
        showNotification('Je hebt al gestemd');
        return;
    }
    
    await db.collection('amongus_map').doc(gameState.currentGame)
        .collection('votes').doc(gameState.currentUser.uid).set({
        targetId: 'skip',
        targetName: 'Overslaan',
        voterId: gameState.currentUser.uid,
        voterName: gameState.currentUser.displayName,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    showNotification('Gestemd om over te slaan');
});

function updateVotingUI() {}

document.getElementById('send-chat').addEventListener('click', sendChat);
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChat();
});

async function sendChat() {
    if (!gameState.currentUser) {
        showLoginRequired();
        return;
    }
    
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    
    if (!text) return;
    
    const player = gameState.players.find(p => p.id === gameState.currentUser.uid);
    
    await db.collection('amongus_map').doc(gameState.currentGame).collection('chat').add({
        uid: gameState.currentUser.uid,
        name: gameState.currentUser.displayName,
        text: text,
        color: player?.color || 0,
        type: 'player',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
    
    input.value = '';
}

async function addSystemMessage(text) {
    if (!gameState.currentGame) return;
    await db.collection('amongus_map').doc(gameState.currentGame).collection('chat').add({
        uid: 'system',
        name: 'System',
        text: text,
        type: 'system',
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });
}

document.getElementById('leave-game-btn').addEventListener('click', async () => {
    if (gameState.currentGame) {
        await db.collection('amongus_map').doc(gameState.currentGame)
            .collection('players').doc(gameState.currentUser.uid).delete();
        
        if (gameUnsubscribe) gameUnsubscribe();
        if (playersUnsubscribe) playersUnsubscribe();
        if (chatUnsubscribe) chatUnsubscribe();
        if (votesUnsubscribe) votesUnsubscribe();
    }
    
    gameState = {
        currentUser: gameState.currentUser,
        currentGame: null,
        currentPlayer: null,
        isHost: false,
        role: null,
        gameStarted: false,
        players: [],
        tasks: [],
        votes: {},
        myVote: null,
        votingActive: false,
        emergencyCooldown: false,
        canKill: false,
        killCooldown: false
    };
    
    showScreen('lobby-screen');
    subscribeToGames();
});

document.getElementById('back-to-lobby').addEventListener('click', async () => {
    if (gameState.currentGame) {
        await db.collection('amongus_map').doc(gameState.currentGame)
            .collection('players').doc(gameState.currentUser.uid).delete();
    }
    
    gameState.currentGame = null;
    showScreen('lobby-screen');
    subscribeToGames();
});

document.getElementById('kick-all-btn').addEventListener('click', async () => {
    if (!gameState.currentGame) return;
    
    const players = await db.collection('amongus_map').doc(gameState.currentGame)
        .collection('players').get();
    
    players.forEach(async doc => {
        if (doc.id !== gameState.currentUser.uid) {
            await doc.ref.delete();
        }
    });
    
    showNotification('Iedereen gekickt');
});

document.getElementById('end-game-btn').addEventListener('click', async () => {
    if (!gameState.currentGame) return;
    
    await db.collection('amongus_map').doc(gameState.currentGame).update({
        status: 'ended'
    });
    
    showNotification('Spel beëindigd');
    showScreen('lobby-screen');
});

document.getElementById('sabotage-btn').addEventListener('click', () => {
    showNotification('Sabotage binnenkort beschikbaar!');
});

// Initialize
showScreen('homepage');
