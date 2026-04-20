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

// --- HTML TOOLTIP (werkt op touch én desktop, knop altijd klikbaar) ---
let tooltipHideTimer = null;

function showHouseTooltip(svgEl, uid, data, isMe) {
    const tooltip = document.getElementById('map-tooltip');
    const wrapper = document.getElementById('map-scroll-wrapper');
    if (!tooltip || !wrapper) return;

    clearTimeout(tooltipHideTimer);

    document.getElementById('mtt-name').textContent = data.username || 'Onbekend';
    document.getElementById('mtt-addr').textContent =
        `Wijkstraat ${data.huisnummer || '?'} · ${data.leeftijd ? data.leeftijd + ' jr' : '-'}`;

    const btn = document.getElementById('mtt-btn');
    if (isMe) {
        btn.style.display = 'none';
    } else {
        btn.style.display = 'block';
        btn.onclick = (e) => {
            e.stopPropagation();
            hideHouseTooltip(true);
            window.ringDoorbell(uid, data.username);
        };
    }

    // Positie berekenen op basis van SVG element bounding box in scherm
    const svgRect = svgEl.getBoundingClientRect();
    const wrapRect = wrapper.getBoundingClientRect();
    const tipW = 160, tipH = isMe ? 62 : 90;

    let left = svgRect.left - wrapRect.left + svgRect.width / 2 - tipW / 2;
    let top  = svgRect.top  - wrapRect.top  - tipH - 10;

    if (top < 4) top = svgRect.bottom - wrapRect.top + 8;
    if (left < 4) left = 4;
    if (left + tipW > wrapRect.width - 4) left = wrapRect.width - tipW - 4;

    tooltip.style.left = left + 'px';
    tooltip.style.top  = top  + 'px';
    tooltip.classList.remove('hidden');

    // Verberg bij muisleave op tooltip zelf
    tooltip.onmouseleave = () => hideHouseTooltip(false);
}

function hideHouseTooltip(immediate = false) {
    if (immediate) {
        document.getElementById('map-tooltip')?.classList.add('hidden');
        return;
    }
    tooltipHideTimer = setTimeout(() => {
        document.getElementById('map-tooltip')?.classList.add('hidden');
    }, 200);
}

function drawHouseSVG(cx, cy, isMe, uid, data) {
    const ns = "http://www.w3.org/2000/svg";
    const g = document.createElementNS(ns, "g");
    g.setAttribute("class", "svg-house");
    g.setAttribute("data-uid", uid);
    g.style.cursor = "pointer";

    const n = parseInt(data.huisnummer) || 0;
    const wallColors = ["#f59e0b","#ef4444","#8b5cf6","#06b6d4","#ec4899","#f97316","#84cc16","#14b8a6"];
    const roofColors = ["#d97706","#dc2626","#7c3aed","#0891b2","#db2777","#ea580c","#65a30d","#0d9488"];

    const wallColor  = isMe ? "#2563eb" : wallColors[n % wallColors.length];
    const roofColor  = isMe ? "#1d4ed8" : roofColors[n % roofColors.length];
    const doorColor  = isMe ? "#1e3a8a" : "#78350f";
    const winColor   = isMe ? "#bfdbfe" : "#fef9c3";
    const isAbove    = cy < 300;

    const mk = (tag, attrs) => {
        const el = document.createElementNS(ns, tag);
        Object.entries(attrs).forEach(([k, v]) => el.setAttribute(k, v));
        return el;
    };

    // Perceel
    g.appendChild(mk("rect", { x: cx-32, y: cy-10, width: 64, height: 44, fill: isMe ? "#bbf7d0" : "#d1fae5", rx: 4 }));
    // Pad
    g.appendChild(mk("rect", { x: cx-4, y: isAbove ? cy+4 : cy-60, width: 8, height: 18, fill: "#d4c89a", rx: 1 }));
    // Muren
    g.appendChild(mk("rect", { x: cx-24, y: cy-32, width: 48, height: 34, fill: wallColor, rx: 3 }));
    // Dak
    g.appendChild(mk("polygon", { points: `${cx-28},${cy-32} ${cx+28},${cy-32} ${cx},${cy-58}`, fill: roofColor }));
    // Schoorsteen
    g.appendChild(mk("rect", { x: cx+9, y: cy-58, width: 7, height: 16, fill: roofColor }));
    // Linker raam
    g.appendChild(mk("rect", { x: cx-20, y: cy-28, width: 13, height: 11, fill: winColor, rx: 2 }));
    g.appendChild(mk("line", { x1: cx-14, y1: cy-28, x2: cx-14, y2: cy-17, stroke: "rgba(0,0,0,0.18)", "stroke-width": 0.8 }));
    g.appendChild(mk("line", { x1: cx-20, y1: cy-22, x2: cx-7,  y2: cy-22, stroke: "rgba(0,0,0,0.18)", "stroke-width": 0.8 }));
    // Rechter raam
    g.appendChild(mk("rect", { x: cx+7,  y: cy-28, width: 13, height: 11, fill: winColor, rx: 2 }));
    g.appendChild(mk("line", { x1: cx+13, y1: cy-28, x2: cx+13, y2: cy-17, stroke: "rgba(0,0,0,0.18)", "stroke-width": 0.8 }));
    g.appendChild(mk("line", { x1: cx+7,  y1: cy-22, x2: cx+20, y2: cy-22, stroke: "rgba(0,0,0,0.18)", "stroke-width": 0.8 }));
    // Deur
    g.appendChild(mk("rect", { x: cx-7, y: cy-14, width: 14, height: 18, fill: doorColor, rx: 2 }));
    g.appendChild(mk("circle", { cx: cx+4, cy: cy-5, r: 1.8, fill: "#fde68a" }));

    // Huisnummer badge
    const badgeY = isAbove ? cy+22 : cy-70;
    g.appendChild(mk("rect", { x: cx-14, y: badgeY, width: 28, height: 13, fill: roofColor, rx: 3 }));
    const badgeTxt = mk("text", { x: cx, y: badgeY+9.5, "text-anchor": "middle", "font-size": 8, "font-weight": 700, fill: "white", "font-family": "Segoe UI, sans-serif" });
    badgeTxt.textContent = data.huisnummer || "?";
    g.appendChild(badgeTxt);

    // Naam label
    const labelY = isAbove ? cy+37 : cy-85;
    g.appendChild(mk("rect", { x: cx-30, y: labelY, width: 60, height: 13, fill: "white", rx: 3, opacity: 0.88 }));
    const labelTxt = mk("text", { x: cx, y: labelY+9.5, "text-anchor": "middle", "font-size": 8, "font-weight": 600, fill: "#1f2937", "font-family": "Segoe UI, sans-serif" });
    labelTxt.textContent = (data.username || "?").substring(0, 9);
    g.appendChild(labelTxt);

    // Hover: tooltip tonen. Geen CSS scale, geen springen.
    const showTip = () => {
        clearTimeout(tooltipHideTimer);
        showHouseTooltip(g, uid, data, isMe);
    };
    g.addEventListener("mouseenter", showTip);
    g.addEventListener("mouseleave", () => hideHouseTooltip(false));

    // Touch: tik op huis toont tooltip
    g.addEventListener("touchend", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const tooltip = document.getElementById('map-tooltip');
        const alreadyVisible = !tooltip.classList.contains('hidden') &&
            tooltip.querySelector('#mtt-name')?.textContent === data.username;
        if (alreadyVisible) {
            hideHouseTooltip(true);
        } else {
            showHouseTooltip(g, uid, data, isMe);
        }
    });

    g.addEventListener("click", (e) => {
        if (isMe) showTab('huis');
    });

    return g;
}

function loadMap() {
    // SVG defs
    const svg = document.getElementById("neighborhood-svg");
    if (svg && !svg.querySelector("defs")) {
        const ns = "http://www.w3.org/2000/svg";
        const defs = document.createElementNS(ns, "defs");
        defs.innerHTML = `<filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="rgba(0,0,0,0.22)"/>
        </filter>`;
        svg.insertBefore(defs, svg.firstChild);
    }

    onSnapshot(collection(db, "users"), (snapshot) => {
        const housesLayer = document.getElementById('houses-layer');
        if (!housesLayer) return;
        while (housesLayer.firstChild) housesLayer.removeChild(housesLayer.firstChild);

        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const uid  = docSnap.id;
            const isMe = uid === auth.currentUser.uid;
            const pos  = getPlotByHuisnummer(data.huisnummer);
            if (!pos) return;
            housesLayer.appendChild(drawHouseSVG(pos.cx, pos.cy, isMe, uid, data));
        });
    });
}

// --- ZOOM & PAN (verbeterd, geen jitter) ---
function initMapControls() {
    const wrapper = document.getElementById('map-scroll-wrapper');
    const svg     = document.getElementById('neighborhood-svg');
    if (!wrapper || !svg) return;

    let scale = 1, tx = 0, ty = 0;
    let dragging = false, dragStartX = 0, dragStartY = 0, dragOriginX = 0, dragOriginY = 0;
    let didDrag = false;
    const MIN = 0.5, MAX = 3.5;

    function apply(animated = false) {
        svg.style.transition = animated ? 'transform 0.25s ease' : 'none';
        svg.style.transform  = `translate(${tx}px,${ty}px) scale(${scale})`;
        svg.style.transformOrigin = '0 0';
    }

    function zoomAround(pivotX, pivotY, factor) {
        const newScale = Math.min(MAX, Math.max(MIN, scale * factor));
        // Bewaar het schermcoördinaat onder de cursor
        tx = pivotX - (pivotX - tx) * (newScale / scale);
        ty = pivotY - (pivotY - ty) * (newScale / scale);
        scale = newScale;
        apply();
    }

    document.getElementById('zoom-in-btn').addEventListener('click', () => {
        const r = wrapper.getBoundingClientRect();
        zoomAround(r.width / 2, r.height / 2, 1.3);
    });
    document.getElementById('zoom-out-btn').addEventListener('click', () => {
        const r = wrapper.getBoundingClientRect();
        zoomAround(r.width / 2, r.height / 2, 1 / 1.3);
    });
    document.getElementById('zoom-reset-btn').addEventListener('click', () => {
        scale = 1; tx = 0; ty = 0; apply(true);
    });

    // Muiswiel zoom op cursorpositie
    wrapper.addEventListener('wheel', (e) => {
        e.preventDefault();
        const r = wrapper.getBoundingClientRect();
        const factor = e.deltaY < 0 ? 1.12 : 1 / 1.12;
        zoomAround(e.clientX - r.left, e.clientY - r.top, factor);
    }, { passive: false });

    // Muisdrag pan
    wrapper.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        dragging = true; didDrag = false;
        dragStartX = e.clientX; dragStartY = e.clientY;
        dragOriginX = tx; dragOriginY = ty;
        wrapper.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
        if (!dragging) return;
        const dx = e.clientX - dragStartX, dy = e.clientY - dragStartY;
        if (Math.abs(dx) + Math.abs(dy) > 3) didDrag = true;
        tx = dragOriginX + dx; ty = dragOriginY + dy;
        apply();
    });
    window.addEventListener('mouseup', () => {
        dragging = false;
        wrapper.style.cursor = 'grab';
    });

    // Touch: pan met 1 vinger, pinch-zoom met 2
    let t1x = 0, t1y = 0, pinchDist0 = 0, pinchScale0 = 1, pinchTx0 = 0, pinchTy0 = 0;
    let touchMoved = false;

    wrapper.addEventListener('touchstart', (e) => {
        hideHouseTooltip(true);
        touchMoved = false;
        if (e.touches.length === 1) {
            t1x = e.touches[0].clientX - tx;
            t1y = e.touches[0].clientY - ty;
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            pinchDist0  = Math.hypot(dx, dy);
            pinchScale0 = scale;
            pinchTx0 = tx; pinchTy0 = ty;
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            const r = wrapper.getBoundingClientRect();
            t1x = midX - r.left; t1y = midY - r.top; // sla middelpunt op
        }
    }, { passive: true });

    wrapper.addEventListener('touchmove', (e) => {
        e.preventDefault();
        touchMoved = true;
        if (e.touches.length === 1) {
            tx = e.touches[0].clientX - t1x;
            ty = e.touches[0].clientY - t1y;
            apply();
        } else if (e.touches.length === 2) {
            const dx = e.touches[0].clientX - e.touches[1].clientX;
            const dy = e.touches[0].clientY - e.touches[1].clientY;
            const dist = Math.hypot(dx, dy);
            const newScale = Math.min(MAX, Math.max(MIN, pinchScale0 * dist / pinchDist0));
            const r = wrapper.getBoundingClientRect();
            const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
            const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
            tx = midX - (t1x - pinchTx0) * (newScale / pinchScale0) - (t1x * newScale / pinchScale0 - t1x);
            ty = midY - (t1y - pinchTy0) * (newScale / pinchScale0) - (t1y * newScale / pinchScale0 - t1y);
            // Simpelere aanpak: zoom vanuit middelpunt
            tx = midX - (midX - pinchTx0) * (newScale / pinchScale0);
            ty = midY - (midY - pinchTy0) * (newScale / pinchScale0);
            scale = newScale;
            apply();
        }
    }, { passive: false });

    wrapper.addEventListener('touchend', (e) => {
        if (!touchMoved && e.changedTouches.length === 1) {
            // Tik zonder beweging → tooltip al afgehandeld via touchend op huis
        }
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
