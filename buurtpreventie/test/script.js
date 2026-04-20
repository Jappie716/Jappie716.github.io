import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- 1. CONFIGURATIE ---
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

// Hulpfuncties
const getEmail = () => document.getElementById('email').value;
const getPassword = () => document.getElementById('password').value;

// --- 2. AUTHENTICATIE LOGICA ---
window.onload = () => {
    // Koppel inlog- en registratieknoppen
    const loginBtn = document.getElementById('login-btn');
    if(loginBtn) {
        loginBtn.onclick = () => {
            signInWithEmailAndPassword(auth, getEmail(), getPassword())
                .catch(e => alert("Inloggen mislukt: " + e.message));
        };
    }

    const registerBtn = document.getElementById('register-btn');
    if(registerBtn) {
        registerBtn.onclick = () => {
            createUserWithEmailAndPassword(auth, getEmail(), getPassword())
                .catch(e => alert("Registratie mislukt: " + e.message));
        };
    }

    const logoutBtn = document.getElementById('logout-btn');
    if(logoutBtn) {
        logoutBtn.onclick = () => signOut(auth);
    }
    
    // Onboarding knop
    const saveProfileBtn = document.getElementById('save-profile-btn');
    if(saveProfileBtn) {
        saveProfileBtn.onclick = async () => {
            const username = document.getElementById('username').value.trim();
            const huisnummer = document.getElementById('huisnummer').value.trim();
            const leeftijd = document.getElementById('leeftijd').value;
            
            if(!username || !huisnummer) return alert("Vul een naam en huisnummer in!");

            const profiel = {
                username: username,
                huisnummer: huisnummer,
                leeftijd: leeftijd || null,
                darkMode: false
            };
            await setDoc(doc(db, "users", auth.currentUser.uid), profiel);
            location.reload(); 
        };
    }
};

// --- 3. AUTH STATUS CONTROLE ---
onAuthStateChanged(auth, async (user) => {
    const authScreen = document.getElementById('auth-screen');
    const mainApp = document.getElementById('main-app');
    const loginForm = document.getElementById('login-form');
    const onboardingForm = document.getElementById('onboarding-form');

    if (user) {
        const snap = await getDoc(doc(db, "users", user.uid));
        if (snap.exists()) {
            currentUserProfile = snap.data();
            authScreen.classList.add('hidden');
            mainApp.classList.remove('hidden');
            document.getElementById('user-display-name').innerText = `👤 ${currentUserProfile.username}`;
            
            // Start de hele app
            initAppLogica();
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

// --- 4. DE MOTOR VAN DE APP ---
function initAppLogica() {
    console.log("App logica wordt nu volledig geladen...");
    
    // Standaard tabblad tonen
    showTab('world');
    
    // Laad alle onderdelen
    loadMap();
    initChat();
    listenForDoorbells();
    
    // Dark mode herstellen
    if(currentUserProfile.darkMode) {
        document.body.className = 'dark-mode';
        document.getElementById('dark-toggle').checked = true;
    }

    if (window.lucide) lucide.createIcons();
}

// --- 5. NAVIGATIE & TABS ---
window.showTab = (id) => {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    
    const targetTab = document.getElementById(`${id}-tab`);
    if(targetTab) targetTab.classList.remove('hidden');
    
    document.getElementById('page-title').innerText = id.charAt(0).toUpperCase() + id.slice(1);
    
    // Settings invullen als we daarheen gaan
    if (id === 'settings' && currentUserProfile) {
        document.getElementById('settings-username').value = currentUserProfile.username;
        document.getElementById('settings-huisnummer').value = currentUserProfile.huisnummer;
        document.getElementById('settings-status').value = currentUserProfile.leeftijd || "";
    }
    if (window.lucide) lucide.createIcons();
};

// --- 6. KAART LOGICA ---
function getHousePosition(huisnummer) {
    const num = parseInt(huisnummer) || 0;
    // Simpele rekenmethode voor huisposities op de kaart
    return { left: (10 + (num % 10) * 8) + '%', top: (20 + Math.floor(num / 10) * 15) + '%' };
}

function loadMap() {
    onSnapshot(collection(db, "users"), (snapshot) => {
        const housesLayer = document.getElementById('houses-layer');
        if (!housesLayer) return;
        
        housesLayer.innerHTML = ""; // Schoonmaken
        
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
            
            house.onclick = () => {
                if(!isMe) ringDoorbell(uid, data.username);
                else showTab('huis');
            };
            
            housesLayer.appendChild(house);
        });
    });
}

// --- 7. CHAT LOGICA ---
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
                    <span class="msg-info">${data.username}</span>
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
        userId: auth.currentUser.uid,
        time: serverTimestamp()
    });
    input.value = "";
};

// --- 8. DEURBEL & INTERACTIE ---
window.ringDoorbell = async (targetUid, targetName) => {
    alert(`Je belt aan bij ${targetName}... 🔔`);
    await setDoc(doc(db, "doorbells", auth.currentUser.uid), {
        fromUid: auth.currentUser.uid,
        fromName: currentUserProfile.username,
        toUid: targetUid,
        status: 'ringing',
        time: serverTimestamp()
    });
};

function listenForDoorbells() {
    onSnapshot(collection(db, "doorbells"), (snapshot) => {
        snapshot.forEach(d => {
            const data = d.data();
            if (data.toUid === auth.currentUser.uid && data.status === 'ringing') {
                currentDoorbellId = d.id;
                document.getElementById('doorbell-msg').innerText = `${data.fromName} staat voor de deur!`;
                document.getElementById('doorbell-modal').classList.remove('hidden');
            }
        });
    });
}

document.getElementById('accept-door-btn').onclick = () => {
    updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'accepted' });
    document.getElementById('doorbell-modal').classList.add('hidden');
    alert("Je hebt de deur opengedaan!");
};

document.getElementById('decline-door-btn').onclick = () => {
    updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'declined' });
    document.getElementById('doorbell-modal').classList.add('hidden');
};

// --- 9. INSTELLINGEN OPSLAAN ---
document.getElementById('save-settings-btn').onclick = async () => {
    const isDark = document.getElementById('dark-toggle').checked;
    const newProfile = {
        username: document.getElementById('settings-username').value.trim(),
        huisnummer: document.getElementById('settings-huisnummer').value.trim(),
        leeftijd: document.getElementById('settings-status').value,
        darkMode: isDark
    };
    
    await updateDoc(doc(db, "users", auth.currentUser.uid), newProfile);
    currentUserProfile = { ...currentUserProfile, ...newProfile };
    document.body.className = isDark ? 'dark-mode' : 'light-mode';
    alert("Instellingen opgeslagen!");
};
