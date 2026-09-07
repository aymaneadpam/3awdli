import { UserAccount } from '../types';

export interface StoredUser extends UserAccount {
  password?: string;
}

const USERS_STORAGE_KEY = '3awdli_users';
const CURRENT_USER_STORAGE_KEY = '3awdli_current_user';

export const ADMIN_EMAIL = 'aymaneoumlala@gmail.com';

// Generate a random one-time secure listener badge key
export function generateOneTimeListenerKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const segment2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `3AW-LISTEN-${segment1}-${segment2}`;
}

// Initial sample users so the admin has users to browse, search, and manage
const DEFAULT_INITIAL_USERS: StoredUser[] = [
  {
    id: 'user_admin_01',
    name: 'Aymane Oumlala',
    email: ADMIN_EMAIL,
    password: 'adminpassword',
    createdAt: 'Sep 1, 2026',
    role: 'admin',
    gender: 'Male',
    profession: 'Platform Director & Administrator',
  },
  {
    id: 'user_sample_02',
    name: 'Salma Benali',
    email: 'salma.benali@example.com',
    password: 'password123',
    createdAt: 'Sep 2, 2026',
    role: 'user',
    gender: 'Female',
  },
  {
    id: 'user_sample_03',
    name: 'Dr. Youssef El Alami',
    email: 'dr.youssef@example.com',
    password: 'password123',
    createdAt: 'Sep 3, 2026',
    role: 'listener',
    is_listener: true,
    isListener: true,
    is_head_of_listeners: true,
    profession: 'Clinical Psychologist & Consultant',
    gender: 'Male',
    listener_granted_at: 'Sep 3, 2026',
    listener_key_code: '3AW-LISTEN-7X4K-9M2Q',
  },
  {
    id: 'user_sample_06',
    name: 'Dr. Amina Mansouri',
    email: 'dr.amina@example.com',
    password: 'password123',
    createdAt: 'Sep 3, 2026',
    role: 'listener',
    is_listener: true,
    isListener: true,
    is_head_of_listeners: false,
    profession: 'Cognitive Behavioral Specialist',
    gender: 'Female',
    listener_granted_at: 'Sep 3, 2026',
    listener_key_code: '3AW-LISTEN-4B8T-1X9M',
  },
  {
    id: 'user_sample_07',
    name: 'Mehdi Benjelloun',
    email: 'mehdi.b@example.com',
    password: 'password123',
    createdAt: 'Sep 4, 2026',
    role: 'listener',
    is_listener: true,
    isListener: true,
    is_head_of_listeners: false,
    profession: 'Mental Health Peer Counselor',
    gender: 'Male',
    listener_granted_at: 'Sep 4, 2026',
    listener_key_code: '3AW-LISTEN-9L3K-5N7V',
  },
  {
    id: 'user_sample_04',
    name: 'Nadia Cherkaoui',
    email: 'nadia.cherkaoui@example.com',
    password: 'password123',
    createdAt: 'Sep 4, 2026',
    role: 'user',
    gender: 'Female',
  },
  {
    id: 'user_sample_05',
    name: 'Karim Tazi',
    email: 'karim.tazi@example.com',
    password: 'password123',
    createdAt: 'Sep 5, 2026',
    role: 'user',
    gender: 'Male',
  }
];

export function getStoredUsers(): StoredUser[] {
  try {
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_USERS));
      return DEFAULT_INITIAL_USERS;
    }
    const users: StoredUser[] = JSON.parse(raw);
    
    // Ensure admin email always has admin role and listeners have key codes & gender
    let hasUpdated = false;
    
    // Check if new initial listeners need to be merged into stored users
    for (const initU of DEFAULT_INITIAL_USERS) {
      if (!users.some(u => u.id === initU.id || u.email.toLowerCase() === initU.email.toLowerCase())) {
        users.push(initU);
        hasUpdated = true;
      }
    }

    const verifiedUsers = users.map((u, idx) => {
      let updatedUser = { ...u };
      const isAdminByEmail = u.email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
      const isFirstAccount = idx === 0;
      if ((isAdminByEmail || isFirstAccount) && updatedUser.role !== 'admin') {
        hasUpdated = true;
        updatedUser.role = 'admin';
      }

      const isListener = updatedUser.is_listener || updatedUser.isListener || updatedUser.role === 'listener';
      if (isListener && !updatedUser.listener_key_code) {
        hasUpdated = true;
        updatedUser.listener_key_code = generateOneTimeListenerKey();
      }

      // Ensure gender is defined on all profiles
      if (!updatedUser.gender) {
        hasUpdated = true;
        const nameLower = updatedUser.name.toLowerCase();
        const isFemale = nameLower.includes('amina') || nameLower.includes('salma') || nameLower.includes('nadia') || nameLower.includes('sara') || nameLower.includes('fatima');
        updatedUser.gender = isFemale ? 'Female' : 'Male';
      }

      return updatedUser;
    });

    if (hasUpdated) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(verifiedUsers));
      return verifiedUsers;
    }

    return users;
  } catch (err) {
    console.error('Failed to read stored users:', err);
    return DEFAULT_INITIAL_USERS;
  }
}

export function saveStoredUsers(users: StoredUser[]): void {
  try {
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
  } catch (err) {
    console.error('Failed to save users:', err);
  }
}

export function getCurrentUser(): UserAccount | null {
  try {
    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (!raw) return null;
    const user: UserAccount = JSON.parse(raw);

    // Refresh against stored users in case roles/profession were updated by admin
    const stored = getStoredUsers();
    const matched = stored.find(u => u.id === user.id || u.email.toLowerCase() === user.email.toLowerCase());
    if (matched) {
      const refreshed: UserAccount = {
        id: matched.id,
        name: matched.name,
        email: matched.email,
        createdAt: matched.createdAt,
        role: matched.role,
        is_listener: matched.is_listener,
        isListener: matched.isListener || matched.is_listener,
        is_head_of_listeners: matched.is_head_of_listeners,
        profession: matched.profession,
        gender: matched.gender,
        listener_granted_at: matched.listener_granted_at,
        listener_key_code: matched.listener_key_code,
      };
      localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(refreshed));
      return refreshed;
    }
    return user;
  } catch {
    return null;
  }
}

export function setCurrentUser(user: UserAccount | null): void {
  if (!user) {
    localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
  } else {
    localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify(user));
  }
}

// Grant the Listener Badge to a user
export interface GrantBadgeResult {
  updatedUser: UserAccount;
  oneTimeKey: string;
}

export function grantListenerBadge(
  userId: string, 
  profession: string, 
  isHeadOfListeners: boolean = false,
  gender: 'Male' | 'Female' = 'Male'
): GrantBadgeResult {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const oneTimeKey = generateOneTimeListenerKey();
  const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const updated: StoredUser = {
    ...users[index],
    role: users[index].role === 'admin' ? 'admin' : 'listener',
    is_listener: true,
    isListener: true,
    is_head_of_listeners: isHeadOfListeners,
    profession: profession.trim() || 'Psychology Team Listener',
    gender: gender || users[index].gender || 'Male',
    listener_granted_at: nowStr,
    listener_key_code: oneTimeKey,
  };

  users[index] = updated;
  saveStoredUsers(users);

  // If this happens to be the currently logged-in user, refresh their session
  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      createdAt: updated.createdAt,
      role: updated.role,
      is_listener: updated.is_listener,
      isListener: updated.isListener,
      is_head_of_listeners: updated.is_head_of_listeners,
      profession: updated.profession,
      gender: updated.gender,
      listener_granted_at: updated.listener_granted_at,
      listener_key_code: updated.listener_key_code,
    });
  }

  return {
    updatedUser: updated,
    oneTimeKey,
  };
}

// Update listener profession and/or gender
export function updateListenerProfession(
  userId: string, 
  newProfession: string, 
  newGender?: 'Male' | 'Female'
): UserAccount {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const updated: StoredUser = {
    ...users[index],
    profession: newProfession.trim(),
    ...(newGender ? { gender: newGender } : {}),
  };

  users[index] = updated;
  saveStoredUsers(users);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

// Toggle or set Head of Listeners flag
export function toggleHeadOfListeners(userId: string, isHead: boolean): UserAccount {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const updated: StoredUser = {
    ...users[index],
    is_head_of_listeners: isHead,
  };

  users[index] = updated;
  saveStoredUsers(users);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

// Revoke listener badge if needed
export function revokeListenerBadge(userId: string): UserAccount {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const updated: StoredUser = {
    ...users[index],
    role: users[index].role === 'admin' ? 'admin' : 'user',
    is_listener: false,
    isListener: false,
    is_head_of_listeners: false,
    profession: undefined,
    listener_key_code: undefined,
  };

  users[index] = updated;
  saveStoredUsers(users);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

// Retrieve a listener's personal key code
export function getListenerKeyCode(userId: string): string | null {
  const users = getStoredUsers();
  const user = users.find(u => u.id === userId);
  if (!user) return null;
  return user.listener_key_code || null;
}

// Verify entered key code against listener's personal one-time key code
export function verifyListenerKeyCode(userId: string, enteredKey: string): boolean {
  if (!enteredKey || !enteredKey.trim()) return false;
  const users = getStoredUsers();
  const user = users.find(u => u.id === userId);
  if (!user || !user.listener_key_code) return false;

  const cleanEntered = enteredKey.trim().toUpperCase().replace(/[\s-]/g, '');
  const cleanStored = user.listener_key_code.trim().toUpperCase().replace(/[\s-]/g, '');

  return cleanEntered === cleanStored;
}

// Find user by email for password recovery and account checks
export function findUserByEmail(email: string): StoredUser | null {
  const users = getStoredUsers();
  const cleanEmail = email.trim().toLowerCase();
  return users.find(u => u.email.toLowerCase() === cleanEmail) || null;
}

// Update password directly in local storage for testing & recovery
export function updateUserPassword(email: string, newPassword: string): { success: boolean; user?: StoredUser; message?: string } {
  try {
    const users = getStoredUsers();
    const cleanEmail = email.trim().toLowerCase();
    const userIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);

    if (userIndex === -1) {
      return { 
        success: false, 
        message: 'No registered user was found with this email. Please check the spelling or sign up.' 
      };
    }

    users[userIndex].password = newPassword;
    saveStoredUsers(users);

    return { 
      success: true, 
      user: users[userIndex] 
    };
  } catch (err) {
    console.error('Failed to update user password:', err);
    return { 
      success: false, 
      message: 'An error occurred while saving the new password.' 
    };
  }
}
