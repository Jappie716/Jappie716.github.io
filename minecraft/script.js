import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, collection, addDoc, onSnapshot, query, where, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

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

let user = null;

// --- Pagina Navigatie ---
window.showPage = (id) => {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'map') checkMapStatus();
};

// --- Kaart Status Check ---
async function checkMapStatus() {
    const frame = document.getElementById('map-frame');
    const errorOverlay = document.getElementById('map-error');
    
    // Omdat we de titel niet kunnen lezen van een ander domein, 
    // gebruiken we een 'ping' techniek of een timeout.
    try {
        const response = await fetch(frame.src, { mode: 'no-cors' });
        errorOverlay.style.display = "none"; 
    } catch (e) {
        errorOverlay.style.display = "flex";
    }
}

// --- Authenticatie ---
window.handleAuthAction = () => {
    if (user) {
        signOut(auth);
    } else {
        signInWithPopup(auth, provider);
    }
};

onAuthStateChanged(auth, (u) => {
    user = u;
    const authBtn = document.getElementById('auth-btn');
    const adminLink = document.getElementById('admin-link');
    const userInfo = document.getElementById('user-info');

    if (user) {
        authBtn.innerText = "Uitloggen";
        userInfo.innerText = `Ingelogd als ${user.displayName}`;
        
        // Simuleer rechten: Iedereen die inlogt krijgt hier 'makelaar' rechten
        // In een echte app zou je dit in Firestore checken: db.collection('users').doc(user.uid)
        adminLink.style.display = "inline-block";
        loadMyHouses();
    } else {
        authBtn.innerText = "Inloggen met Google";
        userInfo.innerText = "";
        adminLink.style.display = "none";
        showPage('home');
    }
});

// --- Makelaar Logica (Firestore) ---
window.addNewHouse = async () => {
    const title = document.getElementById('h-title').value;
    const price = document.getElementById('h-price').value;
    const desc = document.getElementById('h-desc').value;
    const img = document.getElementById('h-img').value;

    if(!title || !price) return alert("Vul minstens een titel en prijs in!");

    try {
        await addDoc(collection(db, "houses"), {
            title,
            price: parseInt(price),
            description: desc,
            image: img || "https://via.placeholder.com/300",
            ownerId: user.uid,
            ownerName: user.displayName,
            createdAt: new Date()
        });
        alert("Huis staat te koop!");
        // Reset velden
        document.getElementById('h-title').value = "";
        document.getElementById('h-price').value = "";
    } catch (e) {
        console.error("Error adding house: ", e);
    }
};

// Luister naar alle huizen voor de makelaar pagina
onSnapshot(collection(db, "houses"), (snapshot) => {
    const list = document.getElementById('house-list');
    list.innerHTML = "";
    snapshot.forEach((doc) => {
        const h = doc.data();
        list.innerHTML += `
            <div class="card">
                <img src="${h.image}" style="width:100%; border-radius:8px;">
                <h3>${h.title}</h3>
                <p>${h.description}</p>
                <h2 style="color:var(--primary)">€ ${h.price.toLocaleString()}</h2>
                <small>Verkoper: ${h.ownerName}</small>
            </div>
        `;
    });
});

// Laad alleen jouw huizen in het beheerpaneel
function loadMyHouses() {
    if(!user) return;
    const q = query(collection(db, "houses"), where("ownerId", "==", user.uid));
    onSnapshot(q, (snapshot) => {
        const list = document.getElementById('my-houses');
        list.innerHTML = "";
        snapshot.forEach((d) => {
            const h = d.data();
            list.innerHTML += `
                <div style="border-bottom:1px solid var(--border); padding:10px; display:flex; justify-content:space-between;">
                    <span>${h.title} - €${h.price}</span>
                    <button onclick="deleteHouse('${d.id}')" style="color:red; background:none; border:none; cursor:pointer;">Verwijderen</button>
                </div>
            `;
        });
    });
}

window.deleteHouse = async (id) => {
    if(confirm("Zeker weten?")) {
        await deleteDoc(doc(db, "houses", id));
    }
};
