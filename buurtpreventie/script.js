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

// AUTH & ONBOARDING
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            startApp(snap.data());
        } else {
            document.getElementById('login-form').classList.add('hidden');
            document.getElementById('onboarding-form').classList.remove('hidden');
        }
    } else {
        document.getElementById('auth-screen').classList.remove('hidden');
        document.getElementById('main-app').classList.add('hidden');
    }
});

document.getElementById('login-btn').onclick = () => signInWithEmailAndPassword(auth, email.value, password.value);
document.getElementById('register-btn').onclick = () => createUserWithEmailAndPassword(auth, email.value, password.value);
document.getElementById('logout-btn').onclick = () => signOut(auth);

document.getElementById('save-profile-btn').onclick = async () => {
    const profiel = { 
        username: username.value, 
        straat: straat.value, 
        leeftijd: leeftijd.value, 
        geslacht: geslacht.value 
    };
    await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
    startApp(profiel);
};

function startApp(data) {
    document.getElementById('auth-screen').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    document.getElementById('user-badge').innerText = `👤 ${data.username}`;
    loadFeed();
}

// MULTIPLAYER ROOMS
window.enterRoom = (name) => {
    showTab('room');
    document.getElementById('room-name').innerText = name;
    updatePresence(name);
};

async function updatePresence(room) {
    await setDoc(doc(db, "presence", auth.currentUser.uid), {
        name: auth.currentUser.email.split('@')[0],
        room: room,
        x: Math.random() * 80,
        y: Math.random() * 80
    });
    
    onSnapshot(query(collection(db, "presence")), (snap) => {
        const canvas = document.getElementById('game-canvas');
        canvas.innerHTML = "";
        snap.forEach(d => {
            if(d.data().room === room) {
                const p = document.createElement('div');
                p.className = 'player-token';
                p.innerHTML = `👤<span>${d.data().name}</span>`;
                p.style.left = d.data().x + "%";
                p.style.top = d.data().y + "%";
                canvas.appendChild(p);
            }
        });
    });
}

// DRAG & DROP HOUSE
let heldEmoji = "";
document.querySelectorAll('.drag-obj').forEach(obj => {
    obj.ondragstart = (e) => heldEmoji = e.target.dataset.type;
});

const house = document.getElementById('house-canvas');
house.ondragover = (e) => e.preventDefault();
house.ondrop = (e) => {
    const rect = house.getBoundingClientRect();
    const item = document.createElement('div');
    item.className = 'placed-obj';
    item.innerHTML = heldEmoji;
    item.style.left = (e.clientX - rect.left) + "px";
    item.style.top = (e.clientY - rect.top) + "px";
    house.appendChild(item);
};

// TABS & THEME
window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.getElementById(`${id}-tab`).classList.remove('hidden');
    document.getElementById('page-title').innerText = id.charAt(0).toUpperCase() + id.slice(1);
    lucide.createIcons();
};

document.getElementById('dark-toggle').onchange = (e) => {
    document.body.className = e.target.checked ? 'dark-mode' : 'light-mode';
};

// FEED LOGICA
function loadFeed() {
    onSnapshot(query(collection(db, "posts"), orderBy("time", "desc")), (snap) => {
        const list = document.getElementById('feed-list');
        list.innerHTML = "";
        snap.forEach(d => {
            list.innerHTML += `<div class="card"><strong>${d.data().user}</strong><p>${d.data().text}</p></div>`;
        });
    });
}

document.getElementById('post-btn').onclick = async () => {
    await addDoc(collection(db, "posts"), {
        text: document.getElementById('post-input').value,
        user: auth.currentUser.email,
        time: serverTimestamp()
    });
    document.getElementById('post-input').value = "";
};

lucide.createIcons();
