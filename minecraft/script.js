import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyA3Oth0nObDbK8fbDnG9nIVXrae7uimD_k",
    authDomain: "minecraft-b2a3e.firebaseapp.com",
    projectId: "minecraft-b2a3e",
    storageBucket: "minecraft-b2a3e.firebasestorage.app",
    messagingSenderId: "60597439184",
    appId: "1:60597439184:web:be05605f8b8dc4b270acd5"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

const MY_EMAIL = "someoneheilig@gmail.com";
let currentUser = null;

// --- Navigatie ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(id);
    if(target) target.classList.add('active');
};

// --- AUTH LOGICA (GECORRIGEERD) ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user; // CRUCIAAL: Nu weet de uitlogknop dat je er bent!
    
    const adminLink = document.getElementById('admin-link');
    const superAdminSectie = document.getElementById('superadmin-sectie');

    if (user) {
        document.getElementById('auth-btn').innerText = "Uitloggen";
        
        const adminDoc = await getDoc(doc(db, "roles", user.email));
        const isAdmin = user.email === MY_EMAIL || (adminDoc.exists() && adminDoc.data().isAdmin);

        if (isAdmin) {
            if(adminLink) adminLink.style.display = "inline-block";
            if(user.email === MY_EMAIL && superAdminSectie) superAdminSectie.style.display = "block";
        }
    } else {
        document.getElementById('auth-btn').innerText = "Inloggen";
        if(adminLink) adminLink.style.display = "none";
        if(superAdminSectie) superAdminSectie.style.display = "none";
        showPage('home');
    }
});

document.getElementById('auth-btn').addEventListener('click', () => {
    if (currentUser) {
        signOut(auth).then(() => {
            alert("Uitgelogd!");
        });
    } else {
        signInWithPopup(auth, provider);
    }
});

// --- DATA TOEVOEGEN ---
const setupBtn = (id, col, dataFn) => {
    const btn = document.getElementById(id);
    if(btn) btn.addEventListener('click', async () => {
        try {
            await addDoc(collection(db, col), dataFn());
            alert("Succesvol toegevoegd!");
        } catch(e) { alert("Fout: Geen rechten of database error."); }
    });
};

setupBtn('btn-add-metro', 'metro', () => ({
    lijn: document.getElementById('m-lijn').value,
    route: document.getElementById('m-route').value
}));

setupBtn('btn-add-flight', 'flights', () => ({
    airline: document.getElementById('a-airline').value,
    dest: document.getElementById('a-dest').value,
    time: document.getElementById('a-time').value
}));

setupBtn('btn-add-house', 'houses', () => ({
    title: document.getElementById('h-title').value,
    price: parseInt(document.getElementById('h-price').value)
}));

// Rechten uitdelen
const adminBtn = document.getElementById('btn-add-admin');
if(adminBtn) adminBtn.addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value;
    await setDoc(doc(db, "roles", email), { isAdmin: true });
    alert(email + " is nu admin!");
});

// --- LIVE DATA ---
onSnapshot(collection(db, "metro"), (s) => {
    const d = document.getElementById('metro-display');
    if(d) d.innerHTML = s.docs.map(doc => `<div class="card"><h3>🚇 ${doc.data().lijn}</h3><p>${doc.data().route}</p></div>`).join('');
});

onSnapshot(collection(db, "flights"), (s) => {
    const d = document.getElementById('flight-display');
    if(d) d.innerHTML = s.docs.map(doc => `<tr><td>${doc.data().airline}</td><td>${doc.data().dest}</td><td>${doc.data().time}</td></tr>`).join('');
});

onSnapshot(collection(db, "houses"), (s) => {
    const d = document.getElementById('house-display');
    if(d) d.innerHTML = s.docs.map(doc => `<div class="card"><h3>${doc.data().title}</h3><p>€ ${doc.data().price}</p></div>`).join('');
});
