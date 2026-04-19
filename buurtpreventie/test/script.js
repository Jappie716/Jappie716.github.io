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
function getHousePosition(huisnummer) {
    const num = parseInt(huisnummer) || 0;
    if (num >= 1 && num <= 10) return { left: 15 + (num * 3) + '%', top: 28 + '%' };
    if (num >= 11 && num <= 20) return { left: 45 + '%', top: 20 + ((num - 10) * 2) + '%' };
    if (num >= 21 && num <= 30) return { left: 50 + ((num - 20) * 2.5) + '%', top: 45 + '%' };
    if (num >= 31 && num <= 40) return { left: 75 - ((num - 30) * 3) + '%', top: 50 + '%' };
    return { left: 30 + (num % 15) * 3 + '%', top: 35 + '%' };
}

function loadMap() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        const housesLayer = document.getElementById('houses-layer');
        if (!housesLayer) return;
        
        document.querySelectorAll('.map-house').forEach(el => el.remove());
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const uid = docSnap.id;
            const isMe = uid === auth.currentUser.uid;
            const pos = getHousePosition(data.huisnummer);
            
            const house = document.createElement('div');
            house.className = 'map-house ' + (isMe ? 'my-house' : 'neighbor-house');
            house.style.left = pos.left;
            house.style.top = pos.top;
            house.innerHTML = '🏠';
            
            const tooltip = document.createElement('div');
            tooltip.className = 'house-tooltip';
            tooltip.style.display = 'none';
            tooltip.innerHTML = `
                <div class="tooltip-name">${data.username}</div>
                <div class="tooltip-address">🏠 Huisnummer: ${data.huisnummer || 'Onbekend'}</div>
                <div class="tooltip-status">${data.leeftijd ? data.leeftijd + ' jaar' : 'Leeftijd onbekend'}</div>
                <button class="tooltip-ring-btn" onclick="ringDoorbell('${uid}', '${data.username}')">🔔 Aanbellen</button>
            `;
            house.appendChild(tooltip);
            
            house.onmouseenter = () => tooltip.style.display = 'block';
            house.onmouseleave = () => tooltip.style.display = 'none';
            house.onclick = (e) => {
                if (e.target.classList.contains('tooltip-ring-btn')) return;
                isMe ? showTab('huis') : window.ringDoorbell(uid, data.username);
            };
            
            housesLayer.appendChild(house);
        });
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
