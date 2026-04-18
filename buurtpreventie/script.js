import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// JOUW CONFIG
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

// AUTH LOGICA
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');

loginBtn.onclick = () => {
    signInWithEmailAndPassword(auth, email.value, password.value).catch(e => alert("Fout: " + e.message));
};

registerBtn.onclick = () => {
    createUserWithEmailAndPassword(auth, email.value, password.value).then(() => alert("Account aangemaakt!")).catch(e => alert(e.message));
};

document.getElementById('logout-btn').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        document.getElementById('user-display-email').innerText = user.email;
        initFeed();
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

// TAB NAVIGATIE
window.showTab = (tabId) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    
    document.getElementById(`${tabId}-tab`).classList.remove('hidden');
    event.currentTarget.classList.add('active');
    
    const titles = { feed: "Buurt Feed", huis: "Mijn Huis", settings: "Instellingen" };
    document.getElementById('page-title').innerText = titles[tabId];
};

// FEED LOGICA
function initFeed() {
    const q = query(collection(db, "alerts"), orderBy("time", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('alerts-list');
        list.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `
                <div class="card pulse">
                    <strong>📍 ${data.user.split('@')[0]}</strong>
                    <p>${data.text}</p>
                </div>`;
        });
    });
}

document.getElementById('send-alert').onclick = async () => {
    const input = document.getElementById('alert-input');
    if(!input.value) return;
    await addDoc(collection(db, "alerts"), {
        text: input.value,
        user: auth.currentUser.email,
        time: serverTimestamp()
    });
    input.value = "";
};

// VIRTUEEL HUIS (Drag & Drop)
let currentEmoji = "";
document.querySelectorAll('.drag-item').forEach(item => {
    item.ondragstart = (e) => currentEmoji = e.target.dataset.emoji;
});

const canvas = document.getElementById('house-canvas');
canvas.ondragover = (e) => e.preventDefault();
canvas.ondrop = (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left - 15;
    const y = e.clientY - rect.top - 15;
    
    const el = document.createElement('div');
    el.className = 'placed-item';
    el.innerHTML = currentEmoji;
    el.style.left = x + "px";
    el.style.top = y + "px";
    canvas.appendChild(el);
};

// SETTINGS (Dark Mode)
document.getElementById('dark-mode-toggle').onchange = (e) => {
    document.body.className = e.target.checked ? 'dark-mode' : 'light-mode';
};

// Icons inladen
lucide.createIcons();
