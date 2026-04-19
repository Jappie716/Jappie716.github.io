import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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
let currentDoorbellId = null; // Houdt bij welke deurbel momenteel afgaat

// AUTH CONTROLE
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            currentUserProfile = snap.data();
            startApp();
        } else {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('onboarding-form').classList.remove('hidden');
        }
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

const getEmail = () => document.getElementById('email').value;
const getPassword = () => document.getElementById('password').value;

document.getElementById('login-btn').onclick = () => signInWithEmailAndPassword(auth, getEmail(), getPassword()).catch(e => alert(e.message));
document.getElementById('register-btn').onclick = () => createUserWithEmailAndPassword(auth, getEmail(), getPassword()).catch(e => alert(e.message));
document.getElementById('logout-btn').onclick = () => signOut(auth);

document.getElementById('save-profile-btn').onclick = async () => {
    const profiel = {
        username: document.getElementById('username').value.trim(),
        huisnummer: document.getElementById('huisnummer').value.trim(),
        leeftijd: document.getElementById('leeftijd').value,
        geslacht: document.getElementById('geslacht').value,
        status: ""
    };
    if(!profiel.username) return alert("Kies een gebruikersnaam!");
    await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
    currentUserProfile = profiel;
    startApp();
};

function startApp() {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
    
    initChat();
    loadMap(); // Laad de buren op de kaart
    listenForDoorbells(); // Luister of iemand bij jou aanbelt
    lucide.createIcons();
}

// --- NIEUW: DYNAMISCHE KAART & BUREN ---
function loadMap() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        const map = document.querySelector('.world-map');
        // Vaste gebouwen blijven staan
        map.innerHTML = `
            <div class="building bingo" onclick="enterRoom('Bingo Club')">🎰<span>Bingo Club</span></div>
            <div class="building park" onclick="enterRoom('Buurtpark')">🌳<span>Buurtpark</span></div>
        `;
        
        // Teken een huis voor elke geregistreerde gebruiker
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const uid = docSnap.id;
            const isMe = uid === auth.currentUser.uid;
            
            const b = document.createElement('div');
            b.className = 'building ' + (isMe ? 'my-house' : 'neighbor-house');
            b.innerHTML = `🏡<span>${isMe ? 'Mijn Huis' : data.username}</span>`;
            
            b.onclick = () => {
                if(isMe) {
                    showTab('huis');
                } else {
                    ringDoorbell(uid, data.username);
                }
            };
            map.appendChild(b);
        });
    });
}

// --- NIEUW: DEURBEL LOGICA ---
window.ringDoorbell = async (targetUid, targetName) => {
    alert(`Je belt aan bij ${targetName}... Ding Dong! 🔔`);
    
    // Maak een 'deurbel' document aan in de database
    await setDoc(doc(db, "doorbells", auth.currentUser.uid), {
        fromUid: auth.currentUser.uid,
        fromName: currentUserProfile.username,
        toUid: targetUid,
        toName: targetName,
        status: 'ringing', // kan 'ringing', 'accepted', of 'declined' zijn
        time: serverTimestamp()
    });
};

function listenForDoorbells() {
    onSnapshot(collection(db, "doorbells"), (snapshot) => {
        snapshot.forEach(d => {
            const data = d.data();
            const modal = document.getElementById('doorbell-modal');
            
            // 1. Iemand belt bij MIJ aan
            if (data.toUid === auth.currentUser.uid && data.status === 'ringing') {
                currentDoorbellId = d.id;
                document.getElementById('doorbell-msg').innerText = `🔔 ${data.fromName} staat voor de deur!`;
                modal.classList.remove('hidden');
            }
            
            // 2. Iemand heeft MIJN bel geaccepteerd (Ik mag naar binnen!)
            if (data.fromUid === auth.currentUser.uid && data.status === 'accepted') {
                alert(`🚪 ${data.toName} heeft de deur opengedaan! Je bent nu binnen.`);
                // Reset de deurbel zodat de pop-up niet blijft komen
                updateDoc(doc(db, "doorbells", d.id), { status: 'done' });
                
                // HIER KAN LATER DE CODE KOMEN OM HUN WOONKAMER TE LADEN
            }
            
            // 3. Iemand heeft mijn bel genegeerd
            if (data.fromUid === auth.currentUser.uid && data.status === 'declined') {
                alert(`❌ ${data.toName} doet helaas niet open.`);
                updateDoc(doc(db, "doorbells", d.id), { status: 'done' });
            }
        });
    });
}

// Knoppen voor de ontvanger van de deurbel
document.getElementById('accept-door-btn').onclick = () => {
    if(currentDoorbellId) updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'accepted' });
    document.getElementById('doorbell-modal').classList.add('hidden');
};

document.getElementById('decline-door-btn').onclick = () => {
    if(currentDoorbellId) updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'declined' });
    document.getElementById('doorbell-modal').classList.add('hidden');
};

// --- REST VAN DE BESTAANDE CODE (Chat, Drag&Drop, Navigatie) ---
function initChat() {
    const q = query(collection(db, "chats"), orderBy("time", "asc"));
    onSnapshot(q, (snapshot) => {
        const chatBox = document.getElementById('chat-messages');
        chatBox.innerHTML = "";
        snapshot.forEach(d => {
            const data = d.data();
            const isOwn = data.userId === auth.currentUser.uid;
            chatBox.innerHTML += `
                <div class="msg ${isOwn ? 'own' : 'others'}">
                    <span class="msg-info">${data.username} • ${data.huisnummer || ''} ${data.status ? '• ' + data.status : ''}</span>
                    ${data.text}
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

document.getElementById('send-chat-btn').onclick = sendChatMessage;
document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendChatMessage();
});

async function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if(!input.value.trim()) return;
    await addDoc(collection(db, "chats"), {
        text: input.value,
        username: currentUserProfile.username,
        huisnummer: currentUserProfile.huisnummer,
        status: currentUserProfile.status || "",
        userId: auth.currentUser.uid,
        time: serverTimestamp()
    });
    input.value = "";
}

// VIRTUEEL HUIS DRAG & DROP (Blijft voor nu lokaal)
let draggedEmoji = "";
document.querySelectorAll('.drag-obj').forEach(obj => {
    obj.ondragstart = (e) => draggedEmoji = e.target.dataset.type;
});

const canvas = document.getElementById('house-canvas');
canvas.ondragover = (e) => e.preventDefault();
canvas.ondrop = (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 20;
    const y = e.clientY - rect.top - 20;
    const el = document.createElement('div');
    el.className = 'placed-obj';
    el.innerText = draggedEmoji;
    el.style.left = x + "px";
    el.style.top = y + "px";
    el.onclick = () => el.remove(); 
    canvas.appendChild(el);
};

window.showTab = async (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`${id}-tab`).classList.remove('hidden');
    document.getElementById('page-title').innerText = id.charAt(0).toUpperCase() + id.slice(1);
    lucide.createIcons();
    
    if (id === 'settings' && currentUserProfile) {
        document.getElementById('settings-username').value = currentUserProfile.username || "";
        document.getElementById('settings-huisnummer').value = currentUserProfile.huisnummer || "";
        document.getElementById('settings-status').value = currentUserProfile.status || "";
    }
};

window.enterRoom = (roomName) => alert(`Welkom in de ${roomName}!`);

document.getElementById('dark-toggle').onchange = (e) => {
    document.body.className = e.target.checked ? 'dark-mode' : 'light-mode';
};

document.getElementById('save-settings-btn').onclick = async () => {
    const newProfile = {
        username: document.getElementById('settings-username').value.trim(),
        huisnummer: document.getElementById('settings-huisnummer').value.trim(),
        status: document.getElementById('settings-status').value.trim()
    };
    if(!newProfile.username) return alert("Vul een gebruikersnaam in!");
    
    await updateDoc(doc(db, "users", auth.currentUser.uid), newProfile);
    currentUserProfile = { ...currentUserProfile, ...newProfile };
    document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
    alert("Opgeslagen!");
};
