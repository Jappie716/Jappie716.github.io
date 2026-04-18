import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// LOGIN / REGISTER
document.getElementById('login-btn').onclick = () => signInWithEmailAndPassword(auth, email.value, password.value).catch(e => alert(e.message));
document.getElementById('register-btn').onclick = () => createUserWithEmailAndPassword(auth, email.value, password.value).catch(e => alert(e.message));
document.getElementById('logout-btn').onclick = () => signOut(auth);

// PROFIEL OPSLAAN
document.getElementById('save-profile-btn').onclick = async () => {
    const profiel = {
        username: document.getElementById('username').value,
        straat: document.getElementById('straat').value,
        leeftijd: document.getElementById('leeftijd').value,
        geslacht: document.getElementById('geslacht').value
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
    lucide.createIcons();
}

// LIVE CHAT LOGICA
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
                    <span class="msg-info">${data.username} • ${data.straat || ''}</span>
                    ${data.text}
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

document.getElementById('send-chat-btn').onclick = async () => {
    const input = document.getElementById('chat-input');
    if(!input.value.trim()) return;
    await addDoc(collection(db, "chats"), {
        text: input.value,
        username: currentUserProfile.username,
        straat: currentUserProfile.straat,
        userId: auth.currentUser.uid,
        time: serverTimestamp()
    });
    input.value = "";
};

// VIRTUEEL HUIS DRAG & DROP
let draggedEmoji = "";
document.querySelectorAll('.drag-obj').forEach(obj => {
    obj.ondragstart = (e) => draggedEmoji = e.target.dataset.type;
});

const canvas = document.getElementById('house-canvas');
canvas.ondragover = (e) => e.preventDefault();
canvas.ondrop = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 20;
    const y = e.clientY - rect.top - 20;
    const el = document.createElement('div');
    el.className = 'placed-obj';
    el.innerHTML = draggedEmoji;
    el.style.left = x + "px";
    el.style.top = y + "px";
    canvas.appendChild(el);
};

// NAVIGATIE
window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`${id}-tab`).classList.remove('hidden');
    document.getElementById('page-title').innerText = id.charAt(0).toUpperCase() + id.slice(1);
    lucide.createIcons();
};

document.getElementById('dark-toggle').onchange = (e) => {
    document.body.className = e.target.checked ? 'dark-mode' : 'light-mode';
};

lucide.createIcons();
