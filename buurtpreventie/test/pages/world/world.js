import { auth, db } from '../../core/firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ringDoorbell } from '../../components/doorbell-modal.js';
import { showTab } from '../../core/app.js';
import { state } from '../../core/app.js';

export function initWorld() {
    loadMap();
}

function loadMap() {
    return onSnapshot(collection(db, "users"), (snapshot) => {
        const mapEl = document.querySelector('.world-map');
        if (!mapEl) return;
        
        mapEl.innerHTML = `
            <div class="building bingo" onclick="enterRoom('Bingo Club')">🎰<span>Bingo Club</span></div>
            <div class="building park" onclick="enterRoom('Buurtpark')">🌳<span>Buurtpark</span></div>
        `;
        
        snapshot.forEach(docSnap => {
            const data = docSnap.data();
            const uid = docSnap.id;
            const isMe = uid === auth.currentUser?.uid;
            
            const b = document.createElement('div');
            b.className = 'building ' + (isMe ? 'my-house' : 'neighbor-house');
            b.innerHTML = `🏡<span>${isMe ? 'Mijn Huis' : data.username}</span>`;
            
            b.onclick = () => {
                if (isMe) {
                    showTab('huis');
                } else {
                    ringDoorbell(uid, data.username);
                }
            };
            mapEl.appendChild(b);
        });
    });
}

window.enterRoom = (roomName) => alert(`Welkom in de ${roomName}!`);
