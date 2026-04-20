import { initializeApp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithPopup, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, onSnapshot, updateDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.5.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBHKSY-NN4pUX5YGP cuT0I11QaqwI",
    authDomain: "buurtpreventie.firebaseapp.com",
    projectId: "buurtpreventie",
    storageBucket: "buurtpreventie.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123def456"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const provider = new GoogleAuthProvider();

let unsubscribePlayers = null;

function switchScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.getElementById(screenId).classList.add('active');
}

function showPlayerList(snapshot) {
    const playerList = document.getElementById('player-list');
    playerList.innerHTML = '';
    
    const players = [];
    snapshot.forEach(doc => {
        const data = doc.data();
        if (data.online !== false) {
            players.push({ id: doc.id, name: data.name });
        }
    });

    players.sort((a, b) => a.name.localeCompare(b.name, 'nl'));

    players.forEach(player => {
        const div = document.createElement('div');
        div.className = 'player-item';
        div.textContent = player.name;
        playerList.appendChild(div);
    });

    const startBtn = document.getElementById('start-voting-btn');
    startBtn.style.display = players.length >= 2 ? 'block' : 'none';
}

async function createOrUpdatePlayer(user) {
    const playerRef = doc(db, 'players', user.uid);
    const playerDoc = await getDoc(playerRef);

    if (!playerDoc.exists()) {
        await setDoc(playerRef, {
            name: user.displayName || 'Anoniem',
            email: user.email,
            canSpin: true,
            online: true,
            createdAt: serverTimestamp()
        });
    } else {
        await updateDoc(playerRef, {
            online: true,
            lastSeen: serverTimestamp()
        });
    }
}

function setupOptOutListener(user) {
    const checkbox = document.getElementById('opt-out-check');
    const playerRef = doc(db, 'players', user.uid);

    checkbox.addEventListener('change', async () => {
        await updateDoc(playerRef, {
            canSpin: !checkbox.checked
        });
    });
}

function initAuth() {
    document.getElementById('login-btn').addEventListener('click', () => {
        signInWithPopup(auth, provider).catch(console.error);
    });
}

onAuthStateChanged(auth, async (user) => {
    if (unsubscribePlayers) {
        unsubscribePlayers();
        unsubscribePlayers = null;
    }

    if (user) {
        await createOrUpdatePlayer(user);

        switchScreen('bingo-lobby');

        unsubscribePlayers = onSnapshot(
            collection(db, 'players'),
            (snapshot) => {
                showPlayerList(snapshot);
                const playerData = snapshot.docs.find(d => d.id === user.uid);
                if (playerData) {
                    const checkbox = document.getElementById('opt-out-check');
                    checkbox.checked = !playerData.data().canSpin;
                }
            },
            console.error
        );

        setupOptOutListener(user);
    } else {
        switchScreen('auth-screen');
    }
});

initAuth();
