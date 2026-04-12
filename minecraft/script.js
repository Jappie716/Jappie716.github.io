// --- Data ---
const metroLines = [
    { line: "Lijn A", stop: "Centraal Station", time: "Elke 5 min" },
    { line: "Lijn A", stop: "Luchthaven MIA", time: "Elke 5 min" },
    { line: "Lijn B", stop: "Zakendistrict", time: "Elke 8 min" },
    { line: "Lijn C", stop: "Zuidwijk", time: "Elke 12 min" }
];

const flights = [
    { airline: "Elytra Air", dest: "Spawn City", time: "14:30", status: "Op tijd" },
    { airline: "Creeper Express", dest: "Nether Hub", time: "15:00", status: "Vertraagd" },
    { airline: "Villager Airlines", dest: "End Gateway", time: "16:15", status: "Instappen" }
];

const houses = [
    { id: 1, title: "Modern Appartement", desc: "Uitzicht op het centrum.", price: 150000, img: "https://via.placeholder.com/400x200?text=Appartement" },
    { id: 2, title: "Luxe Villa", desc: "Inclusief zwembad en tuin.", price: 850000, img: "https://via.placeholder.com/400x200?text=Villa" },
    { id: 3, title: "Gezellige Starterswoning", desc: "Dichtbij metrostation.", price: 95000, img: "https://via.placeholder.com/400x200?text=Starterswoning" }
];

// --- App State ---
let currentUser = JSON.parse(localStorage.getItem('mestlo_user')) || null;
let usersDb = JSON.parse(localStorage.getItem('mestlo_db')) || {};
let isLoginMode = true;

// --- Initialisatie ---
document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    renderData();
    updateUI();
});

// --- Navigatie ---
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    if(window.innerWidth <= 768) { document.querySelector('.nav-links').classList.remove('show'); }
}

function toggleMenu() {
    document.querySelector('.nav-links').classList.toggle('show');
}

// --- Dark Mode ---
const themeToggleBtn = document.getElementById('theme-toggle');
function initTheme() {
    if(localStorage.getItem('theme') === 'dark') {
        document.body.setAttribute('data-theme', 'dark');
        themeToggleBtn.innerText = '☀️';
    }
}
themeToggleBtn.addEventListener('click', () => {
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    if(isDark) {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggleBtn.innerText = '🌙';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggleBtn.innerText = '☀️';
    }
});

// --- Data Renderen ---
function renderData() {
    // Metro
    const metroContainer = document.getElementById('metro-data');
    metroLines.forEach(m => {
        metroContainer.innerHTML += `
            <div class="card">
                <h3>${m.line}</h3>
                <p><strong>Halte:</strong> ${m.stop}</p>
                <p><strong>Vertrek:</strong> ${m.time}</p>
            </div>`;
    });

    // Luchthaven
    const flightContainer = document.getElementById('flight-data');
    flights.forEach(f => {
        flightContainer.innerHTML += `
            <tr>
                <td>${f.airline}</td><td>${f.dest}</td><td>${f.time}</td>
                <td style="color: ${f.status === 'Vertraagd' ? 'var(--danger)' : 'var(--success)'}">${f.status}</td>
            </tr>`;
    });

    // Makelaar
    const estateContainer = document.getElementById('real-estate-data');
    houses.forEach(h => {
        estateContainer.innerHTML += `
            <div class="card">
                <img src="${h.img}" alt="${h.title}">
                <h3>${h.title}</h3>
                <p>${h.desc}</p>
                <h3 style="color: var(--primary)">€ ${h.price.toLocaleString()}</h3>
                <button class="btn-primary" onclick="buyHouse(${h.id}, ${h.price}, '${h.title}')">Kopen</button>
            </div>`;
    });
}

// --- Authenticatie Systeem ---
function showAuthPage() {
    if(currentUser) { showPage('dashboard'); } 
    else { showPage('auth'); }
}

function toggleAuthMode() {
    isLoginMode = !isLoginMode;
    document.getElementById('auth-title').innerText = isLoginMode ? 'Inloggen' : 'Registreren';
    document.getElementById('auth-submit-btn').innerText = isLoginMode ? 'Inloggen' : 'Registreren';
    document.querySelector('.toggle-text').innerHTML = isLoginMode ? 
        'Geen account? <a href="#" onclick="toggleAuthMode()">Registreer hier</a>' : 
        'Al een account? <a href="#" onclick="toggleAuthMode()">Log in</a>';
    document.getElementById('auth-error').innerText = '';
}

function handleAuth() {
    const userVal = document.getElementById('username').value.trim();
    const passVal = document.getElementById('password').value.trim();
    const errorEl = document.getElementById('auth-error');

    if(!userVal || !passVal) { errorEl.innerText = "Vul alle velden in."; return; }

    if(isLoginMode) {
        if(usersDb[userVal] && usersDb[userVal].password === passVal) {
            login(userVal);
        } else {
            errorEl.innerText = "Ongeldige inloggegevens.";
        }
    } else {
        if(usersDb[userVal]) {
            errorEl.innerText = "Gebruikersnaam bestaat al.";
        } else {
            usersDb[userVal] = { password: passVal, balance: 500000, properties: [], tickets: 0 };
            saveDb();
            login(userVal);
        }
    }
}

function login(username) {
    currentUser = username;
    localStorage.setItem('mestlo_user', JSON.stringify(currentUser));
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    updateUI();
    showPage('dashboard');
}

function logout() {
    currentUser = null;
    localStorage.removeItem('mestlo_user');
    updateUI();
    showPage('home');
}

function saveDb() { localStorage.setItem('mestlo_db', JSON.stringify(usersDb)); }

// --- Gebruikers Acties ---
function buyMetroTicket() {
    if(!currentUser) { alert("Je moet ingelogd zijn om een ticket te kopen!"); showPage('auth'); return; }
    let user = usersDb[currentUser];
    if(user.balance >= 2.50) {
        user.balance -= 2.50;
        user.tickets += 1;
        saveDb();
        alert("Metro ticket gekocht!");
        updateUI();
    } else { alert("Niet genoeg geld."); }
}

function buyHouse(id, price, title) {
    if(!currentUser) { alert("Je moet ingelogd zijn om een huis te kopen!"); showPage('auth'); return; }
    let user = usersDb[currentUser];
    
    if(user.properties.includes(title)) {
        alert("Je bezit dit huis al!"); return;
    }

    if(user.balance >= price) {
        user.balance -= price;
        user.properties.push(title);
        saveDb();
        alert("Gefeliciteerd! Je hebt '" + title + "' gekocht!");
        updateUI();
        showPage('dashboard');
    } else {
        alert("Je hebt niet genoeg geld op je rekening. Saldo: €" + user.balance.toLocaleString());
    }
}

// --- UI Updates ---
function updateUI() {
    const authBtn = document.getElementById('auth-btn');
    if(currentUser) {
        authBtn.innerText = "Dashboard";
        const user = usersDb[currentUser];
        document.getElementById('dash-username').innerText = currentUser;
        document.getElementById('dash-balance').innerText = '€ ' + user.balance.toLocaleString();
        document.getElementById('dash-tickets').innerText = user.tickets;
        
        const propsEl = document.getElementById('dash-properties');
        propsEl.innerHTML = user.properties.length > 0 
            ? user.properties.map(p => `<li>${p}</li>`).join('')
            : "<li>Je bezit nog geen huizen.</li>";
    } else {
        authBtn.innerText = "Inloggen";
    }
}
