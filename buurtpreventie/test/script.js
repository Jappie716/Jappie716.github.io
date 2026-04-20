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
    listenForDoorbells();
    if (window.lucide) lucide.createIcons();
}

// --- KAART & POSITIE ---
// Vaste perceelposities op de SVG kaart (cx, cy = middelpunt perceel)
const PLOT_POSITIONS = [
    // Boven-links blok (x: 180-380, y: 30-285)
    { cx: 220, cy: 80 },  { cx: 300, cy: 80 },  { cx: 360, cy: 80 },
    { cx: 220, cy: 175 }, { cx: 300, cy: 175 }, { cx: 360, cy: 175 },
    // Boven-rechts blok (x: 490-680, y: 30-285)
    { cx: 530, cy: 80 },  { cx: 600, cy: 80 },  { cx: 665, cy: 80 },
    { cx: 530, cy: 175 }, { cx: 600, cy: 175 }, { cx: 665, cy: 175 },
    // Onder-links blok (x: 180-380, y: 390-645)
    { cx: 220, cy: 440 }, { cx: 300, cy: 440 }, { cx: 360, cy: 440 },
    { cx: 220, cy: 535 }, { cx: 300, cy: 535 }, { cx: 360, cy: 535 },
    // Onder-rechts blok (x: 490-680, y: 390-645) - park neemt deel in
    { cx: 530, cy: 440 }, { cx: 600, cy: 440 }, { cx: 665, cy: 440 },
    { cx: 665, cy: 535 },
];

function getPlotForUser(huisnummer, allUsers) {
    // Sorteer users op huisnummer voor consistente volgorde
    const sorted = [...allUsers].sort((a, b) => {
        const na = parseInt(a.data.huisnummer) || 999;
        const nb = parseInt(b.data.huisnummer) || 999;
        return na - nb;
    });
    const idx = sorted.findIndex(u => u.uid === huisnummer);
    return idx >= 0 && idx < PLOT_POSITIONS.length ? PLOT_POSITIONS[idx] : null;
}

// SVG huis tekenfunctie
function drawHouseSVG(cx, cy, isMe, uid, data) {
    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", isMe ? "svg-house my-house" : "svg-house neighbor-house");
    g.setAttribute("data-uid", uid);
    g.style.cursor = "pointer";

    const wallColor = isMe ? "#2563eb" : "#f59e0b";
    const roofColor = isMe ? "#1d4ed8" : "#d97706";
    const doorColor = isMe ? "#1e3a8a" : "#92400e";
    const windowColor = "#bfdbfe";

    // Perceel gras
    const plot = document.createElementNS(ns, "rect");
    plot.setAttribute("x", cx - 30); plot.setAttribute("y", cy - 8);
    plot.setAttribute("width", 60); plot.setAttribute("height", 40);
    plot.setAttribute("fill", isMe ? "#bbf7d0" : "#d1fae5");
    plot.setAttribute("rx", "3");
    g.appendChild(plot);

    // Muren
    const wall = document.createElementNS(ns, "rect");
    wall.setAttribute("x", cx - 22); wall.setAttribute("y", cy - 28);
    wall.setAttribute("width", 44); wall.setAttribute("height", 32);
    wall.setAttribute("fill", wallColor); wall.setAttribute("rx", "2");
    g.appendChild(wall);

    // Dak
    const roof = document.createElementNS(ns, "polygon");
    roof.setAttribute("points", `${cx - 26},${cy - 28} ${cx + 26},${cy - 28} ${cx},${cy - 52}`);
    roof.setAttribute("fill", roofColor);
    g.appendChild(roof);

    // Schoorsteen
    const chimney = document.createElementNS(ns, "rect");
    chimney.setAttribute("x", cx + 8); chimney.setAttribute("y", cy - 52);
    chimney.setAttribute("width", 7); chimney.setAttribute("height", 14);
    chimney.setAttribute("fill", roofColor);
    g.appendChild(chimney);

    // Linker raam
    const win1 = document.createElementNS(ns, "rect");
    win1.setAttribute("x", cx - 18); win1.setAttribute("y", cy - 24);
    win1.setAttribute("width", 12); win1.setAttribute("height", 10);
    win1.setAttribute("fill", windowColor); win1.setAttribute("rx", "1");
    g.appendChild(win1);

    // Rechter raam
    const win2 = document.createElementNS(ns, "rect");
    win2.setAttribute("x", cx + 6); win2.setAttribute("y", cy - 24);
    win2.setAttribute("width", 12); win2.setAttribute("height", 10);
    win2.setAttribute("fill", windowColor); win2.setAttribute("rx", "1");
    g.appendChild(win2);

    // Deur
    const door = document.createElementNS(ns, "rect");
    door.setAttribute("x", cx - 6); door.setAttribute("y", cy - 14);
    door.setAttribute("width", 12); door.setAttribute("height", 18);
    door.setAttribute("fill", doorColor); door.setAttribute("rx", "2");
    g.appendChild(door);

    // Deurklink
    const knob = document.createElementNS(ns, "circle");
    knob.setAttribute("cx", cx + 3); knob.setAttribute("cy", cy - 5);
    knob.setAttribute("r", "1.5");
    knob.setAttribute("fill", "#fde68a");
    g.appendChild(knob);

    // Pad naar deur
    const path = document.createElementNS(ns, "rect");
    path.setAttribute("x", cx - 4); path.setAttribute("y", cy + 4);
    path.setAttribute("width", 8); path.setAttribute("height", 12);
    path.setAttribute("fill", "#d4c89a"); path.setAttribute("rx", "1");
    g.appendChild(path);

    // Naam label
    const labelBg = document.createElementNS(ns, "rect");
    labelBg.setAttribute("x", cx - 28); labelBg.setAttribute("y", cy + 18);
    labelBg.setAttribute("width", 56); labelBg.setAttribute("height", 14);
    labelBg.setAttribute("fill", "white"); labelBg.setAttribute("rx", "3");
    labelBg.setAttribute("opacity", "0.85");
    g.appendChild(labelBg);

    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", cx); label.setAttribute("y", cy + 28);
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "8");
    label.setAttribute("font-weight", "600");
    label.setAttribute("fill", "#1f2937");
    label.setAttribute("font-family", "Segoe UI, sans-serif");
    label.textContent = (data.username || "?").substring(0, 8);
    g.appendChild(label);

    // Klik en hover
    g.addEventListener("mouseenter", () => showSVGTooltip(cx, cy, uid, data, isMe));
    g.addEventListener("mouseleave", hideSVGTooltip);
    g.addEventListener("click", (e) => {
        if (e.target.classList?.contains?.('tooltip-ring-btn')) return;
        if (isMe) showTab('huis');
    });

    return g;
}

function showSVGTooltip(cx, cy, uid, data, isMe) {
    const ns = "http://www.w3.org/2000/svg";
    const layer = document.getElementById("tooltip-layer");
    if (!layer) return;
    hideSVGTooltip();

    // Positie boven huis, pas aan als te hoog
    let tx = cx - 65;
    let ty = cy - 100;
    if (ty < 10) ty = cy + 50;
    if (tx < 5) tx = 5;
    if (tx + 130 > 895) tx = 895 - 130;

    const g = document.createElementNS(ns, "g");
    g.setAttribute("id", "svg-tooltip");

    const bg = document.createElementNS(ns, "rect");
    bg.setAttribute("x", tx); bg.setAttribute("y", ty);
    bg.setAttribute("width", 130); bg.setAttribute("height", isMe ? 58 : 72);
    bg.setAttribute("fill", "white"); bg.setAttribute("rx", "8");
    bg.setAttribute("filter", "url(#shadow)");
    g.appendChild(bg);

    const name = document.createElementNS(ns, "text");
    name.setAttribute("x", tx + 10); name.setAttribute("y", ty + 18);
    name.setAttribute("font-size", "11"); name.setAttribute("font-weight", "700");
    name.setAttribute("fill", "#1f2937"); name.setAttribute("font-family", "Segoe UI, sans-serif");
    name.textContent = data.username || "Onbekend";
    g.appendChild(name);

    const addr = document.createElementNS(ns, "text");
    addr.setAttribute("x", tx + 10); addr.setAttribute("y", ty + 34);
    addr.setAttribute("font-size", "9"); addr.setAttribute("fill", "#64748b");
    addr.setAttribute("font-family", "Segoe UI, sans-serif");
    addr.textContent = `Nr. ${data.huisnummer || "?"} · ${data.leeftijd ? data.leeftijd + " jr" : "-"}`;
    g.appendChild(addr);

    if (!isMe) {
        const btnBg = document.createElementNS(ns, "rect");
        btnBg.setAttribute("x", tx + 10); btnBg.setAttribute("y", ty + 42);
        btnBg.setAttribute("width", 110); btnBg.setAttribute("height", 20);
        btnBg.setAttribute("fill", "#2563eb"); btnBg.setAttribute("rx", "4");
        btnBg.style.cursor = "pointer";
        btnBg.addEventListener("click", () => window.ringDoorbell(uid, data.username));
        g.appendChild(btnBg);

        const btnTxt = document.createElementNS(ns, "text");
        btnTxt.setAttribute("x", tx + 65); btnTxt.setAttribute("y", ty + 55);
        btnTxt.setAttribute("text-anchor", "middle");
        btnTxt.setAttribute("font-size", "9"); btnTxt.setAttribute("fill", "white");
        btnTxt.setAttribute("font-weight", "600"); btnTxt.setAttribute("font-family", "Segoe UI, sans-serif");
        btnTxt.textContent = "Aanbellen";
        btnTxt.style.cursor = "pointer";
        btnTxt.addEventListener("click", () => window.ringDoorbell(uid, data.username));
        g.appendChild(btnTxt);
    }

    // Sluit bij klik buiten
    g.addEventListener("mouseleave", hideSVGTooltip);
    layer.appendChild(g);
}

function hideSVGTooltip() {
    const t = document.getElementById("svg-tooltip");
    if (t) t.remove();
}

function loadMap() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        const housesLayer = document.getElementById('houses-layer');
        if (!housesLayer) return;

        // Verwijder oude huizen
        while (housesLayer.firstChild) housesLayer.removeChild(housesLayer.firstChild);

        // Verzamel alle users
        const allUsers = [];
        snapshot.forEach(docSnap => {
            allUsers.push({ uid: docSnap.id, data: docSnap.data() });
        });

        // Teken elk huis op het bijbehorende perceel
        allUsers.forEach((userEntry, index) => {
            const { uid, data } = userEntry;
            const isMe = uid === auth.currentUser.uid;
            const pos = PLOT_POSITIONS[index] || PLOT_POSITIONS[PLOT_POSITIONS.length - 1];
            const houseEl = drawHouseSVG(pos.cx, pos.cy, isMe, uid, data);
            housesLayer.appendChild(houseEl);
        });

        // SVG filter voor schaduw toevoegen als nog niet aanwezig
        const svg = document.getElementById("neighborhood-svg");
        if (svg && !svg.querySelector("defs")) {
            const ns = "http://www.w3.org/2000/svg";
            const defs = document.createElementNS(ns, "defs");
            defs.innerHTML = `<filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                <feDropShadow dx="0" dy="2" stdDeviation="3" flood-color="rgba(0,0,0,0.2)"/>
            </filter>`;
            svg.insertBefore(defs, svg.firstChild);
        }
    });
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
