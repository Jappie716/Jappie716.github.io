import { auth, db } from '../../core/firebase-config.js';
import { collection, addDoc, query, orderBy, onSnapshot, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { state } from '../../core/app.js';

export function initChat() {
    const q = query(collection(db, "chats"), orderBy("time", "asc"));
    
    return onSnapshot(q, (snapshot) => {
        const chatBox = document.getElementById('chat-messages');
        if (!chatBox) return;
        
        chatBox.innerHTML = "";
        snapshot.forEach(d => {
            const data = d.data();
            const isOwn = data.userId === auth.currentUser?.uid;
            chatBox.innerHTML += `
                <div class="msg ${isOwn ? 'own' : 'others'}">
                    <span class="msg-info">${data.username} • ${data.straat || ''}</span>
                    ${data.text}
                </div>`;
        });
        chatBox.scrollTop = chatBox.scrollHeight;
    });
}

export function sendChatMessage() {
    const input = document.getElementById('chat-input');
    if (!input.value.trim()) return;
    
    return addDoc(collection(db, "chats"), {
        text: input.value,
        username: state.currentProfile?.username,
        straat: state.currentProfile?.straat,
        userId: auth.currentUser?.uid,
        time: serverTimestamp()
    }).then(() => {
        input.value = "";
    });
}