import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, doc, setDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Firebase Configuratie
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

const SUPER_ADMIN_EMAIL = "someoneheilig@gmail.com";
let currentUser = null;

// --- Dark Mode Systeem ---
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

// --- Navigatie Systeem ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelector('.nav-links').classList.remove('show');
};
window.toggleMenu = () => document.querySelector('.nav-links').classList.toggle('show');

// --- Auth & Rechten Systeem ---
const authBtn = document.getElementById('auth-btn');

authBtn.addEventListener('click', () => {
    if (currentUser) signOut(auth);
    else signInWithPopup(auth, provider);
});

onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    const adminLink = document.getElementById('admin-link');
    const superAdminLink = document.getElementById('superadmin-link');

    if (user) {
        authBtn.innerText = "Uitloggen";
        
        // 1. Is het de SuperAdmin?
        if (user.email === SUPER_ADMIN_EMAIL) {
            superAdminLink.style.display = "inline-block";
            adminLink.style.display = "inline-block"; // Superadmin mag ook bij de makelaar pagina
        } else {
            superAdminLink.style.display = "none";
            
            // 2. Check in Firestore of deze persoon 'Makelaar' is
            const roleDoc = await getDoc(doc(db, "roles", user.email));
            if (roleDoc.exists() && roleDoc.data().isMakelaar) {
                adminLink.style.display = "inline-block";
            } else {
                adminLink.style.display = "none";
            }
        }
    } else {
        authBtn.innerText = "Inloggen met Google";
        adminLink.style.display = "none";
        superAdminLink.style.display = "none";
        showPage('home');
    }
});

// --- SUPER ADMIN LOGICA ---
document.getElementById('add-makelaar-btn').addEventListener('click', async () => {
    const email = document.getElementById('new-makelaar-email').value.trim();
    if (!email) return alert("Vul een geldig Google e-mailadres in.");

    try {
        // Maak een document aan met het e-mailadres als ID
        await setDoc(doc(db, "roles", email), {
            isMakelaar: true,
            toegevoegdDoor: SUPER_ADMIN_EMAIL
        });
        alert(`${email} is nu succesvol geregistreerd als Makelaar!`);
        document.getElementById('new-makelaar-email').value = "";
    } catch (e) {
        alert("Fout bij toevoegen. Check je Firebase Rules! " + e.message);
    }
});

// --- MAKELAAR LOGICA (Huizen toevoegen) ---
document.getElementById('add-house-btn').addEventListener('click', async () => {
    const title = document.getElementById('h-title').value;
    const price = document.getElementById('h-price').value;
    const img = document.getElementById('h-img').value;

    if (!title || !price) return alert("Vul minstens een titel en prijs in!");

    try {
        await addDoc(collection(db, "houses"), {
            title, 
            price: parseInt(price), 
            img: img || "https://via.placeholder.com/400x200?text=Geen+Afbeelding",
            createdAt: new Date()
        });
        alert("Huis succesvol toegevoegd aan de website!");
        document.getElementById('h-title').value = "";
        document.getElementById('h-price').value = "";
        document.getElementById('h-img').value = "";
    } catch (e) {
        alert("Fout bij toevoegen: " + e.message);
    }
});

// --- LIVE HUIZEN INLADEN ---
onSnapshot(collection(db, "houses"), (snapshot) => {
    const houseDisplay = document.getElementById('house-display');
    houseDisplay.innerHTML = "";
    
    if(snapshot.empty) {
        houseDisplay.innerHTML = "<p>Er staan momenteel geen huizen te koop.</p>";
        return;
    }

    snapshot.forEach((doc) => {
        const data = doc.data();
        houseDisplay.innerHTML += `
            <div class="card">
                <img src="${data.img}" alt="Huis in Mestlo">
                <h3>${data.title}</h3>
                <h3 style="color: var(--primary); margin-top: 10px;">€ ${data.price.toLocaleString()}</h3>
            </div>
        `;
    });
});