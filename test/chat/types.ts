
export interface UserData {
  uid: string;
  name: string;
  pic?: string;
  email: string;
  status?: 'online' | 'offline';
  lastSeen?: any;
  joinedAt?: any;
}

export interface ChatItem {
  id: string;
  name: string;
  pic?: string;
  type: 'global' | 'group' | 'private';
  timestamp?: number;
  unread?: boolean;
  online?: boolean;
}

export interface Message {
  id: string;
  text?: string;
  image?: string;
  user: string;
  uid: string;
  timestamp: any;
  type?: 'system';
  replyTo?: {
    id: string;
    user: string;
    text: string;
  };
  edited?: boolean;
}

export interface FriendRequest {
  id: string;
  name: string;
  pic?: string;
  timestamp: any;
}
