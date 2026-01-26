/**
 * GREEDY SNAKE - FIREBASE & SECURITY EDITION
 */

// --- 1. FIREBASE CONFIGURATIE ---
const firebaseConfig = {
    apiKey: "AIzaSyA0K4geAuueVfiItB_98-LkqRTnpYNUNvM",
    authDomain: "gameparadise-80490.firebaseapp.com",
    projectId: "gameparadise-80490",
    storageBucket: "gameparadise-80490.firebasestorage.app",
    messagingSenderId: "335620903527",
    appId: "1:335620903527:web:1bc1e01a386bf6e4e7fac2"
};

// Initialiseer Firebase
if (!firebase.apps.length) firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const auth = firebase.auth();
let currentUser = null;

// --- 2. GAME STATE & SECURITY ---
let gameState = {
    playerName: '',
    selectedMap: 'stars',
    mapSize: 'normal',
    botDifficulty: 'easy',
    yellowMoney: 0, // Wordt geladen via Firebase/LocalStorage
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
    return (storedChecksum === getYellowMoneyChecksum(amount)) ? amount : 0;
}

// --- 3. NOTIFICATIE SYSTEEM ---
function notify(msg, type = 'success') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const t = document.createElement('div');
    t.className = 'toast';
    t.style.borderLeft = `5px solid ${type === 'success' ? '#22c55e' : '#eab308'}`;
    t.innerHTML = `<span>${type === 'success' ? '✅' : '💰'}</span> ${msg}`;
    container.appendChild(t);
    setTimeout(() => {
        t.style.opacity = '0';
        setTimeout(() => t.remove(), 300);
    }, 3000);
}

// --- 4. DATA SYNCHRONISATIE ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        loadFirebaseData();
    } else {
        gameState.yellowMoney = getValidatedYellowMoney();
        updateYellowMoneyDisplay();
    }
});

function loadFirebaseData() {
    db.collection("users").doc(currentUser.uid).collection("saveData").doc("greedySnake").get()
    .then(doc => {
        if (doc.exists) {
            const data = doc.data();
            gameState.yellowMoney = data.yellowMoney || 0;
            gameState.ownedSkins = data.ownedSkins || ["ball-green"];
            gameState.selectedSkin = data.selectedSkin || "ball-green";
            
            // Update lokale cache
            localStorage.setItem('yellowMoney', gameState.yellowMoney);
            localStorage.setItem('yellowMoneyChecksum', getYellowMoneyChecksum(gameState.yellowMoney));
            localStorage.setItem('ownedSkins', JSON.stringify(gameState.ownedSkins));
            localStorage.setItem('selectedSkin', gameState.selectedSkin);
            
            updateYellowMoneyDisplay();
            updateSkinsDisplay();
        } else {
            syncToFirebase();
        }
    });
}

function syncToFirebase() {
    if (!currentUser) return;
    db.collection("users").doc(currentUser.uid).collection("saveData").doc("greedySnake").set({
        yellowMoney: gameState.yellowMoney,
        ownedSkins: gameState.ownedSkins,
        selectedSkin: gameState.selectedSkin
    }, { merge: true });
}

function saveYellowMoney(amount, shouldSync = true) {
    const validAmount = Math.max(0, Math.min(amount, 999999999));
    gameState.yellowMoney = validAmount;
    localStorage.setItem('yellowMoney', validAmount.toString());
    localStorage.setItem('yellowMoneyChecksum', getYellowMoneyChecksum(validAmount).toString());
    
    updateYellowMoneyDisplay();
    if (shouldSync) syncToFirebase();
}

// --- 5. ORIGINELE GAME LOGICA (Herschreven voor integratie) ---

const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const startScreen = document.getElementById('startScreen');
const loadingScreen = document.getElementById('loadingScreen');
const gameScreen = document.getElementById('gameScreen');

let snakes = [], playerSnake = null, money = [], gameLoop = null, lastTime = 0;
let camera = { x: 0, y: 0, zoom: 2.0 };
let worldWidth = 0, worldHeight = 0;

const mapSizes = {
    small: { width: 2000, height: 1500, maxBots: 8, moneyAmount: 400 },
    normal: { width: 3000, height: 2000, maxBots: 15, moneyAmount: 600 },
    big: { width: 4000, height: 3000, maxBots: 25, moneyAmount: 800 },
    huge: { width: 5000, height: 4000, maxBots: 40, moneyAmount: 1111 },
    gigantic: { width: 8000, height: 6000, maxBots: 60, moneyAmount: 1500 }
};

const skins = [
    { id: 'ball-green', name: 'Green Ball', cost: 0, type: 'ball', color: '#44FF44', preview: 'ball-skin-green', automatic: true },
    { id: 'ball-red', name: 'Red Ball', cost: 5, type: 'ball', color: '#FF4444', preview: 'ball-skin-red' },
    { id: 'ball-blue', name: 'Blue Ball', cost: 5, type: 'ball', color: '#4444FF', preview: 'ball-skin-blue' },
    { id: 'ball-purple', name: 'Purple Ball', cost: 5, type: 'ball', color: '#DD44DD', preview: 'ball-skin-purple' },
    { id: 'ball-yellow', name: 'Yellow Ball', cost: 5, type: 'ball', color: '#FFFF44', preview: 'ball-skin-yellow' },
    { id: 'ball-cyan', name: 'Cyan Ball', cost: 5, type: 'ball', color: '#44FFFF', preview: 'ball-skin-cyan' },
    { id: 'error', name: 'ERROR :]', cost: 100, type: 'vector', preview: 'vector-skin' }
];

let currentSkinIndex = 0;

// -- INITIALISATIE --
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
}

function closeSkinsPage() {
    document.getElementById('skinsScreen').classList.remove('active');
    startScreen.classList.add('active');
}

function setupSkinsPage() {
    document.getElementById('prevSkinBtn').addEventListener('click', () => showSkinItem((currentSkinIndex - 1 + skins.length) % skins.length));
    document.getElementById('nextSkinBtn').addEventListener('click', () => showSkinItem((currentSkinIndex + 1) % skins.length));
    document.getElementById('backButton').addEventListener('click', closeSkinsPage);

    document.getElementById('selectSkinBtn').addEventListener('click', () => {
        const skin = skins[currentSkinIndex];
        if (gameState.ownedSkins.includes(skin.id)) {
            gameState.selectedSkin = skin.id;
            localStorage.setItem('selectedSkin', skin.id);
            syncToFirebase();
            notify(`Skin ${skin.name} geselecteerd!`);
            closeSkinsPage();
        } else if (gameState.yellowMoney >= skin.cost) {
            saveYellowMoney(gameState.yellowMoney - skin.cost);
            gameState.ownedSkins.push(skin.id);
            gameState.selectedSkin = skin.id;
            localStorage.setItem('ownedSkins', JSON.stringify(gameState.ownedSkins));
            syncToFirebase();
            updateSkinsDisplay();
            notify(`${skin.name} gekocht!`, 'success');
        }
    });
    updateSkinsDisplay();
}

function showSkinItem(index) {
    currentSkinIndex = index;
    updateSkinsDisplay();
}

function updateSkinsDisplay() {
    skins.forEach((skin, index) => {
        const item = document.getElementById('skinItem' + index);
        if (item) item.classList.toggle('active', index === currentSkinIndex);
        
        const statusEl = document.getElementById('skinStatus' + index);
        if (statusEl) {
            if (gameState.ownedSkins.includes(skin.id)) {
                statusEl.textContent = 'Owned';
                statusEl.className = 'skin-status owned';
            } else {
                statusEl.innerHTML = `${skin.cost} <span class="money-icon">💰</span>`;
                statusEl.className = 'skin-status locked';
            }
        }
    });
    
    const skin = skins[currentSkinIndex];
    const selectBtn = document.getElementById('selectSkinBtn');
    if (gameState.ownedSkins.includes(skin.id)) {
        selectBtn.textContent = 'Select Skin';
        selectBtn.disabled = false;
    } else {
        selectBtn.textContent = `Buy for ${skin.cost} 💰`;
        selectBtn.disabled = gameState.yellowMoney < skin.cost;
    }
}

function updateYellowMoneyDisplay() {
    ['yellowMoneyCount', 'yellowMoneySkins', 'yellowMoneyCountGame'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = gameState.yellowMoney;
    });
}

// -- GAME CORE --
function startGame() {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    setTimeout(() => {
        loadingScreen.classList.remove('active');
        gameScreen.classList.add('active');
        initGame();
    }, 1500);
}

function initGame() {
    const size = mapSizes[gameState.mapSize];
    worldWidth = size.width; worldHeight = size.height;
    canvas.width = window.innerWidth; canvas.height = window.innerHeight;

    snakes = []; money = [];
    const skinObj = skins.find(s => s.id === gameState.selectedSkin);
    playerSnake = new Snake(worldWidth/2, worldHeight/2, '#00ff00', true, gameState.playerName || 'Player', skinObj);
    snakes.push(playerSnake);

    for (let i = 0; i < size.maxBots; i++) {
        const bot = new Snake(Math.random()*worldWidth, Math.random()*worldHeight, getRandomColor(), false, getRandomBotName());
        bot.isBot = true; bot.difficulty = gameState.botDifficulty;
        snakes.push(bot);
    }

    spawnMoney(size.moneyAmount);
    setupInput();
    gameState.gameRunning = true;
    lastTime = performance.now();
    gameLoop = requestAnimationFrame(update);
}

function update(currentTime) {
    if (!gameState.gameRunning) return;
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;

    snakes.forEach(s => {
        if (s.alive) {
            s.update(deltaTime, worldWidth, worldHeight);
            if (s.isBot) updateBotAI(s);
        }
    });

    if (playerSnake.alive) {
        camera.x += (playerSnake.x - (canvas.width/camera.zoom/2) - camera.x) * 0.1;
        camera.y += (playerSnake.y - (canvas.height/camera.zoom/2) - camera.y) * 0.1;
    }

    checkCollisions();
    checkMoneyCollection();
    if (money.length < mapSizes[gameState.mapSize].moneyAmount) spawnMoney(5);
    render();
    updateGameUI();

    if (!playerSnake.alive) return gameOver();
    gameLoop = requestAnimationFrame(update);
}

function checkMoneyCollection() {
    snakes.forEach(snake => {
        if (!snake.alive) return;
        for (let i = money.length - 1; i >= 0; i--) {
            const m = money[i];
            const dist = Math.hypot(snake.x - m.x, snake.y - m.y);
            if (dist < snake.size + m.size) {
                if (m.type === 'green') {
                    snake.greenMoney += 10 * snake.multiplier;
                } else if (m.type === 'yellow' && snake.isPlayer) {
                    saveYellowMoney(gameState.yellowMoney + 1);
                    notify("+1 Yellow Money!", 'money');
                }
                money.splice(i, 1);
            }
        }
    });
}

// Classes, Input en Render logica (geconsolideerd van je origineel)
class Snake {
    constructor(x, y, color, isPlayer, name, skin = null) {
        this.x = x; this.y = y; this.color = color; this.isPlayer = isPlayer; this.name = name;
        this.alive = true; this.isBot = false; this.skin = skin;
        this.skinColor = skin ? (skin.color || color) : color;
        this.dx = 1; this.dy = 0; this.size = 15; this.speed = 100;
        this.body = Array.from({length: 10}, (_, i) => ({x: x - i*15, y}));
        this.greenMoney = 0; this.sizeLevel = 1; this.speedLevel = 1; this.multiplierLevel = 1; this.multiplier = 1;
    }

    setDirection(dx, dy) {
        const len = Math.hypot(dx, dy);
        if (len > 0.01) { this.dx = dx/len; this.dy = dy/len; }
    }

    update(dt, w, h) {
        const dist = (this.speed * dt) / 1000;
        this.x = Math.max(this.size, Math.min(w - this.size, this.x + this.dx * dist));
        this.y = Math.max(this.size, Math.min(h - this.size, this.y + this.dy * dist));
        this.body.unshift({x: this.x, y: this.y});
        if (this.body.length > 10 + this.sizeLevel*5) this.body.pop();
    }

    draw(ctx) {
        ctx.fillStyle = this.skinColor;
        this.body.forEach((s, i) => {
            ctx.globalAlpha = 1 - (i/this.body.length)*0.5;
            ctx.beginPath(); ctx.arc(s.x, s.y, this.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#fff'; ctx.fillText(this.name, this.x, this.y - this.size - 10);
    }
}

class Money {
    constructor(x, y, type) {
        this.x = x; this.y = y; this.type = type;
        this.size = type === 'green' ? 8 : 10;
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'green' ? '#00ff00' : '#FFD700';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = '#000'; ctx.fillText('$', this.x, this.y + 3);
    }
}

// Hulpfuncties
function spawnMoney(n) { for(let i=0; i<n; i++) money.push(new Money(Math.random()*worldWidth, Math.random()*worldHeight, Math.random()<0.8?'green':'yellow')); }
function getRandomColor() { return ['#ff0000', '#00ffff', '#ff00ff', '#ffff00'][Math.floor(Math.random()*4)]; }
function getRandomBotName() { return "Bot_" + Math.floor(Math.random()*100); }
function gameOver() { gameState.gameRunning = false; setTimeout(() => location.reload(), 2000); }

function setupInput() {
    canvas.addEventListener('mousemove', e => {
        const rect = canvas.getBoundingClientRect();
        const worldX = (e.clientX - rect.left) / camera.zoom + camera.x;
        const worldY = (e.clientY - rect.top) / camera.zoom + camera.y;
        playerSnake.setDirection(worldX - playerSnake.x, worldY - playerSnake.y);
    });
}

function render() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    money.forEach(m => m.draw(ctx));
    snakes.forEach(s => s.alive && s.draw(ctx));
    ctx.restore();
}

function setupStartScreen() {
    document.getElementById('startButton').onclick = () => {
        gameState.playerName = document.getElementById('playerName').value;
        startGame();
    };
    // Map/Size selectors logica...
    document.querySelectorAll('.modal-option').forEach(opt => {
        opt.onclick = () => {
            const type = opt.parentElement.parentElement.id;
            if (type.includes('map')) gameState.selectedMap = opt.dataset.map;
            if (type.includes('size')) gameState.mapSize = opt.dataset.size;
            if (type.includes('difficulty')) gameState.botDifficulty = opt.dataset.difficulty;
        };
    });
}

function updateGameUI() {
    document.getElementById('greenMoneyCount').textContent = playerSnake.greenMoney;
    updateYellowMoneyDisplay();
}

function checkCollisions() {
    snakes.forEach((s1, i) => {
        snakes.forEach((s2, j) => {
            if (i !== j && s1.alive && s2.alive) {
                const dist = Math.hypot(s1.x - s2.x, s1.y - s2.y);
                if (dist < s1.size + s2.size) s1.alive = s2.alive = false;
            }
        });
    });
}

function updateBotAI(bot) {
    const target = money[0];
    if (target) bot.setDirection(target.x - bot.x, target.y - bot.y);
}
