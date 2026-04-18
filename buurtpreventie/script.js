import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

// UI elementen
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');

// 1. Authenticatie logica
document.getElementById('login-btn').onclick = () => {
    signInWithEmailAndPassword(auth, email.value, password.value).catch(err => alert(err.message));
};

document.getElementById('register-btn').onclick = () => {
    createUserWithEmailAndPassword(auth, email.value, password.value).catch(err => alert(err.message));
};

document.getElementById('logout-btn').onclick = () => signOut(auth);

onAuthStateChanged(auth, (user) => {
    if (user) {
        authScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loadAlerts();
    } else {
        authScreen.classList.remove('hidden');
        mainApp.classList.add('hidden');
    }
});

// 2. Realtime Feed logica
document.getElementById('send-alert').onclick = async () => {
    const text = document.getElementById('alert-input').value;
    if(!text) return;
    await addDoc(collection(db, "alerts"), {
        text: text,
        user: auth.currentUser.email,
        time: serverTimestamp()
    });
    document.getElementById('alert-input').value = "";
};

function loadAlerts() {
    const q = query(collection(db, "alerts"), orderBy("time", "desc"));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('alerts-list');
        list.innerHTML = "";
        snapshot.forEach(doc => {
            const data = doc.data();
            list.innerHTML += `<div class="card"><strong>${data.user}</strong><p>${data.text}</p></div>`;
        });
    });
}

// 3. Virtueel Huis (Simpele Drag & Drop)
let draggedItem = null;

document.querySelectorAll('.item').forEach(item => {
    item.ondragstart = (e) => draggedItem = e.target.getAttribute('data-type');
});

const grid = document.getElementById('house-grid');
grid.ondragover = (e) => e.preventDefault();
grid.ondrop = (e) => {
    const newItem = document.createElement('div');
    newItem.className = 'placed-item';
    newItem.innerHTML = draggedItem;
    newItem.style.left = e.offsetX + 'px';
    newItem.style.top = e.offsetY + 'px';
    grid.appendChild(newItem);
};

// 4. Tab navigatie
window.showTab = (tabName) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(`${tabName}-section`).classList.remove('hidden');
    document.getElementById('page-title').innerText = tabName.charAt(0).toUpperCase() + tabName.slice(1);
};

// Dark mode toggle
document.getElementById('theme-toggle').onclick = () => {
    document.body.classList.toggle('dark-mode');
};
