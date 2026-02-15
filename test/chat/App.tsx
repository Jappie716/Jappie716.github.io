
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { UserData, ChatItem, Message, FriendRequest } from './types';

// NOTE: Firebase constants are defined directly in scripts in index.html for simplicity in this specific setup,
// but we interact via window.firebase or global access.
declare const firebase: any;

const ADMIN_EMAILS = ["someoeneheilig@gmail.com", "melle1337k@gmail.com"];

const App: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [currentUserData, setCurrentUserData] = useState<UserData | null>(null);
  const [activeChat, setActiveChat] = useState<ChatItem | null>(null);
  const [activeTab, setActiveTab] = useState<'chats' | 'discover' | 'requests'>('chats');
  const [searchQuery, setSearchQuery] = useState('');
  const [chats, setChats] = useState<Map<string, ChatItem>>(new Map());
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingStatus, setTypingStatus] = useState<string[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [sentRequests, setSentRequests] = useState<Set<string>>(new Set());
  const [discoverUsers, setDiscoverUsers] = useState<UserData[]>([]);
  
  const db = firebase.firestore();
  const auth = firebase.auth();

  // Initialization
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((u: any) => {
      setUser(u);
      if (u) {
        initUserData(u);
      } else {
        // Handle redirect or login logic if needed
      }
    });
    return () => unsub();
  }, []);

  const initUserData = async (u: any) => {
    const userRef = db.collection("users").doc(u.uid);
    userRef.onSnapshot((doc: any) => {
      if (doc.exists) {
        setCurrentUserData({ uid: u.uid, ...doc.data() });
      }
    });
    
    // Heartbeat for presence
    const presenceInterval = setInterval(() => {
      // Only heartbeat if not manually set to offline
      userRef.get().then((doc: any) => {
        const data = doc.data();
        if (data?.status !== 'offline') {
          userRef.update({ 
            lastSeen: firebase.firestore.FieldValue.serverTimestamp() 
          });
        }
      });
    }, 60000);

    return () => clearInterval(presenceInterval);
  };

  const handleStatusChange = async (newStatus: 'online' | 'offline') => {
    if (!user) return;
    const userRef = db.collection("users").doc(user.uid);
    await userRef.update({ 
      status: newStatus,
      lastSeen: newStatus === 'online' ? firebase.firestore.FieldValue.serverTimestamp() : null
    });
  };

  // Chat Data Syncing (Simplified version of the complex listener logic)
  useEffect(() => {
    if (!user) return;
    
    // Subscribe to friends for private chats
    const friendsUnsub = db.collection("users").doc(user.uid).collection("friends").onSnapshot((snap: any) => {
      snap.forEach((doc: any) => {
        const friendData = doc.data();
        const chatId = [user.uid, doc.id].sort().join("_");
        // Sync chat metadata
        setChats(prev => {
          const next = new Map(prev);
          if (!next.has(doc.id)) {
            next.set(doc.id, {
              id: doc.id,
              name: friendData.name,
              pic: friendData.pic,
              type: 'private'
            });
          }
          return next;
        });
      });
    });

    // Subscribe to groups
    const groupsUnsub = db.collection("groups").where("members", "array-contains", user.uid).onSnapshot((snap: any) => {
      snap.forEach((doc: any) => {
        const groupData = doc.data();
        setChats(prev => {
          const next = new Map(prev);
          next.set(doc.id, {
            id: doc.id,
            name: groupData.name,
            pic: groupData.pic,
            type: 'group'
          });
          return next;
        });
      });
    });

    // Global Chat
    setChats(prev => {
      const next = new Map(prev);
      next.set('global', {
        id: 'global',
        name: 'Algemeen',
        pic: 'https://i.imgur.com/C9HtyPv.jpeg',
        type: 'global'
      });
      return next;
    });

    return () => {
      friendsUnsub();
      groupsUnsub();
    };
  }, [user]);

  // Handle message loading for active chat
  useEffect(() => {
    if (!activeChat) return;
    
    let ref;
    if (activeChat.type === 'global') ref = db.collection("chats");
    else if (activeChat.type === 'group') ref = db.collection("groups").doc(activeChat.id).collection("messages");
    else ref = db.collection("private_chats").doc([user.uid, activeChat.id].sort().join("_")).collection("messages");

    const unsub = ref.orderBy("timestamp", "desc").limit(50).onSnapshot((snap: any) => {
      const msgs: Message[] = [];
      snap.forEach((doc: any) => msgs.push({ id: doc.id, ...doc.data() }));
      setMessages(msgs.reverse());
    });

    return () => unsub();
  }, [activeChat, user]);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar */}
      <div className="w-80 bg-[#010409] border-r border-[#1e293b] flex flex-col">
        {/* Sidebar Header with Requested Change */}
        <div className="p-4 bg-[#0f172a] flex items-center gap-3 border-b border-[#1e293b]">
          <img 
            src={currentUserData?.pic || `https://ui-avatars.com/api/?name=${currentUserData?.name || 'User'}`} 
            className="w-10 h-10 rounded-full border-2 border-[#2563eb] object-cover cursor-pointer"
            alt="Profile"
          />
          <div className="flex-1 flex flex-col">
            <b className="text-sm truncate">{currentUserData?.name || 'Laden...'}</b>
            
            {/* New Status Select Component */}
            <select 
              value={currentUserData?.status || 'online'}
              onChange={(e) => handleStatusChange(e.target.value as 'online' | 'offline')}
              className="bg-transparent text-[#94a3b8] border-none text-[10px] outline-none cursor-pointer p-0 w-fit"
            >
              <option value="online" className="bg-[#0f172a] text-green-500">🟢 Online</option>
              <option value="offline" className="bg-[#0f172a] text-gray-500">⚪ Offline</option>
            </select>
          </div>
          <button className="bg-[#2563eb] text-white px-2 py-1 rounded text-xs font-bold hover:bg-blue-600 transition">+ Groep</button>
        </div>

        {/* Search */}
        <div className="p-3 bg-[#010409] border-b border-[#1e293b]">
          <input 
            type="text" 
            placeholder="🔍 Zoeken..." 
            className="w-full bg-[#0f172a] border border-[#1e293b] p-2 rounded text-sm outline-none text-white"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Tabs */}
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

        {/* List Content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'chats' && Array.from(chats.values()).map(chat => (
            <div 
              key={chat.id} 
              onClick={() => setActiveChat(chat)}
              className={`flex items-center p-3 cursor-pointer border-b border-[#0f172a] hover:bg-[#0f172a] transition ${activeChat?.id === chat.id ? 'bg-[#1e3a8a] border-l-4 border-[#60a5fa]' : ''}`}
            >
              <div className="relative mr-3">
                <img src={chat.pic || `https://ui-avatars.com/api/?name=${chat.name}`} className="w-10 h-10 rounded-full object-cover" />
                {chat.type === 'private' && (
                   <div className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-[#010409] ${chat.online ? 'bg-[#22c55e]' : 'bg-[#64748b]'}`} />
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <h4 className="text-sm text-[#e2e8f0] truncate">{chat.name}</h4>
                <p className="text-[11px] text-gray-500 truncate">{chat.type === 'private' ? 'Vriend' : chat.type === 'group' ? 'Groep' : 'Community'}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#1e293b] bg-[#010409]">
          <button className="w-full py-2 border border-[#334155] rounded text-[#94a3b8] hover:text-white hover:border-[#2563eb] transition text-sm">
            ⬅ Terug naar Home
          </button>
        </div>
      </div>

      {/* Main Chat Window */}
      <div className="flex-1 flex flex-col bg-[radial-gradient(circle_at_center,#0f172a,#020617)]">
        {activeChat ? (
          <>
            <div className="h-16 flex items-center px-5 bg-[#0f172a] border-b border-[#1e293b]">
               <img src={activeChat.pic || `https://ui-avatars.com/api/?name=${activeChat.name}`} className="w-10 h-10 rounded-full object-cover mr-3" />
               <div className="flex-1">
                 <h3 className="text-base font-bold">{activeChat.name}</h3>
                 <span className="text-[11px] text-gray-500">
                    {activeChat.type === 'private' ? (activeChat.online ? 'Online' : 'Offline') : 'Groepschat'}
                 </span>
               </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2">
               {messages.map(msg => (
                 <div 
                   key={msg.id} 
                   className={`max-w-[75%] p-3 rounded-xl text-sm relative break-words ${msg.uid === user?.uid ? 'self-end bg-[#172554] rounded-br-none' : 'self-start bg-[#1e293b] rounded-bl-none'}`}
                 >
                   {activeChat.type !== 'private' && msg.uid !== user?.uid && (
                     <span className="text-[10px] text-[#60a5fa] font-bold block mb-1">{msg.user}</span>
                   )}
                   {msg.image ? (
                     <img src={msg.image} className="max-w-full rounded-lg cursor-pointer" alt="Shared" />
                   ) : (
                     msg.text
                   )}
                 </div>
               ))}
            </div>

            <div className="p-4 bg-[#0f172a] border-t border-[#1e293b] flex gap-3">
              <button className="bg-[#334155] w-11 h-11 rounded-lg flex items-center justify-center hover:bg-[#475569]">
                📸
              </button>
              <textarea 
                className="flex-1 bg-[#020617] border border-[#1e293b] rounded-lg p-2 text-white outline-none resize-none h-11"
                placeholder="Typ bericht..."
              ></textarea>
              <button className="bg-[#2563eb] text-white px-5 rounded-lg font-bold hover:bg-blue-600">➤</button>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            Selecteer een chat om te beginnen
          </div>
        )}
      </div>
    </div>
  );
};

export default App;
