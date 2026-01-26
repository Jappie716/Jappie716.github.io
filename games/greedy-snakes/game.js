/**
 * GREEDY SNAKE - FULL FIREBASE EDITION (REPAIRED & SILENT SAVE)
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

// Wacht tot scripts geladen zijn
scriptDb.onload = () => {
    const firebaseConfig = {
        apiKey: "AIzaSyA0K4geAuueVfiItB_98-LkqRTnpYNUNvM",
        authDomain: "gameparadise-80490.firebaseapp.com",
        projectId: "gameparadise-80490",
        storageBucket: "gameparadise-80490.firebasestorage.app",
        messagingSenderId: "335620903527",
        appId: "1:335620903527:web:1bc1e01a386bf6e4e7fac2"
    };
    
    // Check dubbele init voorkomen
    if (typeof firebase !== 'undefined' && !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();

        auth.onAuthStateChanged(user => {
            if (user) {
                currentUser = user;
                loadFirebaseData();
            } else {
                auth.signInAnonymously().catch(e => console.warn("Auth failed:", e));
            }
        });
    }
};

function loadFirebaseData() {
    if (!db || !currentUser) return;
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
    }).catch(e => console.log("Offline mode or load error"));
}

function saveToFirebase(score) {
    if (!db || !currentUser) return;
    
    // Save Yellow Money & Skins
    db.collection("users").doc(currentUser.uid).collection("saveData").doc("greedySnake").set({
        yellowMoney: gameState.yellowMoney,
        ownedSkins: gameState.ownedSkins,
        selectedSkin: gameState.selectedSkin,
        lastScore: score,
        lastPlayed: firebase.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    // Save Highscore apart (voor eventuele leaderboards)
    db.collection("scores").add({
        playerName: gameState.playerName,
        score: score,
        uid: currentUser.uid,
        date: firebase.firestore.FieldValue.serverTimestamp()
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
    
    // Direct sync voor aankopen
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
const ctx = canvas.getContext('2d');
const startScreen = document.getElementById('startScreen');
const loadingScreen = document.getElementById('loadingScreen');
const gameScreen = document.getElementById('gameScreen');

let snakes = [], playerSnake = null, money = [], gameLoop = null, lastTime = 0;
let camera = { x: 0, y: 0, zoom: 2.0 };
let worldWidth = 3000, worldHeight = 2000;
let starPositions = [];

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
    setupUpgrades();
    updateYellowMoneyDisplay();
    
    document.addEventListener('mousemove', (e) => {
        if (e.clientX < 10 && !gameState.gameRunning && startScreen.classList.contains('active')) {
            openSkinsPage();
        }
    });

    window.addEventListener('resize', resizeCanvas);
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
            saveYellowMoney(gameState.yellowMoney); // Trigger save
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
                    statusEl.className = 'skin-status owned';
                } else {
                    statusEl.innerHTML = `${skin.cost} 💰`;
                    statusEl.className = 'skin-status locked';
                }
            }
        }
    });
    
    const skin = skins[currentSkinIndex];
    const selectBtn = document.getElementById('selectSkinBtn');
    if (gameState.ownedSkins.includes(skin.id)) {
        selectBtn.textContent = (gameState.selectedSkin === skin.id) ? 'Selected' : 'Select Skin';
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

function setupStartScreen() {
    document.getElementById('startButton').onclick = () => {
        gameState.playerName = document.getElementById('playerName').value || 'Player';
        startGame();
    };

    // Modals
    const setupModal = (type) => {
        document.querySelectorAll(`#${type}Modal .modal-option`).forEach(opt => {
            opt.onclick = function() {
                if(this.classList.contains('disabled')) return;
                
                if (type === 'map') gameState.selectedMap = this.dataset.map;
                if (type === 'size') gameState.mapSize = this.dataset.size;
                if (type === 'difficulty') gameState.botDifficulty = this.dataset.difficulty;
                
                document.getElementById(`${type}Value`).textContent = this.textContent;
                this.parentElement.querySelectorAll('.modal-option').forEach(b => b.classList.remove('active'));
                this.classList.add('active');
                document.getElementById(`${type}Modal`).classList.remove('active');
            };
        });
        
        document.getElementById(`${type}DisplayBtn`).onclick = (e) => {
            e.stopPropagation();
            document.querySelectorAll('.option-modal').forEach(m => m.classList.remove('active'));
            document.getElementById(`${type}Modal`).classList.add('active');
        };
    };

    setupModal('map');
    setupModal('size');
    setupModal('difficulty');

    window.onclick = () => document.querySelectorAll('.option-modal').forEach(m => m.classList.remove('active'));
}

function setupUpgrades() {
    // Koppel upgrade knoppen
    const bindUpgrade = (id, type) => {
        const btn = document.getElementById(id);
        if(btn) {
            btn.onclick = () => {
                if(playerSnake && playerSnake.alive) playerSnake.buyUpgrade(type);
            };
        }
    };
    bindUpgrade('upgradeSize', 'size');
    bindUpgrade('upgradeSpeed', 'speed');
    bindUpgrade('upgradeMultiplier', 'multiplier');
}

// --- 5. GAME ENGINE ---
function startGame() {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    
    // Configureren wereld
    const size = mapSizes[gameState.mapSize];
    worldWidth = size.width;
    worldHeight = size.height;
    
    // Stars genereren
    starPositions = [];
    for(let i=0; i<100; i++) {
        starPositions.push({
            x: Math.random() * worldWidth,
            y: Math.random() * worldHeight,
            size: Math.random() * 2 + 0.5
        });
    }

    setTimeout(() => {
        loadingScreen.classList.remove('active');
        gameScreen.classList.add('active');
        initGame();
    }, 1500);
}

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

function initGame() {
    resizeCanvas();
    snakes = [];
    money = [];

    const playerSkin = skins.find(s => s.id === gameState.selectedSkin);
    playerSnake = new Snake(worldWidth / 2, worldHeight / 2, playerSkin.color, true, gameState.playerName, playerSkin);
    snakes.push(playerSnake);

    const sizeCfg = mapSizes[gameState.mapSize];
    for (let i = 0; i < sizeCfg.maxBots; i++) {
        spawnBot();
    }

    for (let i = 0; i < sizeCfg.moneyAmount; i++) spawnMoney();

    setupInput();
    gameState.gameRunning = true;
    lastTime = performance.now();
    gameLoop = requestAnimationFrame(update);
}

function spawnBot() {
    const colors = ['#ff0000', '#00ffff', '#ffff00', '#ff8800', '#ff00ff'];
    let x, y;
    // Niet te dicht bij speler spawnen
    do {
        x = Math.random() * worldWidth;
        y = Math.random() * worldHeight;
    } while (playerSnake && Math.hypot(x - playerSnake.x, y - playerSnake.y) < 300);

    const bot = new Snake(x, y, colors[Math.floor(Math.random()*colors.length)], false, 'Bot ' + Math.floor(Math.random()*1000));
    bot.isBot = true;
    bot.difficulty = gameState.botDifficulty;
    snakes.push(bot);
}

function spawnMoney(amount = 1) {
    for(let i=0; i<amount; i++) {
        const type = Math.random() < 0.1 ? 'yellow' : 'green';
        money.push(new Money(Math.random() * worldWidth, Math.random() * worldHeight, type));
    }
}

function update(currentTime) {
    if (!gameState.gameRunning) return;
    const dt = currentTime - lastTime;
    lastTime = currentTime;

    // Update Snakes
    snakes.forEach(s => {
        s.update(dt, worldWidth, worldHeight);
        if(s.isBot) updateBotAI(s);
    });

    // Camera follow player
    if(playerSnake.alive) {
        camera.x += (playerSnake.x - canvas.width / camera.zoom / 2 - camera.x) * 0.1;
        camera.y += (playerSnake.y - canvas.height / camera.zoom / 2 - camera.y) * 0.1;
        // Clamp camera
        camera.x = Math.max(0, Math.min(camera.x, worldWidth - canvas.width/camera.zoom));
        camera.y = Math.max(0, Math.min(camera.y, worldHeight - canvas.height/camera.zoom));
    }

    // Check botsingen
    checkCollisions();

    // Collect Money
    checkMoneyCollection();

    // Respawn money & bots
    const sizeCfg = mapSizes[gameState.mapSize];
    if(money.length < sizeCfg.moneyAmount) spawnMoney(5);
    if(snakes.length - 1 < sizeCfg.maxBots && Math.random() < 0.02) spawnBot();

    // RENDER
    render();
    
    // UI Update
    updateGameUI();

    // Game Over Check
    if (!playerSnake.alive) {
        gameState.gameRunning = false;
        saveToFirebase(playerSnake.greenMoney);
        setTimeout(() => {
            gameScreen.classList.remove('active');
            startScreen.classList.add('active');
            updateYellowMoneyDisplay();
        }, 2000);
        return;
    }

    gameLoop = requestAnimationFrame(update);
}

function updateBotAI(bot) {
    if(!bot.alive) return;
    
    // Zoek dichtstbijzijnde geld
    let nearest = null;
    let minDist = Infinity;
    
    // Bot vision radius (afh. van difficulty)
    const vision = bot.difficulty === 'hard' ? 600 : 300;

    money.forEach(m => {
        const d = Math.hypot(m.x - bot.x, m.y - bot.y);
        if(d < minDist && d < vision) {
            minDist = d;
            nearest = m;
        }
    });

    if(nearest) {
        const dx = nearest.x - bot.x;
        const dy = nearest.y - bot.y;
        const dist = Math.hypot(dx, dy);
        
        // Simpele sturing
        const randomness = bot.difficulty === 'easy' ? 0.5 : 0.1;
        bot.dx += (dx/dist - bot.dx) * 0.1 + (Math.random()-0.5) * randomness;
        bot.dy += (dy/dist - bot.dy) * 0.1 + (Math.random()-0.5) * randomness;
        
        // Normaliseer
        const len = Math.hypot(bot.dx, bot.dy);
        bot.dx /= len;
        bot.dy /= len;
    }

    // Auto upgrade bots
    if(bot.greenMoney > 100 && Math.random() < 0.01) {
        if(Math.random() < 0.5) bot.buyUpgrade('size');
        else bot.buyUpgrade('speed');
    }
}

function checkCollisions() {
    for(let i=0; i<snakes.length; i++) {
        const s1 = snakes[i];
        if(!s1.alive) continue;

        for(let j=0; j<snakes.length; j++) {
            if(i===j) continue;
            const s2 = snakes[j];
            if(!s2.alive) continue;

            // Head to Head
            if(Math.hypot(s1.x - s2.x, s1.y - s2.y) < s1.size + s2.size) {
                s1.alive = false; s2.alive = false;
                dropMoney(s1); dropMoney(s2);
            }
            // Head to Body
            else {
                for(let k=0; k<s2.body.length; k+=2) { // Check om de 2 segmenten voor performance
                    if(Math.hypot(s1.x - s2.body[k].x, s1.y - s2.body[k].y) < s1.size) {
                        s1.alive = false;
                        dropMoney(s1);
                        break;
                    }
                }
            }
        }
    }
}

function checkMoneyCollection() {
    for (let i = money.length - 1; i >= 0; i--) {
        const m = money[i];
        for(let s of snakes) {
            if(!s.alive) continue;
            if (Math.hypot(s.x - m.x, s.y - m.y) < s.size + m.size) {
                if (m.type === 'yellow' && s.isPlayer) saveYellowMoney(gameState.yellowMoney + 1);
                if (m.type === 'green') s.greenMoney += m.value * s.multiplier;
                money.splice(i, 1);
                break; // Munt is weg
            }
        }
    }
}

function dropMoney(snake) {
    const amount = Math.floor(snake.greenMoney / 2);
    const count = Math.min(20, Math.ceil(amount / 10));
    for(let i=0; i<count; i++) {
        const r = Math.random() * 50;
        const a = Math.random() * Math.PI * 2;
        money.push(new Money(
            snake.x + Math.cos(a)*r, 
            snake.y + Math.sin(a)*r, 
            'green', 
            Math.max(10, Math.floor(amount/count))
        ));
    }
}

function render() {
    // Clear & Background
    ctx.fillStyle = gameState.selectedMap === 'stars' ? '#000' : '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Grid / Borders
    ctx.strokeStyle = '#333';
    ctx.strokeRect(0, 0, worldWidth, worldHeight);

    // Stars
    if(gameState.selectedMap === 'stars') {
        ctx.fillStyle = '#fff';
        starPositions.forEach(s => {
            ctx.globalAlpha = Math.random() * 0.5 + 0.5;
            ctx.beginPath(); ctx.arc(s.x, s.y, s.size, 0, Math.PI*2); ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // Money
    money.forEach(m => m.draw(ctx));

    // Snakes
    snakes.forEach(s => s.draw(ctx));

    ctx.restore();
}

function updateGameUI() {
    if(!playerSnake) return;
    document.getElementById('greenMoneyCount').textContent = Math.floor(playerSnake.greenMoney);
    
    // Update upgrade buttons text
    const updateBtn = (id, type, level) => {
        const btn = document.getElementById(id);
        const costEl = document.getElementById(type + 'Cost');
        const levelEl = document.getElementById(type + 'Level');
        if(btn && playerSnake) {
            const cost = playerSnake.getUpgradeCost(type);
            if(costEl) costEl.textContent = cost;
            if(levelEl) levelEl.textContent = level;
            btn.disabled = playerSnake.greenMoney < cost;
        }
    };
    
    updateBtn('upgradeSize', 'size', playerSnake.sizeLevel);
    updateBtn('upgradeSpeed', 'speed', playerSnake.speedLevel);
    updateBtn('upgradeMultiplier', 'multiplier', playerSnake.multiplierLevel);
}

function setupInput() {
    const handleMove = (x, y) => {
        if(!playerSnake || !playerSnake.alive) return;
        
        // Zet scherm coords om naar wereld coords
        const rect = canvas.getBoundingClientRect();
        const worldX = (x - rect.left) / camera.zoom + camera.x;
        const worldY = (y - rect.top) / camera.zoom + camera.y;
        
        const angle = Math.atan2(worldY - playerSnake.y, worldX - playerSnake.x);
        playerSnake.dx = Math.cos(angle);
        playerSnake.dy = Math.sin(angle);
    };

    canvas.onmousemove = (e) => handleMove(e.clientX, e.clientY);
    canvas.ontouchmove = (e) => {
        e.preventDefault();
        handleMove(e.touches[0].clientX, e.touches[0].clientY);
    };
}

// --- CLASSES ---
class Snake {
    constructor(x, y, color, isPlayer, name, skin = null) {
        this.x = x; this.y = y; this.color = color; this.isPlayer = isPlayer; this.name = name;
        this.skin = skin;
        this.size = 15; 
        this.speed = 150; 
        this.alive = true; 
        this.dx = 1; this.dy = 0;
        this.body = Array.from({length: 10}, () => ({x, y}));
        this.greenMoney = 0;
        
        // Upgrades
        this.sizeLevel = 1;
        this.speedLevel = 1;
        this.multiplierLevel = 1;
        this.multiplier = 1;
    }
    
    update(dt, w, h) {
        if (!this.alive) return;
        
        const step = (this.speed * dt) / 1000;
        
        // Move head
        let nextX = this.x + this.dx * step;
        let nextY = this.y + this.dy * step;

        // Wall collision (Stop or Clamp)
        if(nextX < 0 || nextX > w) this.dx = 0;
        if(nextY < 0 || nextY > h) this.dy = 0;
        
        this.x = Math.max(0, Math.min(w, nextX));
        this.y = Math.max(0, Math.min(h, nextY));

        // Update body
        this.body.unshift({x: this.x, y: this.y});
        
        // Body length calc
        const targetLen = 10 + (this.sizeLevel * 3);
        while(this.body.length > targetLen) this.body.pop();
    }
    
    draw(ctx) {
        if(!this.alive) return;
        const color = this.skin ? this.skin.color : this.color;
        
        // Draw Body
        this.body.forEach((p, i) => {
            ctx.globalAlpha = 1 - (i / this.body.length) * 0.6;
            ctx.fillStyle = color;
            
            // Vector skin is driehoekjes, anders rondjes
            if(this.skin && this.skin.type === 'vector') {
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate(Math.atan2(this.dy, this.dx));
                ctx.beginPath();
                ctx.moveTo(this.size, 0);
                ctx.lineTo(-this.size/2, this.size/2);
                ctx.lineTo(-this.size/2, -this.size/2);
                ctx.fill();
                ctx.restore();
            } else {
                ctx.beginPath(); ctx.arc(p.x, p.y, this.size, 0, Math.PI * 2); ctx.fill();
            }
        });
        
        // Draw Head (Extra detail)
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI*2); ctx.stroke();

        // Name
        ctx.fillStyle = '#fff';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y - this.size - 10);
    }

    getUpgradeCost(type) {
        const base = type === 'multiplier' ? 100 : 50;
        const lvl = type === 'size' ? this.sizeLevel : (type === 'speed' ? this.speedLevel : this.multiplierLevel);
        return Math.floor(base * Math.pow(1.5, lvl));
    }

    buyUpgrade(type) {
        const cost = this.getUpgradeCost(type);
        if(this.greenMoney >= cost) {
            this.greenMoney -= cost;
            if(type === 'size') {
                this.sizeLevel++;
                this.size += 1;
                if(this.isPlayer) camera.zoom = Math.max(0.5, camera.zoom - 0.05);
            }
            if(type === 'speed') {
                this.speedLevel++;
                this.speed += 20;
            }
            if(type === 'multiplier') {
                this.multiplierLevel++;
                this.multiplier += 0.5;
            }
        }
    }
}

class Money {
    constructor(x, y, type, value = 10) {
        this.x = x; this.y = y; this.type = type;
        this.value = value;
        this.size = type === 'yellow' ? 10 : 8;
    }
    draw(ctx) {
        ctx.fillStyle = this.type === 'yellow' ? '#FFD700' : '#22c55e';
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', this.x, this.y);
    }
}
