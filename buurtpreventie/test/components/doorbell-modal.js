import { auth, db } from '../core/firebase-config.js';
import { updateDoc, doc, collection, onSnapshot, serverTimestamp, setDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from '../core/app.js';

export let currentDoorbellId = null;

export function renderDoorbellModal() {
    return `
        <div id="doorbell-modal" class="hidden auth-box pulse" style="position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 9999; border: 4px solid var(--primary);">
            <div class="logo-icon">🔔</div>
            <h2 id="doorbell-msg">Iemand staat voor de deur!</h2>
            <div class="row">
                <button id="accept-door-btn" class="primary-btn">Opendoen</button>
                <button id="decline-door-btn" class="secondary-btn">Negeren</button>
            </div>
        </div>
    `;
}

export function initDoorbellModal() {
    const acceptBtn = document.getElementById('accept-door-btn');
    const declineBtn = document.getElementById('decline-door-btn');
    
    if (acceptBtn) {
        acceptBtn.onclick = async () => {
            if (currentDoorbellId) {
                await updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'accepted' });
                document.getElementById('doorbell-modal').classList.add('hidden');
            }
        };
    }
    
    if (declineBtn) {
        declineBtn.onclick = async () => {
            if (currentDoorbellId) {
                await updateDoc(doc(db, "doorbells", currentDoorbellId), { status: 'declined' });
                document.getElementById('doorbell-modal').classList.add('hidden');
            }
        };
    }
}

export async function ringDoorbell(targetUid, targetName) {
    alert(`Je belt aan bij ${targetName}... Ding Dong! 🔔`);
    
    await setDoc(doc(db, "doorbells", auth.currentUser.uid), {
        fromUid: auth.currentUser.uid,
        fromName: state.currentProfile?.username || 'Onbekend',
        toUid: targetUid,
        toName: targetName,
        status: 'ringing',
        time: serverTimestamp()
    });
}

export function listenForDoorbells() {
    return onSnapshot(collection(db, "doorbells"), (snapshot) => {
        snapshot.forEach(d => {
            const data = d.data();
            const modal = document.getElementById('doorbell-modal');
            
            if (data.toUid === auth.currentUser.uid && data.status === 'ringing') {
                currentDoorbellId = d.id;
                document.getElementById('doorbell-msg').innerText = `🔔 ${data.fromName} staat voor de deur!`;
                modal.classList.remove('hidden');
            }
            
            if (data.fromUid === auth.currentUser.uid && data.status === 'accepted') {
                alert(`🚪 ${data.toName} heeft de deur opengedaan! Je bent nu binnen.`);
                updateDoc(doc(db, "doorbells", d.id), { status: 'done' });
            }
            
            if (data.fromUid === auth.currentUser.uid && data.status === 'declined') {
                alert(`❌ ${data.toName} doet helaas niet open.`);
                updateDoc(doc(db, "doorbells", d.id), { status: 'done' });
            }
        });
    });
}

window.ringDoorbell = ringDoorbell;
