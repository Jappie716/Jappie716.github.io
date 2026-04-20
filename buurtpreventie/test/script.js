import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- CONFIGURATIE ---
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

let currentUserProfile = null;
let currentDoorbellId = null;

// --- HULPFUNCTIES (Eén keer gedefinieerd) ---
const getEmail = () => document.getElementById('email').value;
const getPassword = () => document.getElementById('password').value;

// --- AUTHENTICATIE ACTIES ---
document.getElementById('login-btn').onclick = () => {
    signInWithEmailAndPassword(auth, getEmail(), getPassword())
        .catch(e => alert("Inloggen mislukt: " + e.message));
};

document.getElementById('register-btn').onclick = () => {
    createUserWithEmailAndPassword(auth, getEmail(), getPassword())
        .catch(e => alert("Registratie mislukt: " + e.message));
};

document.getElementById('logout-btn').onclick = () => signOut(auth);

// --- AUTH CONTROLE ---
onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const onboardingForm = document.getElementById('onboarding-form');

    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            currentUserProfile = snap.data();
            startApp();
        } else {
            authScreen.classList.remove('hidden');
            loginForm.classList.add('hidden');
            onboardingForm.classList.remove('hidden');
        }
    } else {
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
        loginForm.classList.remove('hidden');
        onboardingForm.classList.add('hidden');
    }
});

// --- PROFIEL OPSLAAN (Onboarding) ---
document.getElementById('save-profile-btn').onclick = async () => {
    const leeftijdInput = document.getElementById('leeftijd').value;
    const profiel = {
        username: document.getElementById('username').value.trim(),
        huisnummer: document.getElementById('huisnummer').value.trim(),
        leeftijd: leeftijdInput ? parseInt(leeftijdInput) : null,
        geslacht: document.getElementById('geslacht').value,
        darkMode: false
    };
    if(!profiel.username) return alert("Kies een gebruikersnaam!");
    
    await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
    currentUserProfile = profiel;
    startApp();
};

// --- APP STARTEN ---
function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
    
    // Dark mode herstellen
    document.body.className = currentUserProfile.darkMode ? 'dark-mode' : 'light-mode';
    document.getElementById('dark-toggle').checked = !!currentUserProfile.darkMode;
    
    initChat();
    loadMap();
    initMapControls();
    listenForDoorbells();
    if (window.lucide) lucide.createIcons();
}

// --- KAART: STRAAT 55-70 ---
// Oneven nummers (55,57,59,...69) staan BOVEN de straat, even (56,58,...70) ONDER
// SVG viewBox: 900x560, straat van y=242 tot y=330
// Huizen boven: cy ≈ 165 (voor de stoep op y=230)
// Huizen onder: cy ≈ 400 (na de stoep op y=330)
// Horizontale spreiding: x van 155 tot 720, 8 percelen per kant = stap ~80px

const HOUSE_NUMBERS = [55,56,57,58,59,60,61,62,63,64,65,66,67,68,69,70];
const ABOVE_X = [170, 240, 310, 380, 450, 520, 590, 660]; // oneven: 55,57,59,61,63,65,67,69
const BELOW_X = [170, 240, 310, 380, 450, 520, 590, 660]; // even:   56,58,60,62,64,66,68,70
const ABOVE_Y = 160; // cy voor huizen boven straat
const BELOW_Y = 400; // cy voor huizen onder straat

function getPlotByHuisnummer(nr) {
    const n = parseInt(nr);
    if (n < 55 || n > 70) return null;
    const isOdd = n % 2 !== 0;
    const idx = isOdd ? (n - 55) / 2 : (n - 56) / 2;
    const cx = isOdd ? ABOVE_X[idx] : BELOW_X[idx];
    const cy = isOdd ? ABOVE_Y : BELOW_Y;
    return { cx, cy };
}

// SVG huis tekenfunctie
function drawHouseSVG(cx, cy, isMe, uid, data) {
    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", isMe ? "svg-house my-house" : "svg-house neighbor-house");
    g.setAttribute("data-uid", uid);
    g.style.cursor = "pointer";

    // Kleurpalet per huis iets variëren op basis van huisnummer
    const n = parseInt(data.huisnummer) || 0;
    const wallColors  = ["#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#f97316","#84cc16","#14b8a6"];
    const roofColors  = ["#d97706","#dc2626","#7c3aed","#0891b2","#db2777","#ea580c","#65a30d","#0d9488"];

    const wallColor = isMe ? "#2563eb" : wallColors[n % wallColors.length];
    const roofColor = isMe ? "#1d4ed8" : roofColors[n % roofColors.length];
    const doorColor = isMe ? "#1e3a8a" : "#78350f";
    const windowColor = isMe ? "#bfdbfe" : "#fef9c3";

    // Of het huis boven of onder staat bepaalt richting stoeppad
    const isAbove = cy < 300;

    // Perceel gras
    const plot = document.createElementNS(ns, "rect");
    plot.setAttribute("x", cx - 32); plot.setAttribute("y", cy - 10);
    plot.setAttribute("width", 64); plot.setAttribute("height", 44);
    plot.setAttribute("fill", isMe ? "#bbf7d0" : "#d1fae5"); plot.setAttribute("rx", "4");
    g.appendChild(plot);

    // Muren
    const wall = document.createElementNS(ns, "rect");
    wall.setAttribute("x", cx - 24); wall.setAttribute("y", cy - 32);
    wall.setAttribute("width", 48); wall.setAttribute("height", 34);
    wall.setAttribute("fill", wallColor); wall.setAttribute("rx", "3");
    g.appendChild(wall);

    // Dak
    const roof = document.createElementNS(ns, "polygon");
    roof.setAttribute("points", `${cx - 28},${cy - 32} ${cx + 28},${cy - 32} ${cx},${cy - 58}`);
    roof.setAttribute("fill", roofColor);
    g.appendChild(roof);

    // Schoorsteen
    const chimney = document.createElementNS(ns, "rect");
    chimney.setAttribute("x", cx + 9); chimney.setAttribute("y", cy - 58);
    chimney.setAttribute("width", 7); chimney.setAttribute("height", 16);
    chimney.setAttribute("fill", roofColor);
    g.appendChild(chimney);

    // Linker raam
    const win1 = document.createElementNS(ns, "rect");
    win1.setAttribute("x", cx - 20); win1.setAttribute("y", cy - 28);
    win1.setAttribute("width", 13); win1.setAttribute("height", 11);
    win1.setAttribute("fill", windowColor); win1.setAttribute("rx", "2");
    g.appendChild(win1);
    // Raamkruisje
    const wl1 = document.createElementNS(ns, "line");
    wl1.setAttribute("x1", cx - 14); wl1.setAttribute("y1", cy - 28);
    wl1.setAttribute("x2", cx - 14); wl1.setAttribute("y2", cy - 17);
    wl1.setAttribute("stroke", "rgba(0,0,0,0.2)"); wl1.setAttribute("stroke-width", "0.8");
    g.appendChild(wl1);

    // Rechter raam
    const win2 = document.createElementNS(ns, "rect");
    win2.setAttribute("x", cx + 7); win2.setAttribute("y", cy - 28);
    win2.setAttribute("width", 13); win2.setAttribute("height", 11);
    win2.setAttribute("fill", windowColor); win2.setAttribute("rx", "2");
    g.appendChild(win2);
    const wl2 = document.createElementNS(ns, "line");
    wl2.setAttribute("x1", cx + 13); wl2.setAttribute("y1", cy - 28);
    wl2.setAttribute("x2", cx + 13); wl2.setAttribute("y2", cy - 17);
    wl2.setAttribute("stroke", "rgba(0,0,0,0.2)"); wl2.setAttribute("stroke-width", "0.8");
    g.appendChild(wl2);

    // Deur
    const door = document.createElementNS(ns, "rect");
    door.setAttribute("x", cx - 7); door.setAttribute("y", cy - 14);
    door.setAttribute("width", 14); door.setAttribute("height", 18);
    door.setAttribute("fill", doorColor); door.setAttribute("rx", "2");
    g.appendChild(door);

    // Deurklink
    const knob = document.createElementNS(ns, "circle");
    knob.setAttribute("cx", cx + 4); knob.setAttribute("cy", cy - 5);
    knob.setAttribute("r", "1.8"); knob.setAttribute("fill", "#fde68a");
    g.appendChild(knob);

    // Stoeppad richting straat
    const pathEl = document.createElementNS(ns, "rect");
    pathEl.setAttribute("x", cx - 4); pathEl.setAttribute("y", isAbove ? cy + 4 : cy - 62);
    pathEl.setAttribute("width", 8); pathEl.setAttribute("height", isAbove ? 18 : 18);
    pathEl.setAttribute("fill", "#d4c89a"); pathEl.setAttribute("rx", "1");
    g.appendChild(pathEl);

    // Huisnummer badge
    const badgeBg = document.createElementNS(ns, "rect");
    badgeBg.setAttribute("x", cx - 14); badgeBg.setAttribute("y", cy + isAbove ? cy + 24 : cy - 50);
    const badgeY = isAbove ? cy + 24 : cy - 70;
    badgeBg.setAttribute("x", cx - 14); badgeBg.setAttribute("y", badgeY);
    badgeBg.setAttribute("width", 28); badgeBg.setAttribute("height", 13);
    badgeBg.setAttribute("fill", roofColor); badgeBg.setAttribute("rx", "3");
    g.appendChild(badgeBg);

    const badge = document.createElementNS(ns, "text");
    badge.setAttribute("x", cx); badge.setAttribute("y", badgeY + 9.5);
    badge.setAttribute("text-anchor", "middle"); badge.setAttribute("font-size", "8");
    badge.setAttribute("font-weight", "700"); badge.setAttribute("fill", "white");
    badge.setAttribute("font-family", "Segoe UI, sans-serif");
    badge.textContent = data.huisnummer || "?";
    g.appendChild(badge);

    // Naam label
    const labelBg = document.createElementNS(ns, "rect");
    const labelY = isAbove ? cy + 39 : cy - 85;
    labelBg.setAttribute("x", cx - 30); labelBg.setAttribute("y", labelY);
    labelBg.setAttribute("width", 60); labelBg.setAttribute("height", 13);
    labelBg.setAttribute("fill", "white"); labelBg.setAttribute("rx", "3");
    labelBg.setAttribute("opacity", "0.88");
    g.appendChild(labelBg);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", cx); label.setAttribute("y", labelY + 9.5);
    label.setAttribute("text-anchor", "middle"); label.setAttribute("font-size", "8");
    label.setAttribute("font-weight", "600"); label.setAttribute("fill", "#1f2937");
    label.setAttribute("font-family", "Segoe UI, sans-serif");
    label.textContent = (data.username || "?").substring(0, 9);
    g.appendChild(label);

    // Hover & klik
    g.addEventListener("mouseenter", () => showSVGTooltip(cx, cy, uid, data, isMe, isAbove));
    g.addEventListener("mouseleave", hideSVGTooltip);
    g.addEventListener("click", () => { if (isMe) showTab('huis'); });

    return g;
}

function showSVGTooltip(cx, cy, uid, data, isMe, isAbove) {
    const ns = "http://www.w3.org/2000/svg";
    const layer = document.getElementById("tooltip-layer");
    if (!layer) return;
    hideSVGTooltip();

    const W = 140, H = isMe ? 62 : 78;
    let tx = cx - W / 2;
    let ty = isAbove ? cy - H - 75 : cy + 60;
    if (tx < 4) tx = 4;
    if (tx + W > 896) tx = 896 - W;
    if (ty < 4) ty = cy + 60;
    if (ty + H > 555) ty = cy - H - 70;

    const g = document.createElementNS(ns, "g");
    g.setAttribute("id", "svg-tooltip");

    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("x", tx); bg.setAttribute("y", ty);
    bg.setAttribute("width", W); bg.setAttribute("height", H);
    bg.setAttribute("fill", "white"); bg.setAttribute("rx", "8");
    bg.setAttribute("filter", "url(#shadow)");
    g.appendChild(bg);

    // Naam
    const name = document.createElementNS(ns, "text");
    name.setAttribute("x", tx + 10); name.setAttribute("y", ty + 17);
    name.setAttribute("font-size", "11"); name.setAttribute("font-weight", "700");
    name.setAttribute("fill", "#1f2937"); name.setAttribute("font-family", "Segoe UI, sans-serif");
    name.textContent = (data.username || "Onbekend").substring(0, 14);
    g.appendChild(name);

    // Adres + leeftijd
    const addr = document.createElementNS(ns, "text");
    addr.setAttribute("x", tx + 10); addr.setAttribute("y", ty + 32);
    addr.setAttribute("font-size", "9"); addr.setAttribute("fill", "#64748b");
    addr.setAttribute("font-family", "Segoe UI, sans-serif");
    addr.textContent = `Wijkstraat ${data.huisnummer || "?"} · ${data.leeftijd ? data.leeftijd + " jr" : "-"}`;
    g.appendChild(addr);

    if (!isMe) {
        const btnBg = document.createElementNS(ns, "rect");
        btnBg.setAttribute("x", tx + 10); btnBg.setAttribute("y", ty + 42);
        btnBg.setAttribute("width", W - 20); btnBg.setAttribute("height", 24);
        btnBg.setAttribute("fill", "#2563eb"); btnBg.setAttribute("rx", "5");
        btnBg.style.cursor = "pointer";
        btnBg.addEventListener("click", () => window.ringDoorbell(uid, data.username));
        g.appendChild(btnBg);

        const btnTxt = document.createElementNS(ns, "text");
        btnTxt.setAttribute("x", tx + W / 2); btnTxt.setAttribute("y", ty + 57);
        btnTxt.setAttribute("text-anchor", "middle"); btnTxt.setAttribute("font-size", "9.5");
        btnTxt.setAttribute("fill", "white"); btnTxt.setAttribute("font-weight", "700");
        btnTxt.setAttribute("font-family", "Segoe UI, sans-serif");
        btnTxt.textContent = "Aanbellen";
        btnTxt.style.cursor = "pointer";
        btnTxt.addEventListener("click", () => window.ringDoorbell(uid, data.username));
        g.appendChild(btnTxt);
    }

    g.addEventListener("mouseleave", hideSVGTooltip);
    layer.appendChild(g);
}

function hideSVGTooltip() {
    const t = document.getElementById("svg-tooltip");
    if (t) t.remove();
}

function loadMap() {
    // SVG defs voor schaduw
    const svg = document.getElementById("neighborhood-svg");
    if (svg && !svg.querySelector("defs")) {
        const ns = "http://www.w3.org/2000/svg";
        const defs = document.createElementNS(ns, "defs");
        defs.innerHTML = `<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.25)"/>
        </filter>`;
        svg.insertBefore(defs, svg.firstChild);
    }

    onSnapshot(collection(db, "users"), (snapshot) => {
        const housesLayer = document.getElementById('houses-layer');
        if (!housesLayer) return;
        while (housesLayer.firstChild) housesLayer.removeChild(housesLayer.firstChild);

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const uid = docSnap.id;
            const isMe = uid === auth.currentUser.uid;
            const pos = getPlotByHuisnummer(data.huisnummer);
            if (!pos) return; // huisnummer buiten 55-70, sla over
            const isAbove = pos.cy < 300;
            const houseEl = drawHouseSVG(pos.cx, pos.cy, isMe, uid, data, isAbove);
            housesLayer.appendChild(houseEl);
        });
    });
}

// --- ZOOM & PAN ---
function initMapControls() {
    const wrapper = document.getElementById('map-scroll-wrapper');
    const svg = document.getElementById('neighborhood-svg');
    if (!wrapper || !svg) return;

    let scale = 1;
    let originX = 0, originY = 0;
    let isDragging = false;
    let startX, startY, lastX = 0, lastY = 0;
    const MIN_SCALE = 0.4, MAX_SCALE = 3;

    function applyTransform() {
        svg.style.transform = `translate(${originX}px, ${originY}px) scale(${scale})`;
        svg.style.transformOrigin = '0 0';
    }

    function clampOrigin() {
        // Optioneel: geen harde begrenzing zodat gebruiker vrij kan pannen
    }

    document.getElementById('zoom-in-btn').onclick = () => {
        scale = Math.min(MAX_SCALE, scale * 1.25);
        applyTransform();
    };
    document.getElementById('zoom-out-btn').onclick = () => {
        scale = Math.max(MIN_SCALE, scale / 1.25);
        applyTransform();
    };
    document.getElementById('zoom-reset-btn').onclick = () => {
        scale = 1; originX = 0; originY = 0;
        applyTransform();
    };

    // Scroll to zoom
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * delta));
        applyTransform();
    }, { passive: false });

    // Mouse drag to pan
    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging = true;
        startX = e.clientX - lastX;
        startY = e.clientY - lastY;
        wrapper.style.cursor = 'grabbing';
    });
    window.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        originX = e.clientX - startX;
        originY = e.clientY - startY;
        lastX = originX; lastY = originY;
        applyTransform();
    });
    window.addEventListener('mouseup', () => {
        isDragging = false;
        wrapper.style.cursor = 'grab';
    });

    // Touch pinch zoom + pan
    let lastTouchDist = null;
    let lastTouchX = null, lastTouchY = null;
    wrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            lastTouchDist = Math.hypot(dx, dy);
        } else if (e.touches.length === 1) {
            lastTouchX = e.touches[0].clientX - lastX;
            lastTouchY = e.touches[0].clientY - lastY;
        }
    }, { passive: true });
    wrapper.addEventListener('touchmove', (e) => {
        e.preventDefault();
        if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            if (lastTouchDist) {
                const ratio = dist / lastTouchDist;
                scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale * ratio));
                applyTransform();
            }
            lastTouchDist = dist;
        } else if (e.touches.length === 1 && lastTouchX !== null) {
            originX = e.touches[0].clientX - lastTouchX;
            originY = e.touches[0].clientY - lastTouchY;
            lastX = originX; lastY = originY;
            applyTransform();
        }
    }, { passive: false });
    wrapper.addEventListener('touchend', () => {
        lastTouchDist = null;
    });

    wrapper.style.cursor = 'grab';
}

// --- INTERACTIE ---
window.openBingo = () => window.location.href = 'bingo.html';
window.visitPark = () => window.location.href = 'park.html';

window.ringDoorbell = async (targetUid, targetName) => {
    alert(`Je belt aan bij ${targetName}... Ding Dong! 🔔`);
    await setDoc(doc(db, "doorbells", auth.currentUser.uid), {
        fromUid: auth.currentUser.uid,
        fromName: currentUserProfile.username,
        toUid: targetUid,
        toName: targetName,
        status: 'ringing',
        time: serverTimestamp()
    });
};

function listenForDoorbells() {
    onSnapshot(collection(db, "doorbells"), (snapshot) => {
        snapshot.forEach(d => {
            const data = d.data();
            const modal = document.getElementById('doorbell-modal');
            
            if (data.toUid === auth.currentUser.uid && data.status === 'ringing') {
                currentDoorbellId = d.id;
                document.getElementById('doorbell-msg').innerText = `🔔 ${data.fromName} staat voor de deur!`;
                modal.classList.remove('hidden');
            }
            
            if (data.fromUid === auth.currentUser.uid && data.status === 'accepted') {
                alert(`🚪 ${data.toName} heeft de deur opengedaan!`);
                updateDoc(doc(db, "doorbells", d.id), { status: 'done' });
            }
            
            if (data.fromUid === auth.currentUser.uid && data.status === 'declined') {
                alert(`❌ ${data.toName} doet helaas niet open.`);
                updateDoc(doc(db, "doorbells", d.id), { status: 'done' });
            }
        });
    });
}

document.getElementById('accept-door-btn').onclick = () => {
    if(currentDoorbellId) updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'accepted' });
    document.getElementById('doorbell-modal').classList.add('hidden');
};

document.getElementById('decline-door-btn').onclick = () => {
    if(currentDoorbellId) updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'declined' });
    document.getElementById('doorbell-modal').classList.add('hidden');
};

// --- CHAT ---
function initChat() {
    const q = query(collection(db, "chats"), orderBy("time", "asc"));
    onSnapshot(q, (snapshot) => {
        const chatBox = document.getElementById('chat-messages');
        if(!chatBox) return;
        chatBox.innerHTML = "";
        snapshot.forEach(d => {
            const data = d.data();
            const isOwn = data.userId === auth.currentUser.uid;
            chatBox.innerHTML += `
                <div class="msg ${isOwn ? 'own' : 'others'}">
                    <span class="msg-info">${data.username} • Huis ${data.huisnummer || '?'}</span>
                    ${data.text}
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

const sendChatMessage = async () => {
    const input = document.getElementById('chat-input');
    if(!input.value.trim()) return;
    await addDoc(collection(db, "chats"), {
        text: input.value,
        username: currentUserProfile.username,
        huisnummer: currentUserProfile.huisnummer,
        userId: auth.currentUser.uid,
        time: serverTimestamp()
    });
    input.value = "";
};

document.getElementById('send-chat-btn').onclick = sendChatMessage;
document.getElementById('chat-input').onkeypress = (e) => { if (e.key === 'Enter') sendChatMessage(); };

// --- UI & NAVIGATIE ---
window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`${id}-tab`).classList.remove('hidden');
    document.getElementById('page-title').innerText = id.charAt(0).toUpperCase() + id.slice(1);
    
    if (id === 'settings' && currentUserProfile) {
        document.getElementById('settings-username').value = currentUserProfile.username || "";
        document.getElementById('settings-huisnummer').value = currentUserProfile.huisnummer || "";
        document.getElementById('settings-status').value = currentUserProfile.leeftijd || "";
    }
    if (window.lucide) lucide.createIcons();
};

document.getElementById('dark-toggle').onchange = async (e) => {
    const isDark = e.target.checked;
    document.body.className = isDark ? 'dark-mode' : 'light-mode';
    if (currentUserProfile) await updateDoc(doc(db, "users", auth.currentUser.uid), { darkMode: isDark });
};

document.getElementById('save-settings-btn').onclick = async () => {
    const newProfile = {
        username: document.getElementById('settings-username').value.trim(),
        huisnummer: document.getElementById('settings-huisnummer').value.trim(),
        leeftijd: document.getElementById('settings-status').value,
        darkMode: document.getElementById('dark-toggle').checked
    };
    await updateDoc(doc(db, "users", auth.currentUser.uid), newProfile);
    currentUserProfile = { ...currentUserProfile, ...newProfile };
    document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
    alert("Instellingen opgeslagen!");
};

// --- HUIS DECORATIE ---
let draggedEmoji = "";
document.querySelectorAll('.drag-obj').forEach(obj => {
    obj.ondragstart = (e) => draggedEmoji = e.target.dataset.type;
});

const canvas = document.getElementById('house-canvas');
if(canvas) {
    canvas.ondragover = (e) => e.preventDefault();
    canvas.ondrop = (e) => {
        e.preventDefault();
        const rect = canvas.getBoundingClientRect();
        const el = document.createElement('div');
        el.className = 'placed-obj';
        el.innerText = draggedEmoji;
        el.style.left = (e.clientX - rect.left - 20) + "px";
        el.style.top = (e.clientY - rect.top - 20) + "px";
        el.onclick = () => el.remove(); 
        canvas.appendChild(el);
    };
}
