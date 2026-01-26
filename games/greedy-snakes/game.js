/**
 * GREEDY SNAKE - FULL FIREBASE EDITION (SILENT SAVE)
 */

// --- 1. FIREBASE SETUP (Laden op de achtergrond) ---
const scriptApp = document.createElement('script');
scriptApp.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js";
const scriptAuth = document.createElement('script');
scriptAuth.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js";
const scriptDb = document.createElement('script');
scriptDb.src = "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore-compat.js";

document.head.appendChild(scriptApp);
document.head.appendChild(scriptAuth);
document.head.appendChild(scriptDb);

let db, auth, currentUser = null;

scriptDb.onload = () => {
    const firebaseConfig = {
        apiKey: "AIzaSyA0K4geAuueVfiItB_98-LkqRTnpYNUNvM",
        authDomain: "gameparadise-80490.firebaseapp.com",
        projectId: "gameparadise-80490",
        storageBucket: "gameparadise-80490.firebasestorage.app",
        messagingSenderId: "335620903527",
        appId: "1:335620903527:web:1bc1e01a386bf6e4e7fac2"
    };
    firebase.initializeApp(firebaseConfig);
    db = firebase.firestore();
    auth = firebase.auth();

    auth.onAuthStateChanged(user => {
        if (user) {
            currentUser = user;
            loadFirebaseData();
        }
    });
};

function loadFirebaseData() {
    db.collection("users").doc(currentUser.uid).collection("saveData").doc("greedySnake").get().then(doc => {
        if (doc.exists) {
            const data = doc.data();
            if (data.yellowMoney !== undefined) {
                gameState.yellowMoney = data.yellowMoney;
                gameState.ownedSkins = data.ownedSkins || ["ball-green"];
                gameState.selectedSkin = data.selectedSkin || "ball-green";
                updateYellowMoneyDisplay();
                updateSkinsDisplay();
            }
        }
    });
}

// --- 2. GAME STATE & SECURITY ---
let gameState = {
    playerName: '',
    selectedMap: 'stars',
    mapSize: 'normal',
    botDifficulty: 'easy',
    yellowMoney: getValidatedYellowMoney(),
    gameRunning: false,
    ownedSkins: JSON.parse(localStorage.getItem('ownedSkins') || '["ball-green"]'),
    selectedSkin: localStorage.getItem('selectedSkin') || 'ball-green'
};

function getYellowMoneyChecksum(amount) {
    return (amount * 17 + 42) % 1000000;
}

function getValidatedYellowMoney() {
    const amount = parseInt(localStorage.getItem('yellowMoney') || '0');
    const storedChecksum = parseInt(localStorage.getItem('yellowMoneyChecksum') || '0');
    if (storedChecksum !== getYellowMoneyChecksum(amount)) return 0;
    return amount;
}

function saveYellowMoney(amount) {
    const validAmount = Math.max(0, Math.min(amount, 999999999));
    gameState.yellowMoney = validAmount;
    localStorage.setItem('yellowMoney', validAmount.toString());
    localStorage.setItem('yellowMoneyChecksum', getYellowMoneyChecksum(validAmount).toString());
    
    // Stille cloud sync (zonder meldingen)
    if (currentUser && db) {
        db.collection("users").doc(currentUser.uid).collection("saveData").doc("greedySnake").set({
            yellowMoney: gameState.yellowMoney,
            ownedSkins: gameState.ownedSkins,
            selectedSkin: gameState.selectedSkin
        }, { merge: true });
    }
}

// --- 3. CANVAS & GAME CONSTANTS ---
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const startScreen = document.getElementById('startScreen');
const loadingScreen = document.getElementById('loadingScreen');
const gameScreen = document.getElementById('gameScreen');

let snakes = [], playerSnake = null, money = [], gameLoop = null, lastTime = 0;
let camera = { x: 0, y: 0, zoom: 2.0 };
let worldWidth = 3000, worldHeight = 2000;

const mapSizes = {
    small: { width: 2000, height: 1500, maxBots: 8, moneyAmount: 400 },
    normal: { width: 3000, height: 2000, maxBots: 15, moneyAmount: 600 },
    big: { width: 4000, height: 3000, maxBots: 25, moneyAmount: 800 },
    huge: { width: 5000, height: 4000, maxBots: 40, moneyAmount: 1111 },
    gigantic: { width: 8000, height: 6000, maxBots: 60, moneyAmount: 1500 }
};

const skins = [
    { id: 'ball-green', name: 'Green Ball', cost: 0, type: 'ball', color: '#44FF44', preview: 'ball-skin-green' },
    { id: 'ball-red', name: 'Red Ball', cost: 5, type: 'ball', color: '#FF4444', preview: 'ball-skin-red' },
    { id: 'ball-blue', name: 'Blue Ball', cost: 5, type: 'ball', color: '#4444FF', preview: 'ball-skin-blue' },
    { id: 'ball-purple', name: 'Purple Ball', cost: 5, type: 'ball', color: '#DD44DD', preview: 'ball-skin-purple' },
    { id: 'ball-yellow', name: 'Yellow Ball', cost: 5, type: 'ball', color: '#FFFF44', preview: 'ball-skin-yellow' },
    { id: 'ball-cyan', name: 'Cyan Ball', cost: 5, type: 'ball', color: '#44FFFF', preview: 'ball-skin-cyan' },
    { id: 'error', name: 'ERROR :]', cost: 100, type: 'vector', preview: 'vector-skin' }
];

let currentSkinIndex = 0;

// --- 4. UI & MENU LOGICA ---
document.addEventListener('DOMContentLoaded', () => {
    setupStartScreen();
    setupSkinsPage();
    updateYellowMoneyDisplay();
    
    document.addEventListener('mousemove', (e) => {
        if (e.clientX < 10 && !gameState.gameRunning && startScreen.classList.contains('active')) {
            openSkinsPage();
        }
    });
});

function openSkinsPage() {
    startScreen.classList.remove('active');
    document.getElementById('skinsScreen').classList.add('active');
    updateSkinsDisplay();
}

function closeSkinsPage() {
    document.getElementById('skinsScreen').classList.remove('active');
    startScreen.classList.add('active');
}

function setupSkinsPage() {
    document.getElementById('prevSkinBtn').onclick = () => {
        currentSkinIndex = (currentSkinIndex - 1 + skins.length) % skins.length;
        updateSkinsDisplay();
    };
    document.getElementById('nextSkinBtn').onclick = () => {
        currentSkinIndex = (currentSkinIndex + 1) % skins.length;
        updateSkinsDisplay();
    };
    document.getElementById('backButton').onclick = closeSkinsPage;

    document.getElementById('selectSkinBtn').onclick = () => {
        const skin = skins[currentSkinIndex];
        if (gameState.ownedSkins.includes(skin.id)) {
            gameState.selectedSkin = skin.id;
            localStorage.setItem('selectedSkin', skin.id);
            saveYellowMoney(gameState.yellowMoney); // Sync naar cloud
            closeSkinsPage();
        } else if (gameState.yellowMoney >= skin.cost) {
            saveYellowMoney(gameState.yellowMoney - skin.cost);
            gameState.ownedSkins.push(skin.id);
            localStorage.setItem('ownedSkins', JSON.stringify(gameState.ownedSkins));
            gameState.selectedSkin = skin.id;
            localStorage.setItem('selectedSkin', skin.id);
            updateSkinsDisplay();
            updateYellowMoneyDisplay();
        }
    };
}

function updateSkinsDisplay() {
    skins.forEach((skin, index) => {
        const item = document.getElementById('skinItem' + index);
        if (item) {
            item.classList.toggle('active', index === currentSkinIndex);
            const statusEl = document.getElementById('skinStatus' + index);
            if (statusEl) {
                if (gameState.ownedSkins.includes(skin.id)) {
                    statusEl.textContent = (gameState.selectedSkin === skin.id) ? 'Selected' : 'Owned';
                } else {
                    statusEl.innerHTML = `${skin.cost} 💰`;
                }
            }
        }
    });
    
    const skin = skins[currentSkinIndex];
    const selectBtn = document.getElementById('selectSkinBtn');
    if (gameState.ownedSkins.includes(skin.id)) {
        selectBtn.textContent = (gameState.selectedSkin === skin.id) ? 'Selected' : 'Select Skin';
    } else {
        selectBtn.textContent = `Buy for ${skin.cost} 💰`;
    }
}

function updateYellowMoneyDisplay() {
    ['yellowMoneyCount', 'yellowMoneySkins', 'yellowMoneyCountGame'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = gameState.yellowMoney;
    });
}

function setupStartScreen() {
    document.getElementById('startButton').onclick = () => {
        gameState.playerName = document.getElementById('playerName').value || 'Greedy Snake';
        startGame();
    };

    // Map selectors
    document.querySelectorAll('.modal-option').forEach(opt => {
        opt.onclick = function() {
            const parent = this.parentElement.parentElement.id;
            if (parent === 'mapModal') {
                gameState.selectedMap = this.dataset.map;
                document.getElementById('mapValue').textContent = this.textContent;
            } else if (parent === 'sizeModal') {
                gameState.mapSize = this.dataset.size;
                document.getElementById('sizeValue').textContent = this.textContent;
            } else if (parent === 'difficultyModal') {
                gameState.botDifficulty = this.dataset.difficulty;
                document.getElementById('difficultyValue').textContent = this.textContent;
            }
            this.parentElement.querySelectorAll('.modal-option').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
        };
    });

    // Modals open/close
    ['map', 'size', 'difficulty'].forEach(id => {
        const btn = document.getElementById(id + 'DisplayBtn');
        const modal = document.getElementById(id + 'Modal');
        if (btn && modal) {
            btn.onclick = (e) => {
                e.stopPropagation();
                modal.classList.toggle('active');
            };
        }
    });

    window.onclick = () => document.querySelectorAll('.option-modal').forEach(m => m.classList.remove('active'));
}

// --- 5. GAME ENGINE ---
function startGame() {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    const size = mapSizes[gameState.mapSize];
    worldWidth = size.width;
    worldHeight = size.height;

    setTimeout(() => {
        loadingScreen.classList.remove('active');
        gameScreen.classList.add('active');
        initGame();
    }, 1000);
}

function initGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    snakes = [];
    money = [];

    const playerSkin = skins.find(s => s.id === gameState.selectedSkin);
    playerSnake = new Snake(worldWidth / 2, worldHeight / 2, playerSkin.color, true, gameState.playerName, playerSkin);
    snakes.push(playerSnake);

    const sizeCfg = mapSizes[gameState.mapSize];
    for (let i = 0; i < sizeCfg.maxBots; i++) {
        const bot = new Snake(Math.random() * worldWidth, Math.random() * worldHeight, '#ff0000', false, 'Bot ' + i);
        bot.isBot = true;
        snakes.push(bot);
    }

    for (let i = 0; i < sizeCfg.moneyAmount; i++) spawnMoney();

    setupInput();
    gameState.gameRunning = true;
    lastTime = performance.now();
    gameLoop = requestAnimationFrame(update);
}

function spawnMoney() {
    const type = Math.random() < 0.1 ? 'yellow' : 'green';
    money.push(new Money(Math.random() * worldWidth, Math.random() * worldHeight, type));
}

function update(currentTime) {
    if (!gameState.gameRunning) return;
    const dt = currentTime - lastTime;
    lastTime = currentTime;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Camera follow
    camera.x += (playerSnake.x - canvas.width / camera.zoom / 2 - camera.x) * 0.1;
    camera.y += (playerSnake.y - canvas.height / camera.zoom / 2 - camera.y) * 0.1;

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Grid / World
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 2;
    for (let x = 0; x <= worldWidth; x += 100) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, worldHeight); ctx.stroke(); }
    for (let y = 0; y <= worldHeight; y += 100) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(worldWidth, y); ctx.stroke(); }

    money.forEach((m, i) => {
        m.draw(ctx);
        snakes.forEach(s => {
            if (Math.hypot(s.x - m.x, s.y - m.y) < s.size + m.size) {
                if (m.type === 'yellow' && s.isPlayer) saveYellowMoney(gameState.yellowMoney + 1);
                if (m.type === 'green') s.greenMoney += 10;
                money.splice(i, 1);
                spawnMoney();
            }
        });
    });

    snakes.forEach(s => {
        s.update(dt, worldWidth, worldHeight);
        s.draw(ctx);
    });

    ctx.restore();
    
    document.getElementById('greenMoneyCount').textContent = playerSnake.greenMoney;
    updateYellowMoneyDisplay();

    if (playerSnake.alive) gameLoop = requestAnimationFrame(update);
}

function setupInput() {
    canvas.onmousemove = (e) => {
        const rect = canvas.getBoundingClientRect();
        const mouseWorldX = (e.clientX - rect.left) / camera.zoom + camera.x;
        const mouseWorldY = (e.clientY - rect.top) / camera.zoom + camera.y;
        const angle = Math.atan2(mouseWorldY - playerSnake.y, mouseWorldX - playerSnake.x);
        playerSnake.dx = Math.cos(angle);
        playerSnake.dy = Math.sin(angle);
    };
}

// --- CLASSES ---
class Snake {
    constructor(x, y, color, isPlayer, name, skin = null) {
        this.x = x; this.y = y; this.color = color; this.isPlayer = isPlayer; this.name = name;
        this.size = 15; this.speed = 150; this.alive = true; this.dx = 1; this.dy = 0;
        this.body = Array.from({length: 10}, () => ({x, y}));
        this.greenMoney = 0;
    }
    update(dt, w, h) {
        if (!this.alive) return;
        const step = (this.speed * dt) / 1000;
        this.x = Math.max(0, Math.min(w, this.x + this.dx * step));
        this.y = Math.max(0, Math.min(h, this.y + this.dy * step));
        this.body.unshift({x: this.x, y: this.y});
        this.body.pop();
    }
    draw(ctx) {
        ctx.fillStyle = this.color;
        this.body.forEach((p, i) => {
            ctx.globalAlpha = 1 - (i / this.body.length) * 0.5;
            ctx.beginPath(); ctx.arc(p.x, p.y, this.size, 0, Math.PI * 2); ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff';
        ctx.font = '10px Arial';
        ctx.fillText(this.name, this.x - 20, this.y - 20);
    }
}

class Money {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.size = type === 'yellow' ? 10 : 7;
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'yellow' ? '#FFD700' : '#22c55e';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
    }
}
