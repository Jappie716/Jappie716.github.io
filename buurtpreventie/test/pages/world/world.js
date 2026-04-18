import { auth, db } from '../../core/firebase-config.js';
import { collection, onSnapshot } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { ringDoorbell } from '../../components/doorbell-modal.js';

export function initWorld() {
    loadMap();
}

function loadMap() {
    console.log('Loading map...');
    const mapEl = document.querySelector('.world-map');
    console.log('mapEl:', mapEl);
    
    return onSnapshot(collection(db, "users"), (snapshot) => {
        if (!mapEl) return;
        mapEl.innerHTML = `
            <div class="building bingo" onclick="window.enterRoom('Bingo Club')">🎰<span>Bingo Club</span></div>
            <div class="building park" onclick="window.enterRoom('Buurtpark')">🌳<span>Buurtpark</span></div>
        `;
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
                    window.showTab('huis');
                } else {
                    ringDoorbell(uid, data.username);
                }
            };
            mapEl.appendChild(b);
        });
    });
}

window.enterRoom = (roomName) => alert(`Welkom in de ${roomName}!`);
