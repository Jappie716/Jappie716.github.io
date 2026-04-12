import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- FIREBASE CONFIGURATIE ---
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

const SUPER_ADMIN = "someoneheilig@gmail.com";
let currentUser = null;

// --- PAGINA NAVIGATIE & DARK MODE ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelector('.nav-links').classList.remove('show');
};
window.toggleMenu = () => document.querySelector('.nav-links').classList.toggle('show');

const themeToggleBtn = document.getElementById('theme-toggle');
if(localStorage.getItem('theme') === 'dark') {
    document.body.setAttribute('data-theme', 'dark');
    themeToggleBtn.innerText = '☀️';
}
themeToggleBtn.addEventListener('click', () => {
    if(document.body.getAttribute('data-theme') === 'dark') {
        document.body.removeAttribute('data-theme');
        localStorage.setItem('theme', 'light');
        themeToggleBtn.innerText = '🌙';
    } else {
        document.body.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
        themeToggleBtn.innerText = '☀️';
    }
});

// --- INLOGGEN & RECHTEN ---
const authBtn = document.getElementById('auth-btn');
authBtn.addEventListener('click', () => {
    if (currentUser) signOut(auth);
    else signInWithPopup(auth, provider);
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const adminLink = document.getElementById('admin-link');
    const superAdminSectie = document.getElementById('superadmin-sectie');

    if (user) {
        authBtn.innerText = "Uitloggen";
        
        // Ben jij de opperbaas?
        if (user.email === SUPER_ADMIN) {
            adminLink.style.display = "inline-block";
            superAdminSectie.style.display = "block";
        } else {
            // Zo niet, kijk in de database of je admin rechten hebt gekregen
            try {
                const roleDoc = await getDoc(doc(db, "roles", user.email));
                if (roleDoc.exists() && roleDoc.data().isAdmin) {
                    adminLink.style.display = "inline-block";
                } else {
                    adminLink.style.display = "none";
                }
            } catch (e) {
                adminLink.style.display = "none";
            }
        }
    } else {
        authBtn.innerText = "Inloggen met Google";
        adminLink.style.display = "none";
        superAdminSectie.style.display = "none";
        showPage('home');
    }
});

// --- DATA TOEVOEGEN (Vanuit Beheerpaneel) ---

// 1. Rechten uitdelen (Alleen voor jou)
document.getElementById('btn-add-admin').addEventListener('click', async () => {
    const email = document.getElementById('new-admin-email').value.trim();
    if (!email) return alert("Vul een e-mail in.");
    try {
        await setDoc(doc(db, "roles", email), { isAdmin: true });
        alert(`${email} is nu een beheerder!`);
        document.getElementById('new-admin-email').value = "";
    } catch (e) { alert("Fout: " + e.message); }
});

// 2. Metro toevoegen
document.getElementById('btn-add-metro').addEventListener('click', async () => {
    const lijn = document.getElementById('m-lijn').value;
    const route = document.getElementById('m-route').value;
    if(!lijn || !route) return alert("Vul alles in!");
    try {
        await addDoc(collection(db, "metro"), { lijn, route, createdAt: new Date() });
        alert("Metro lijn toegevoegd!");
        document.getElementById('m-lijn').value = ""; document.getElementById('m-route').value = "";
    } catch(e) { alert("Fout: " + e.message); }
});

// 3. Vlucht toevoegen
document.getElementById('btn-add-flight').addEventListener('click', async () => {
    const airline = document.getElementById('a-airline').value;
    const dest = document.getElementById('a-dest').value;
    const time = document.getElementById('a-time').value;
    if(!airline || !dest || !time) return alert("Vul alles in!");
    try {
        await addDoc(collection(db, "flights"), { airline, dest, time, createdAt: new Date() });
        alert("Vlucht toegevoegd!");
        document.getElementById('a-airline').value = ""; document.getElementById('a-dest').value = ""; document.getElementById('a-time').value = "";
    } catch(e) { alert("Fout: " + e.message); }
});

// 4. Huis toevoegen
document.getElementById('btn-add-house').addEventListener('click', async () => {
    const title = document.getElementById('h-title').value;
    const price = document.getElementById('h-price').value;
    const img = document.getElementById('h-img').value;
    if(!title || !price) return alert("Vul Titel en Prijs in!");
    try {
        await addDoc(collection(db, "houses"), { 
            title, price: parseInt(price), 
            img: img || "https://via.placeholder.com/400x200?text=Mestlo+Huis", 
            createdAt: new Date() 
        });
        alert("Huis online gezet!");
        document.getElementById('h-title').value = ""; document.getElementById('h-price').value = ""; document.getElementById('h-img').value = "";
    } catch(e) { alert("Fout: " + e.message); }
});

// --- LIVE DATA INLADEN (Voor alle bezoekers) ---

// Metro Inladen
onSnapshot(collection(db, "metro"), (snapshot) => {
    const display = document.getElementById('metro-display');
    display.innerHTML = snapshot.empty ? "<p>Geen metro lijnen actief.</p>" : "";
    snapshot.forEach(doc => {
        const d = doc.data();
        display.innerHTML += `<div class="card"><h3>🚇 ${d.lijn}</h3><p>${d.route}</p></div>`;
    });
});

// Vluchten Inladen
onSnapshot(collection(db, "flights"), (snapshot) => {
    const display = document.getElementById('flight-display');
    display.innerHTML = snapshot.empty ? "<tr><td colspan='3'>Geen vluchten gepland.</td></tr>" : "";
    snapshot.forEach(doc => {
        const d = doc.data();
        display.innerHTML += `<tr><td>${d.airline}</td><td>${d.dest}</td><td>${d.time}</td></tr>`;
    });
});

// Huizen Inladen
onSnapshot(collection(db, "houses"), (snapshot) => {
    const display = document.getElementById('house-display');
    display.innerHTML = snapshot.empty ? "<p>Geen huizen te koop momenteel.</p>" : "";
    snapshot.forEach(doc => {
        const d = doc.data();
        display.innerHTML += `
            <div class="card">
                <img src="${d.img}">
                <h3>${d.title}</h3>
                <h3 style="color: var(--primary); margin-top: 10px;">€ ${d.price.toLocaleString()}</h3>
            </div>
        `;
    });
});
