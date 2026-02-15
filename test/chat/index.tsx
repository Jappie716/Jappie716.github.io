
import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';

// --- Types ---
interface UserData {
  uid: string;
  name: string;
  pic?: string;
  email: string;
  status?: 'online' | 'offline';
  lastSeen?: any;
}

interface ChatItem {
  id: string;
  name: string;
  pic?: string;
  type: 'global' | 'group' | 'private';
  online?: boolean;
}

interface Message {
  id: string;
  text?: string;
  user: string;
  uid: string;
  timestamp: any;
}

// Global Firebase declaration
declare const firebase: any;

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'discover' | 'requests'>('chats');
  const [chats, setChats] = useState<Map<string, ChatItem>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  // Helper for safe Firebase initialization check
  const isFirebaseReady = () => typeof firebase !== 'undefined' && firebase.apps.length > 0;

  useEffect(() => {
    if (typeof firebase === 'undefined') return;
    
    // Attempt to listen for auth if firebase is present
    try {
      const unsub = firebase.auth().onAuthStateChanged((u: any) => {
        setUser(u);
        if (u) initUserData(u);
      });
      return () => unsub();
    } catch (e) {
      console.warn("Firebase Auth not initialized or ready:", e);
    }
  }, []);

  const initUserData = (u: any) => {
    if (!isFirebaseReady()) return;
    const db = firebase.firestore();
    const userRef = db.collection("users").doc(u.uid);
    
    userRef.onSnapshot((doc: any) => {
      if (doc.exists) {
        setCurrentUserData({ uid: u.uid, ...doc.data() });
      }
    });
  };

  const handleStatusChange = async (newStatus: 'online' | 'offline') => {
    if (!user || !isFirebaseReady()) return;
    const db = firebase.firestore();
    await db.collection("users").doc(user.uid).update({ 
      status: newStatus,
      lastSeen: newStatus === 'online' ? firebase.firestore.FieldValue.serverTimestamp() : null
    });
  };

  useEffect(() => {
    if (!user || !isFirebaseReady()) return;
    const db = firebase.firestore();
    
    const friendsUnsub = db.collection("users").doc(user.uid).collection("friends").onSnapshot((snap: any) => {
      snap.forEach((doc: any) => {
        const data = doc.data();
        setChats(prev => new Map(prev).set(doc.id, { id: doc.id, name: data.name, pic: data.pic, type: 'private' }));
      });
    });

    setChats(prev => new Map(prev).set('global', { id: 'global', name: 'Algemeen', pic: 'https://i.imgur.com/C9HtyPv.jpeg', type: 'global' }));

    return () => friendsUnsub();
  }, [user]);

  useEffect(() => {
    if (!activeChat || !user || !isFirebaseReady()) return;
    const db = firebase.firestore();
    let ref = activeChat.type === 'global' ? db.collection("chats") : db.collection("private_chats").doc([user.uid, activeChat.id].sort().join("_")).collection("messages");

    const unsub = ref.orderBy("timestamp", "desc").limit(50).onSnapshot((snap: any) => {
      const msgs: Message[] = [];
      snap.forEach((doc: any) => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs.reverse());
    });
    return () => unsub();
  }, [activeChat, user]);

  return (
    <div className="flex h-screen w-full overflow-hidden text-white bg-[#020617]">
      {/* Sidebar */}
      <div className="w-80 bg-[#010409] border-r border-[#1e293b] flex flex-col">
        <div className="p-4 bg-[#0f172a] flex items-center gap-3 border-b border-[#1e293b]">
          <img 
            src={currentUserData?.pic || `https://ui-avatars.com/api/?name=${currentUserData?.name || 'User'}`} 
            className="w-10 h-10 rounded-full border-2 border-[#2563eb] object-cover"
            alt="Profile"
          />
          <div className="flex-1 flex flex-col">
            <b className="text-sm truncate">{currentUserData?.name || 'Gebruiker'}</b>
            
            {/* Status Switcher requested by user */}
            <select 
              value={currentUserData?.status || 'online'}
              onChange={(e) => handleStatusChange(e.target.value as 'online' | 'offline')}
              className="bg-transparent text-[#94a3b8] border-none text-[10px] outline-none cursor-pointer p-0 w-fit font-bold"
            >
              <option value="online" className="bg-[#0f172a] text-green-500">🟢 Online</option>
              <option value="offline" className="bg-[#0f172a] text-gray-500">⚪ Offline</option>
            </select>
          </div>
          <button className="bg-[#2563eb] text-white px-2 py-1 rounded text-xs font-bold hover:bg-blue-600">+ Groep</button>
        </div>

        <div className="p-3 bg-[#010409] border-b border-[#1e293b]">
          <input 
            type="text" 
            placeholder="🔍 Zoeken..." 
            className="w-full bg-[#0f172a] border border-[#1e293b] p-2 rounded text-sm outline-none text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="flex bg-[#010409] border-b border-[#1e293b]">
          {['chats', 'discover', 'requests'].map((tab) => (
            <div 
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`flex-1 p-3 text-center cursor-pointer text-xs uppercase font-bold transition ${activeTab === tab ? 'text-[#60a5fa] border-b-2 border-[#2563eb] bg-[#1e3a8a22]' : 'text-[#94a3b8]'}`}
            >
              {tab === 'chats' ? 'Chats' : tab === 'discover' ? 'Ontdek' : 'Verzoeken'}
            </div>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && Array.from(chats.values()).map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChat(chat)}
              className={`flex items-center p-3 cursor-pointer border-b border-[#0f172a] hover:bg-[#0f172a] transition ${activeChat?.id === chat.id ? 'bg-[#1e3a8a] border-l-4 border-[#60a5fa]' : ''}`}
            >
              <img src={chat.pic || `https://ui-avatars.com/api/?name=${chat.name}`} className="w-10 h-10 rounded-full object-cover mr-3" />
              <div className="flex-1">
                <h4 className="text-sm font-medium">{chat.name}</h4>
                <p className="text-[11px] text-gray-500">{chat.type}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Chat View */}
      <div className="flex-1 flex flex-col bg-[radial-gradient(circle_at_center,#0f172a,#020617)]">
        {activeChat ? (
          <>
            <div className="h-16 flex items-center px-5 bg-[#0f172a] border-b border-[#1e293b]">
               <h3 className="text-base font-bold">{activeChat.name}</h3>
            </div>
            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-3">
               {messages.map(msg => (
                 <div key={msg.id} className={`max-w-[80%] p-3 rounded-xl text-sm ${msg.uid === user?.uid ? 'self-end bg-[#172554]' : 'self-start bg-[#1e293b]'}`}>
                   {msg.text}
                 </div>
               ))}
            </div>
            <div className="p-4 bg-[#0f172a] border-t border-[#1e293b] flex gap-2">
              <input className="flex-1 bg-[#020617] border border-[#1e293b] rounded-lg px-4 py-2 outline-none" placeholder="Typ een bericht..." />
              <button className="bg-[#2563eb] px-6 py-2 rounded-lg font-bold">Verstuur</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500 font-medium">
            Selecteer een chat om te beginnen
          </div>
        )}
      </div>
    </div>
  );
};

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(<App />);
}
