// --- FIREBASE INITIALISATIE (Toegevoegd aan origineel) ---
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
            // Laad data uit cloud
            db.collection("users").doc(currentUser.uid).collection("saveData").doc("greedySnake").get().then(doc => {
                if (doc.exists) {
                    const data = doc.data();
                    if (data.yellowMoney !== undefined) {
                        gameState.yellowMoney = data.yellowMoney;
                        gameState.ownedSkins = data.ownedSkins || ["ball-green"];
                        gameState.selectedSkin = data.selectedSkin || "ball-green";
                        updateYellowMoneyDisplay();
                        if (typeof updateSkinsDisplay === "function") updateSkinsDisplay();
                    }
                }
            });
        }
    });
};

// --- ORIGINELE GAME STATE ---
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

// Checksum functions to prevent console hacking
function getYellowMoneyChecksum(amount) {
    return (amount * 17 + 42) % 1000000;
}

function getValidatedYellowMoney() {
    const amount = parseInt(localStorage.getItem('yellowMoney') || '0');
    const storedChecksum = parseInt(localStorage.getItem('yellowMoneyChecksum') || '0');
    const expectedChecksum = getYellowMoneyChecksum(amount);
    
    if (storedChecksum !== expectedChecksum) {
        localStorage.setItem('yellowMoney', '0');
        localStorage.setItem('yellowMoneyChecksum', getYellowMoneyChecksum(0).toString());
        return 0;
    }
    return amount;
}

// Aangepaste save functie met stille cloud sync
function saveYellowMoney(amount) {
    const validAmount = Math.max(0, Math.min(amount, 999999999));
    gameState.yellowMoney = validAmount;
    localStorage.setItem('yellowMoney', validAmount.toString());
    localStorage.setItem('yellowMoneyChecksum', getYellowMoneyChecksum(validAmount).toString());
    
    if (currentUser && db) {
        db.collection("users").doc(currentUser.uid).collection("saveData").doc("greedySnake").set({
            yellowMoney: gameState.yellowMoney,
            ownedSkins: gameState.ownedSkins,
            selectedSkin: gameState.selectedSkin
        }, { merge: true });
    }
}

// Vanaf hier is ALLES 1-op-1 jouw originele code
const canvas = document.getElementById('gameCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const startScreen = document.getElementById('startScreen');
const loadingScreen = document.getElementById('loadingScreen');
const gameScreen = document.getElementById('gameScreen');

let snakes = [];
let playerSnake = null;
let money = [];
let gameLoop = null;
let lastTime = 0;
let camera = { x: 0, y: 0, zoom: 2.0 };
let worldWidth = 3000;
let worldHeight = 2000;

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
    const prevBtn = document.getElementById('prevSkinBtn');
    const nextBtn = document.getElementById('nextSkinBtn');
    const selectBtn = document.getElementById('selectSkinBtn');
    const backBtn = document.getElementById('backButton');

    prevBtn.addEventListener('click', () => {
        currentSkinIndex = (currentSkinIndex - 1 + skins.length) % skins.length;
        updateSkinsDisplay();
    });

    nextBtn.addEventListener('click', () => {
        currentSkinIndex = (currentSkinIndex + 1) % skins.length;
        updateSkinsDisplay();
    });

    backBtn.addEventListener('click', closeSkinsPage);

    selectBtn.addEventListener('click', () => {
        const skin = skins[currentSkinIndex];
        if (gameState.ownedSkins.includes(skin.id)) {
            gameState.selectedSkin = skin.id;
            localStorage.setItem('selectedSkin', skin.id);
            saveYellowMoney(gameState.yellowMoney); 
            closeSkinsPage();
        } else {
            if (gameState.yellowMoney >= skin.cost) {
                saveYellowMoney(gameState.yellowMoney - skin.cost);
                gameState.ownedSkins.push(skin.id);
                localStorage.setItem('ownedSkins', JSON.stringify(gameState.ownedSkins));
                gameState.selectedSkin = skin.id;
                localStorage.setItem('selectedSkin', skin.id);
                updateSkinsDisplay();
                updateYellowMoneyDisplay();
            }
        }
    });

    updateSkinsDisplay();
}

function updateSkinsDisplay() {
    skins.forEach((skin, index) => {
        const item = document.getElementById('skinItem' + index);
        if (item) {
            if (index === currentSkinIndex) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
            
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
        }
    });
    
    const skin = skins[currentSkinIndex];
    const selectBtn = document.getElementById('selectSkinBtn');
    if (gameState.ownedSkins.includes(skin.id)) {
        selectBtn.textContent = 'Select Skin';
    } else {
        selectBtn.textContent = `Buy for ${skin.cost} 💰`;
    }
}

function updateYellowMoneyDisplay() {
    const countStart = document.getElementById('yellowMoneyCount');
    const countSkins = document.getElementById('yellowMoneySkins');
    const countGame = document.getElementById('yellowMoneyCountGame');
    
    if (countStart) countStart.textContent = gameState.yellowMoney;
    if (countSkins) countSkins.textContent = gameState.yellowMoney;
    if (countGame) countGame.textContent = gameState.yellowMoney;
}

function setupStartScreen() {
    const startBtn = document.getElementById('startButton');
    const playerNameInput = document.getElementById('playerName');
    
    startBtn.addEventListener('click', () => {
        gameState.playerName = playerNameInput.value || 'Player';
        startGame();
    });

    document.querySelectorAll('.modal-option').forEach(option => {
        option.addEventListener('click', function() {
            const parentModal = this.closest('.option-modal').id;
            const value = this.dataset.map || this.dataset.size || this.dataset.difficulty;
            
            if (parentModal === 'mapModal') {
                gameState.selectedMap = value;
                document.getElementById('mapValue').textContent = this.querySelector('span').textContent;
            } else if (parentModal === 'sizeModal') {
                gameState.mapSize = value;
                document.getElementById('sizeValue').textContent = this.textContent;
            } else if (parentModal === 'difficultyModal') {
                gameState.botDifficulty = value;
                document.getElementById('difficultyValue').textContent = this.textContent;
            }
            
            this.parentElement.querySelectorAll('.modal-option').forEach(opt => opt.classList.remove('active'));
            this.classList.add('active');
        });
    });

    ['map', 'size', 'difficulty'].forEach(type => {
        const btn = document.getElementById(`${type}DisplayBtn`);
        const modal = document.getElementById(`${type}Modal`);
        
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.option-modal').forEach(m => {
                if (m !== modal) m.classList.remove('active');
            });
            modal.classList.toggle('active');
        });
    });

    document.addEventListener('click', () => {
        document.querySelectorAll('.option-modal').forEach(m => m.classList.remove('active'));
    });
}

function startGame() {
    startScreen.classList.remove('active');
    loadingScreen.classList.add('active');
    
    const selectedSize = mapSizes[gameState.mapSize];
    worldWidth = selectedSize.width;
    worldHeight = selectedSize.height;
    
    setTimeout(() => {
        loadingScreen.classList.remove('active');
        gameScreen.classList.add('active');
        initGame();
    }, 1500);
}

function initGame() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    
    snakes = [];
    money = [];
    
    const selectedSkinObj = skins.find(s => s.id === gameState.selectedSkin);
    playerSnake = new Snake(worldWidth / 2, worldHeight / 2, '#00ff00', true, gameState.playerName, selectedSkinObj);
    snakes.push(playerSnake);
    
    const sizeConfig = mapSizes[gameState.mapSize];
    for (let i = 0; i < sizeConfig.maxBots; i++) {
        const x = Math.random() * worldWidth;
        const y = Math.random() * worldHeight;
        const bot = new Snake(x, y, getRandomColor(), false, getRandomBotName());
        bot.isBot = true;
        bot.difficulty = gameState.botDifficulty;
        snakes.push(bot);
    }
    
    for (let i = 0; i < sizeConfig.moneyAmount; i++) {
        spawnMoney();
    }
    
    setupInput();
    setupUpgrades();
    
    gameState.gameRunning = true;
    lastTime = performance.now();
    gameLoop = requestAnimationFrame(update);
}

function spawnMoney() {
    const x = Math.random() * worldWidth;
    const y = Math.random() * worldHeight;
    const type = Math.random() > 0.9 ? 'yellow' : 'green';
    const value = type === 'yellow' ? 1 : 10;
    money.push(new Money(x, y, type, value));
}

function getRandomColor() {
    const colors = ['#ff4444', '#4444ff', '#ff44ff', '#ffff44', '#44ffff', '#ff8844'];
    return colors[Math.floor(Math.random() * colors.length)];
}

function getRandomBotName() {
    const names = ['Snakey', 'Slither', 'LongOne', 'Greedy', 'Python', 'Viper', 'Cobra', 'Mamba'];
    return names[Math.floor(Math.random() * names.length)] + Math.floor(Math.random() * 100);
}

function setupInput() {
    window.addEventListener('resize', () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    });

    canvas.addEventListener('mousemove', (e) => {
        if (!playerSnake || !playerSnake.alive) return;
        
        const rect = canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldMouseX = (mouseX - canvas.width / 2) / camera.zoom + playerSnake.x;
        const worldMouseY = (mouseY - canvas.height / 2) / camera.zoom + playerSnake.y;
        
        const dx = worldMouseX - playerSnake.x;
        const dy = worldMouseY - playerSnake.y;
        
        playerSnake.setTargetAngle(Math.atan2(dy, dx));
    });

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 0 && playerSnake) playerSnake.boosting = true;
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 0 && playerSnake) playerSnake.boosting = false;
    });
}

function setupUpgrades() {
    const upgradeBtns = {
        'size': document.getElementById('upgradeSize'),
        'speed': document.getElementById('upgradeSpeed'),
        'multiplier': document.getElementById('upgradeMultiplier')
    };

    Object.entries(upgradeBtns).forEach(([type, btn]) => {
        btn.onclick = () => {
            if (playerSnake && playerSnake.alive) {
                playerSnake.buyUpgrade(type);
            }
        };
    });
}

function update(currentTime) {
    if (!gameState.gameRunning) return;
    
    const deltaTime = currentTime - lastTime;
    lastTime = currentTime;
    
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    if (playerSnake && playerSnake.alive) {
        const targetZoom = 2.0 / (1 + (playerSnake.size - 15) * 0.01);
        camera.zoom += (targetZoom - camera.zoom) * 0.05;
        
        camera.x = playerSnake.x;
        camera.y = playerSnake.y;
    }
    
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);
    
    drawGrid();
    
    for (let i = money.length - 1; i >= 0; i--) {
        money[i].draw(ctx);
    }
    
    snakes.forEach(snake => {
        if (snake.alive) {
            snake.update(deltaTime, snakes, money);
            snake.draw(ctx);
        }
    });
    
    ctx.restore();
    
    updateUI();
    
    if (playerSnake && !playerSnake.alive) {
        gameOver();
        return;
    }
    
    gameLoop = requestAnimationFrame(update);
}

function drawGrid() {
    ctx.beginPath();
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 1;
    
    const gridSize = 100;
    const startX = Math.floor((camera.x - canvas.width / camera.zoom) / gridSize) * gridSize;
    const endX = Math.ceil((camera.x + canvas.width / camera.zoom) / gridSize) * gridSize;
    const startY = Math.floor((camera.y - canvas.height / camera.zoom) / gridSize) * gridSize;
    const endY = Math.ceil((camera.y + canvas.height / camera.zoom) / gridSize) * gridSize;
    
    for (let x = Math.max(0, startX); x <= Math.min(worldWidth, endX); x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, worldHeight);
    }
    
    for (let y = Math.max(0, startY); y <= Math.min(worldHeight, endY); y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(worldWidth, y);
    }
    ctx.stroke();
    
    ctx.strokeStyle = '#3b82f6';
    ctx.lineWidth = 5;
    ctx.strokeRect(0, 0, worldWidth, worldHeight);
}

function updateUI() {
    if (!playerSnake) return;
    document.getElementById('greenMoneyCount').textContent = Math.floor(playerSnake.greenMoney);
    document.getElementById('sizeLevel').textContent = playerSnake.upgrades.size;
    document.getElementById('speedLevel').textContent = playerSnake.upgrades.speed;
    document.getElementById('multiplierLevel').textContent = playerSnake.upgrades.multiplier;
    document.getElementById('sizeCost').textContent = playerSnake.getUpgradeCost('size');
    document.getElementById('speedCost').textContent = playerSnake.getUpgradeCost('speed');
    document.getElementById('multiplierCost').textContent = playerSnake.getUpgradeCost('multiplier');
    updateYellowMoneyDisplay();
}

function gameOver() {
    gameState.gameRunning = false;
    cancelAnimationFrame(gameLoop);
    
    const overlay = document.createElement('div');
    overlay.className = 'game-over-overlay';
    overlay.innerHTML = `
        <div class="game-over-content">
            <h1>Game Over</h1>
            <p>You earned $${Math.floor(playerSnake.greenMoney)}</p>
            <button onclick="location.reload()">Back to Menu</button>
        </div>
    `;
    document.body.appendChild(overlay);
}

// --- ORIGINELE CLASSES (Niet aangepast) ---
class Snake {
    constructor(x, y, color, isPlayer, name, skin = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.isPlayer = isPlayer;
        this.name = name;
        this.alive = true;
        this.size = 15;
        this.angle = Math.random() * Math.PI * 2;
        this.targetAngle = this.angle;
        this.speed = 150;
        this.baseSpeed = 150;
        this.boosting = false;
        this.segments = [];
        this.history = [];
        this.maxSegments = 10;
        this.greenMoney = 0;
        this.isBot = false;
        this.difficulty = 'easy';
        this.skin = skin;
        
        this.upgrades = { size: 1, speed: 1, multiplier: 1 };
        
        for (let i = 0; i < this.maxSegments; i++) {
            this.segments.push({ x: x, y: y });
        }
    }
    
    setTargetAngle(angle) {
        this.targetAngle = angle;
    }
    
    getUpgradeCost(type) {
        return Math.floor(10 * Math.pow(1.5, this.upgrades[type] - 1));
    }
    
    buyUpgrade(type, shouldZoom = true) {
        const cost = this.getUpgradeCost(type);
        if (this.greenMoney >= cost) {
            this.greenMoney -= cost;
            this.upgrades[type]++;
            
            if (type === 'size') {
                this.size += 2;
                this.maxSegments += 2;
            } else if (type === 'speed') {
                this.baseSpeed += 20;
            } else if (type === 'multiplier') {
                // Multiplier level increases
            }
            
            if (this.isPlayer && shouldZoom) {
                camera.zoom = 2.0 / (1 + (this.size - 15) * 0.01);
            }
            return true;
        }
        return false;
    }
    
    update(deltaTime, allSnakes, allMoney) {
        if (!this.alive) return;
        
        if (this.isBot) this.updateBotAI(allMoney);
        
        let angleDiff = this.targetAngle - this.angle;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        this.angle += angleDiff * 0.1;
        
        this.speed = this.baseSpeed;
        if (this.boosting && this.greenMoney > 0) {
            this.speed *= 2;
            this.greenMoney -= 0.1;
        }
        
        const velocity = (this.speed * deltaTime) / 1000;
        this.x += Math.cos(this.angle) * velocity;
        this.y += Math.sin(this.angle) * velocity;
        
        if (this.x < 0 || this.x > worldWidth || this.y < 0 || this.y > worldHeight) {
            this.alive = false;
        }
        
        this.history.unshift({ x: this.x, y: this.y });
        const segmentSpacing = this.size * 0.8;
        
        for (let i = 0; i < this.segments.length; i++) {
            const index = Math.floor((i + 1) * segmentSpacing / (velocity || 1));
            if (this.history[index]) {
                this.segments[i] = { ...this.history[index] };
            }
        }
        
        if (this.history.length > this.segments.length * segmentSpacing) {
            this.history.pop();
        }
        
        allMoney.forEach((m, index) => {
            const dist = Math.hypot(this.x - m.x, this.y - m.y);
            if (dist < this.size + m.size) {
                if (m.type === 'yellow' && this.isPlayer) {
                    saveYellowMoney(gameState.yellowMoney + m.value);
                } else {
                    this.greenMoney += m.value * (1 + (this.upgrades.multiplier - 1) * 0.2);
                }
                allMoney.splice(index, 1);
                spawnMoney();
            }
        });
        
        allSnakes.forEach(other => {
            if (other === this || !other.alive) return;
            
            other.segments.forEach(seg => {
                const dist = Math.hypot(this.x - seg.x, this.y - seg.y);
                if (dist < this.size + other.size * 0.8) {
                    this.alive = false;
                }
            });
        });
    }
    
    draw(ctx) {
        ctx.save();
        
        for (let i = this.segments.length - 1; i >= 0; i--) {
            const seg = this.segments[i];
            const alpha = 1 - (i / this.segments.length) * 0.6;
            
            ctx.globalAlpha = alpha;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.arc(seg.x, seg.y, this.size * (1 - i * 0.02), 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.globalAlpha = 1;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const eyeX = Math.cos(this.angle) * (this.size * 0.5);
        const eyeY = Math.sin(this.angle) * (this.size * 0.5);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(this.x + eyeX, this.y + eyeY, this.size * 0.3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(this.x + eyeX + Math.cos(this.angle) * 2, this.y + eyeY + Math.sin(this.angle) * 2, this.size * 0.15, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${12 / camera.zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x, this.y - this.size - 10);
        
        ctx.restore();
    }
    
    updateBotAI(allMoney) {
        let nearest = null;
        let minDist = Infinity;
        
        allMoney.forEach(m => {
            const d = Math.hypot(this.x - m.x, this.y - m.y);
            if (d < minDist) {
                minDist = d;
                nearest = m;
            }
        });
        
        if (nearest) {
            this.targetAngle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
        }
        
        const upgrades = ['size', 'speed', 'multiplier'];
        const randomUpgrade = upgrades[Math.floor(Math.random() * upgrades.length)];
        if (this.greenMoney >= this.getUpgradeCost(randomUpgrade)) {
            this.buyUpgrade(randomUpgrade, false);
        }
    }
}

class Money {
    constructor(x, y, type, value) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.value = value;
        this.size = type === 'green' ? 8 : 10;
        this.rotation = Math.random() * Math.PI * 2;
        this.rotationSpeed = (Math.random() - 0.5) * 0.02;
    }
    
    update() {
        this.rotation += this.rotationSpeed;
    }
    
    draw(ctx) {
        this.update();
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (this.type === 'green') {
            ctx.fillStyle = '#00ff00';
        } else {
            ctx.fillStyle = '#FFD700';
        }
        
        ctx.beginPath();
        ctx.arc(0, 0, this.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.restore();
    }
}
