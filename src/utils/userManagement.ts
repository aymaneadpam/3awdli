import { UserAccount, Gender } from '../types';
import { 
  saveUserToFirestore, 
  fetchUsersFromFirestore, 
  subscribeToUsers,
  updateUserPasswordInFirestore
} from '../lib/firestoreService';

export interface StoredUser extends UserAccount {
  password?: string;
}

const USERS_STORAGE_KEY = '3awdli_users';
const CURRENT_USER_STORAGE_KEY = '3awdli_current_user';

export const ADMIN_EMAIL = 'aymane.habbo@gmail.com';
export const LEGACY_ADMIN_EMAIL = 'aymaneoumlala@gmail.com';

/**
 * Super Admin Permission Checker
 * The dedicated super-account: aymane.habbo@gmail.com / aymaneoumlala@gmail.com (role: 'admin')
 * Has ultimate authority across the platform, including the unique capability
 * to grant and revoke the Administrator role to/from any registered member.
 */
export function isSuperAdmin(user?: UserAccount | null): boolean {
  if (!user) return false;
  const email = user.email?.toLowerCase();
  return (
    email === ADMIN_EMAIL.toLowerCase() ||
    email === LEGACY_ADMIN_EMAIL.toLowerCase() ||
    user.role === 'admin'
  );
}

// Global alias for the single super-admin account checker
export const isAdmin = isSuperAdmin;

/**
 * Administrator Permission Checker
 * Evaluates whether a user has full Administrator privileges (assignable role,
 * previously known as Founder) or is the super Admin account.
 * Administrators have full authority over The Lounge (articles, sessions, queue, hidden archive)
 * and can manage member roles (assigning Head of Listeners, Listener, Expert Facilitator).
 * Note: Administrators CANNOT grant or revoke the Administrator role (only Admin can).
 */
export function isAdministrator(user?: UserAccount | null): boolean {
  if (!user) return false;
  if (isSuperAdmin(user)) return true;
  return (
    user.role === 'administrator' ||
    Boolean(user.is_administrator) ||
    Boolean(user.is_founder)
  );
}

// Backward-compatible alias for previous Founder references
export const isFounder = isAdministrator;

/**
 * Expert Facilitator Permission Checker for The Lounge
 * A user with the "Expert Facilitator" role (role: 'facilitator' / 'host', is_facilitator: true, is_host: true),
 * the site Administrator / Admin, or the article author can write, edit, delete articles, open/close the queue,
 * call participants, and manage the lounge room.
 */
export function isExpertFacilitator(
  user?: UserAccount | null, 
  article?: { authorId?: string } | null
): boolean {
  if (!user) return false;
  if (
    user.role === 'facilitator' ||
    user.role === 'host' ||
    Boolean(user.is_facilitator) ||
    Boolean(user.is_host)
  ) {
    return true;
  }
  if (isAdministrator(user)) return true;
  if (article && article.authorId === user.id) return true;
  return false;
}

// Backward-compatible alias for existing imports
export const isLoungeHost = isExpertFacilitator;

/**
 * Writer Permission Checker for Teen Space
 * Users with the "Writer" role, the site Administrator, or the Admin super-account
 * can create, edit, delete, and republish Teen Space articles.
 */
export function isWriter(user?: UserAccount | null): boolean {
  if (!user) return false;
  if (isAdministrator(user)) return true;
  return (
    user.role === 'writer' ||
    Boolean(user.is_writer)
  );
}

// Generate a random one-time secure listener badge key
export function generateOneTimeListenerKey(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const segment1 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  const segment2 = Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `3AW-LISTEN-${segment1}-${segment2}`;
}

// Initial platform users: verified team members (no fake sample discussions)
const DEFAULT_INITIAL_USERS: StoredUser[] = [
  {
    id: 'user_admin_01',
    name: 'Aymane Oumlala',
    email: ADMIN_EMAIL,
    password: 'adminpassword',
    createdAt: 'Sep 1, 2026',
    role: 'admin',
    is_founder: true,
    is_administrator: true,
    is_facilitator: true,
    is_host: true,
    gender: 'Male',
    profession: 'Platform Director & Admin',
  },
  {
    id: 'team_listener_amina',
    name: 'Dr. Amina Mansouri',
    email: 'amina.mansouri@3awdli.org',
    password: 'listenerpassword',
    createdAt: 'Sep 1, 2026',
    role: 'listener',
    is_listener: true,
    isListener: true,
    is_head_of_listeners: true,
    gender: 'Female',
    profession: 'Clinical Psychologist & Supervisor',
  },
  {
    id: 'team_listener_youssef',
    name: 'Youssef Benali',
    email: 'youssef.benali@3awdli.org',
    password: 'listenerpassword',
    createdAt: 'Sep 2, 2026',
    role: 'listener',
    is_listener: true,
    isListener: true,
    is_head_of_listeners: false,
    gender: 'Male',
    profession: 'Psychological Support Counselor',
  },
];

const SAMPLE_USER_EMAILS = new Set([
  'salma.benali@example.com',
  'dr.youssef@example.com',
  'nadia.cherkaoui@example.com',
  'karim.tazi@example.com',
  'dr.amina@example.com',
  'mehdi.b@example.com',
  'sofia.berrada@example.com',
]);

export function isFakeUser(u: Partial<StoredUser> | null | undefined): boolean {
  if (!u) return true;
  if (u.id && (u.id.startsWith('user_sample_') || u.id === 'listener_other_leila')) return true;
  if (u.email && SAMPLE_USER_EMAILS.has(u.email.trim().toLowerCase())) return true;
  return false;
}

export function getStoredUsers(): StoredUser[] {
  try {
    if (typeof localStorage === 'undefined') return DEFAULT_INITIAL_USERS;
    const raw = localStorage.getItem(USERS_STORAGE_KEY);
    if (!raw) {
      localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(DEFAULT_INITIAL_USERS));
      return DEFAULT_INITIAL_USERS;
    }
    const rawUsers: StoredUser[] = JSON.parse(raw);
    if (!Array.isArray(rawUsers)) return DEFAULT_INITIAL_USERS;

    // Filter out any demo / test users from localStorage
    const users = rawUsers.filter((u) => !isFakeUser(u));
    
    let hasUpdated = users.length !== rawUsers.length;
    
    // Check if initial admin needs to be merged into stored users
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
      if (isAdminByEmail || isFirstAccount) {
        if (updatedUser.role !== 'admin' || !updatedUser.is_founder || !updatedUser.is_administrator) {
          hasUpdated = true;
          updatedUser.role = 'admin';
          updatedUser.is_founder = true;
          updatedUser.is_administrator = true;
        }
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

export function saveStoredUsers(users: StoredUser[], changedUser?: StoredUser): void {
  try {
    const cleanUsers = users.filter((u) => !isFakeUser(u));
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(cleanUsers));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_users_updated'));
    }
    // Only persist single changed user to prevent quota exhaustion
    if (changedUser && !isFakeUser(changedUser)) {
      saveUserToFirestore(changedUser).catch((e) => console.warn('Firestore single user save notice:', e));
    }
  } catch (err) {
    console.error('Failed to save users:', err);
  }
}

let isUsersSyncInitialized = false;

// Initialize real-time Firestore sync for users
export function initFirestoreUsersSync(): () => void {
  if (isUsersSyncInitialized) {
    return () => {};
  }
  isUsersSyncInitialized = true;

  // 1. Initial population from Firestore
  fetchUsersFromFirestore()
    .then((remoteUsers) => {
      if (remoteUsers && remoteUsers.length > 0) {
        const cleanRemote = remoteUsers.filter((u) => !isFakeUser(u));
        const localUsers = getStoredUsers();
        const mergedMap = new Map<string, StoredUser>();
        localUsers.forEach((u) => mergedMap.set(u.id, u));
        cleanRemote.forEach((u) => {
          const existing = mergedMap.get(u.id);
          mergedMap.set(u.id, { ...existing, ...u });
        });
        const merged = Array.from(mergedMap.values());
        localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('3awdli_users_updated'));
        }
      }
    })
    .catch((err) => {
      console.warn('Initial Firestore user fetch notice:', err);
    });

  // 2. Real-time Firestore subscription
  const unsubscribeFirestore = subscribeToUsers((remoteUsers) => {
    if (!remoteUsers) return;
    const cleanRemote = remoteUsers.filter((u) => !isFakeUser(u));
    const localUsers = getStoredUsers();
    const mergedMap = new Map<string, StoredUser>();
    localUsers.forEach((u) => mergedMap.set(u.id, u));
    cleanRemote.forEach((u) => {
      const existing = mergedMap.get(u.id);
      mergedMap.set(u.id, { ...existing, ...u });
    });
    const merged = Array.from(mergedMap.values());
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(merged));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_users_updated'));
    }
  });

  return () => {
    isUsersSyncInitialized = false;
    unsubscribeFirestore();
  };
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
      // If user account has been banned, immediately terminate session
      if (matched.is_banned) {
        localStorage.removeItem(CURRENT_USER_STORAGE_KEY);
        return null;
      }

      const refreshed: UserAccount = {
        id: matched.id,
        name: matched.name,
        email: matched.email,
        createdAt: matched.createdAt,
        role: matched.role,
        is_administrator: matched.is_administrator || (matched.role === 'admin' || matched.role === 'administrator'),
        is_founder: matched.is_founder,
        is_facilitator: matched.is_facilitator,
        is_host: matched.is_host,
        is_listener: matched.is_listener,
        isListener: matched.isListener || matched.is_listener,
        is_head_of_listeners: matched.is_head_of_listeners,
        is_writer: matched.is_writer || matched.role === 'writer',
        profession: matched.profession,
        gender: matched.gender,
        listener_granted_at: matched.listener_granted_at,
        listener_key_code: matched.listener_key_code,
        is_banned: matched.is_banned,
        bannedAt: matched.bannedAt,
        banReason: matched.banReason,
        bannedBy: matched.bannedBy,
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
  saveStoredUsers(users, updated);

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
  saveStoredUsers(users, updated);

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
  saveStoredUsers(users, updated);

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
    role: users[index].role === 'admin' 
      ? 'admin' 
      : (users[index].is_administrator || users[index].role === 'administrator' 
          ? 'administrator' 
          : (users[index].is_facilitator ? 'facilitator' : 'user')),
    is_listener: false,
    isListener: false,
    is_head_of_listeners: false,
    profession: users[index].is_administrator ? users[index].profession : undefined,
    listener_key_code: undefined,
  };

  users[index] = updated;
  saveStoredUsers(users, updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

// Assign Expert Facilitator role to a user
export function assignExpertFacilitatorRole(userId: string, customProfession?: string): UserAccount {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const user = users[index];
  const updated: StoredUser = {
    ...user,
    role: user.role === 'admin' ? 'admin' : (user.is_listener ? 'listener' : 'facilitator'),
    is_facilitator: true,
    is_host: true,
    ...(customProfession && customProfession.trim() ? { profession: customProfession.trim() } : {}),
  };

  users[index] = updated;
  saveStoredUsers(users, updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

// Revoke Expert Facilitator role from a user
export function revokeExpertFacilitatorRole(userId: string): UserAccount {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const user = users[index];
  const updated: StoredUser = {
    ...user,
    role: user.role === 'admin' 
      ? 'admin' 
      : (user.is_administrator || user.role === 'administrator' 
          ? 'administrator' 
          : (user.is_listener ? 'listener' : 'user')),
    is_facilitator: false,
    is_host: false,
  };

  users[index] = updated;
  saveStoredUsers(users, updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

/**
 * Assign Administrator role (Admin super-account only)
 * Grants full administrative management privileges (The Lounge + member role assignment)
 */
export function assignAdministratorRole(userId: string, profession?: string): StoredUser {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const user = users[index];
  const updated: StoredUser = {
    ...user,
    role: user.role === 'admin' ? 'admin' : 'administrator',
    is_administrator: true,
    is_founder: true, // preserve compatibility
    profession: profession?.trim() || user.profession || 'Platform Administrator',
  };

  users[index] = updated;
  saveStoredUsers(users, updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

/**
 * Revoke Administrator role (Admin super-account only)
 */
export function revokeAdministratorRole(userId: string): StoredUser {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const user = users[index];
  // Protect super-admin account from losing administrative privileges
  if (user.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase()) {
    return user;
  }

  const updated: StoredUser = {
    ...user,
    role: user.is_listener ? 'listener' : (user.is_facilitator ? 'facilitator' : 'user'),
    is_administrator: false,
    is_founder: false,
  };

  users[index] = updated;
  saveStoredUsers(users, updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

/**
 * Assign Writer role (Member Management & Administrator authority)
 * Grants authoring, editing, deleting and republishing privileges for Teen Space
 */
export function assignWriterRole(userId: string, customProfession?: string): StoredUser {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const user = users[index];
  const updated: StoredUser = {
    ...user,
    role: user.role === 'admin' ? 'admin' : (user.is_administrator ? 'administrator' : 'writer'),
    is_writer: true,
    profession: customProfession?.trim() || user.profession || 'Psychologist',
  };

  users[index] = updated;
  saveStoredUsers(users, updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

/**
 * Revoke Writer role from a user
 */
export function revokeWriterRole(userId: string): StoredUser {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const user = users[index];
  const updated: StoredUser = {
    ...user,
    role: user.role === 'admin' 
      ? 'admin' 
      : (user.is_administrator || user.role === 'administrator' 
          ? 'administrator' 
          : (user.is_listener ? 'listener' : (user.is_facilitator ? 'facilitator' : 'user'))),
    is_writer: false,
  };

  users[index] = updated;
  saveStoredUsers(users, updated);

  const current = getCurrentUser();
  if (current && current.id === userId) {
    setCurrentUser(updated);
  }

  return updated;
}

export type AssignableUnifiedRole = 'administrator' | 'head_of_listeners' | 'listener' | 'facilitator' | 'writer' | 'member';

export interface AssignRoleResult {
  updatedUser: UserAccount;
  oneTimeKey?: string;
}

// Unified role assignment engine for Administrator / Admin
export function assignRoleToUser(
  userId: string,
  targetRole: AssignableUnifiedRole,
  profession?: string,
  gender?: Gender
): AssignRoleResult {
  const users = getStoredUsers();
  const index = users.findIndex(u => u.id === userId);
  if (index === -1) {
    throw new Error('User not found');
  }

  const existing = users[index];

  if (targetRole === 'administrator') {
    // Administrator role: gives full editorial & role assignment authority (assignable by super Admin)
    const updated = assignAdministratorRole(
      userId,
      profession?.trim() || existing.profession || 'Platform Administrator'
    );
    if (gender) {
      updateListenerProfession(userId, updated.profession || 'Platform Administrator', gender);
    }
    return {
      updatedUser: updated,
    };
  }

  if (targetRole === 'head_of_listeners') {
    // Grants listener badge with head of listeners = true
    const res = grantListenerBadge(
      userId, 
      profession?.trim() || existing.profession || 'Clinical Psychologist & Consultant',
      true, 
      gender || existing.gender || 'Male'
    );
    return {
      updatedUser: res.updatedUser,
      oneTimeKey: res.oneTimeKey,
    };
  }

  if (targetRole === 'listener') {
    // Grants listener badge with head of listeners = false
    const res = grantListenerBadge(
      userId, 
      profession?.trim() || existing.profession || 'Psychologist',
      false, 
      gender || existing.gender || 'Male'
    );
    return {
      updatedUser: res.updatedUser,
      oneTimeKey: res.oneTimeKey,
    };
  }

  if (targetRole === 'facilitator') {
    // Expert Facilitator role: gives full editorial, scheduling, queue & circle control in The Lounge
    const updated = assignExpertFacilitatorRole(
      userId, 
      profession?.trim() || existing.profession || 'Expert Facilitator'
    );
    if (gender) {
      updateListenerProfession(userId, updated.profession || 'Expert Facilitator', gender);
    }
    return {
      updatedUser: updated,
    };
  }

  if (targetRole === 'writer') {
    // Writer role: gives authoring & article management in Teen Space
    const updated = assignWriterRole(
      userId,
      profession?.trim() || existing.profession || 'Psychologist'
    );
    if (gender) {
      updateListenerProfession(userId, updated.profession || 'Psychologist', gender);
    }
    return {
      updatedUser: updated,
    };
  }

  // Regular Member: reset all elevated roles
  revokeListenerBadge(userId);
  revokeExpertFacilitatorRole(userId);
  revokeWriterRole(userId);
  const finalMember = revokeAdministratorRole(userId);
  return {
    updatedUser: finalMember,
  };
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

// Update password directly in local storage and Firestore to guarantee complete invalidation of old password
export function updateUserPassword(email: string, newPassword: string): { success: boolean; user?: StoredUser; message?: string } {
  try {
    const users = getStoredUsers();
    const cleanEmail = email.trim().toLowerCase();
    let updatedCount = 0;
    let targetUser: StoredUser | undefined;

    const updatedUsers = users.map(u => {
      if (u.email && u.email.trim().toLowerCase() === cleanEmail) {
        updatedCount++;
        const updated = { ...u, password: newPassword };
        targetUser = updated;
        return updated;
      }
      return u;
    });

    if (updatedCount === 0) {
      const isTargetAdmin = cleanEmail === ADMIN_EMAIL.toLowerCase() || cleanEmail === LEGACY_ADMIN_EMAIL.toLowerCase();
      const newUser: StoredUser = {
        id: `user_${Date.now()}`,
        name: cleanEmail.split('@')[0],
        email: cleanEmail,
        password: newPassword,
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        role: isTargetAdmin ? 'admin' : 'user',
        is_administrator: isTargetAdmin,
        is_founder: isTargetAdmin,
      };
      updatedUsers.push(newUser);
      targetUser = newUser;
    }

    saveStoredUsers(updatedUsers, targetUser);

    // Also update currently active session if same email
    try {
      const currentRaw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
      if (currentRaw) {
        const current = JSON.parse(currentRaw);
        if (current.email && current.email.trim().toLowerCase() === cleanEmail) {
          localStorage.setItem(CURRENT_USER_STORAGE_KEY, JSON.stringify({ ...current, ...targetUser }));
        }
      }
    } catch {}

    // Synchronize to Firestore database
    updateUserPasswordInFirestore(cleanEmail, newPassword).catch(err => {
      console.warn('Firestore password overwrite notice:', err);
    });

    return { 
      success: true, 
      user: targetUser 
    };
  } catch (err) {
    console.error('Failed to update user password:', err);
    return { 
      success: false, 
      message: 'An error occurred while saving the new password.' 
    };
  }
}

/**
 * Permanently disable a registered user's account (Administrative Ban).
 * Prevents login going forward and immediately terminates active sessions.
 */
export function banUserAccount(
  userId: string, 
  reason?: string, 
  customMessage?: string, 
  adminUser?: UserAccount
): { success: boolean; user?: StoredUser; error?: string } {
  try {
    const users = getStoredUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'User account not found.' };
    }

    const targetUser = users[index];
    if (isSuperAdmin(targetUser)) {
      return { success: false, error: 'The platform super-administrator cannot be banned.' };
    }

    const now = new Date();
    const formattedDate = now.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    const banNote = customMessage?.trim() || reason?.trim() || 'Permanent administrative moderation sanction.';

    const updatedUser: StoredUser = {
      ...targetUser,
      is_banned: true,
      bannedAt: formattedDate,
      banReason: banNote,
      bannedBy: adminUser?.name || 'Platform Administrator',
    };

    users[index] = updatedUser;
    saveStoredUsers(users, updatedUser);

    // If currently logged in as this user, invalidate session immediately
    const current = getCurrentUser();
    if (current && (current.id === userId || current.email.toLowerCase() === targetUser.email.toLowerCase())) {
      setCurrentUser(null);
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_user_banned', { detail: { userId, user: updatedUser } }));
      window.dispatchEvent(new CustomEvent('3awdli_users_updated', { detail: { users } }));
    }

    return { success: true, user: updatedUser };
  } catch (err) {
    console.error('Failed to ban user account:', err);
    return { success: false, error: 'An unexpected error occurred while applying account ban.' };
  }
}

/**
 * Remove ban from user account (recovery / appeal).
 */
export function unbanUserAccount(userId: string): { success: boolean; user?: StoredUser; error?: string } {
  try {
    const users = getStoredUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'User account not found.' };
    }

    const targetUser = users[index];
    const updatedUser: StoredUser = {
      ...targetUser,
      is_banned: false,
      bannedAt: undefined,
      banReason: undefined,
      bannedBy: undefined,
    };

    users[index] = updatedUser;
    saveStoredUsers(users, updatedUser);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_users_updated', { detail: { users } }));
    }

    return { success: true, user: updatedUser };
  } catch (err) {
    console.error('Failed to unban user account:', err);
    return { success: false, error: 'Failed to lift account ban.' };
  }
}

/**
 * Check if a user ID or email is currently banned.
 */
export function isUserAccountBanned(userIdOrEmail: string): boolean {
  if (!userIdOrEmail) return false;
  const users = getStoredUsers();
  const cleanTarget = userIdOrEmail.trim().toLowerCase();
  const found = users.find(u => u.id === userIdOrEmail || u.email.toLowerCase() === cleanTarget);
  return Boolean(found?.is_banned);
}

/**
 * Record and increment an official warning count for a registered member.
 */
export function recordUserWarning(
  userIdOrEmail: string,
  reason?: string,
  adminUser?: UserAccount
): { success: boolean; user?: StoredUser; count: number; error?: string } {
  try {
    if (!userIdOrEmail) {
      return { success: false, count: 0, error: 'User identifier required.' };
    }

    const users = getStoredUsers();
    const cleanTarget = userIdOrEmail.trim().toLowerCase();
    const index = users.findIndex(
      u => u.id === userIdOrEmail || u.email.toLowerCase() === cleanTarget
    );

    if (index === -1) {
      return { success: false, count: 0, error: 'User account not found.' };
    }

    const targetUser = users[index];
    const currentCount = Number(targetUser.warning_count || targetUser.warningsCount || 0);
    const newCount = currentCount + 1;

    const updatedUser: StoredUser = {
      ...targetUser,
      warning_count: newCount,
      warningsCount: newCount,
    };

    users[index] = updatedUser;
    saveStoredUsers(users, updatedUser);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('3awdli_user_warned', {
          detail: {
            userId: targetUser.id,
            count: newCount,
            user: updatedUser,
            reason,
            admin: adminUser?.name || 'Administrator',
          },
        })
      );
      window.dispatchEvent(new CustomEvent('3awdli_users_updated', { detail: { users } }));
    }

    return { success: true, user: updatedUser, count: newCount };
  } catch (err) {
    console.error('Failed to record user warning:', err);
    return { success: false, count: 0, error: 'Failed to record warning.' };
  }
}

/**
 * Get the total cumulative warning count for a user.
 */
export function getUserWarningCount(userOrIdOrEmail?: UserAccount | StoredUser | string | null): number {
  if (!userOrIdOrEmail) return 0;

  if (typeof userOrIdOrEmail === 'object') {
    const directCount = Number(userOrIdOrEmail.warning_count || userOrIdOrEmail.warningsCount || 0);
    if (directCount > 0) return directCount;

    // Cross-check stored users in case user object was stale
    const users = getStoredUsers();
    const targetEmail = userOrIdOrEmail.email?.toLowerCase();
    const found = users.find(u => u.id === userOrIdOrEmail.id || (targetEmail && u.email.toLowerCase() === targetEmail));
    return Number(found?.warning_count || found?.warningsCount || 0);
  }

  const cleanTarget = String(userOrIdOrEmail).trim().toLowerCase();
  const users = getStoredUsers();
  const found = users.find(u => u.id === userOrIdOrEmail || u.email.toLowerCase() === cleanTarget);
  return Number(found?.warning_count || found?.warningsCount || 0);
}

/**
 * Reset warning count for a user (e.g. administrator pardoning).
 */
export function resetUserWarningCount(userId: string): { success: boolean; user?: StoredUser; error?: string } {
  try {
    const users = getStoredUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'User account not found.' };
    }

    const targetUser = users[index];
    const updatedUser: StoredUser = {
      ...targetUser,
      warning_count: 0,
      warningsCount: 0,
    };

    users[index] = updatedUser;
    saveStoredUsers(users, updatedUser);

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_users_updated', { detail: { users } }));
    }

    return { success: true, user: updatedUser };
  } catch (err) {
    console.error('Failed to reset user warning count:', err);
    return { success: false, error: 'Failed to reset warning count.' };
  }
}

/**
 * Update a user's display name
 */
export function updateUserDisplayName(userId: string, newName: string): { success: boolean; user?: UserAccount; error?: string } {
  try {
    const cleanName = newName.trim();
    if (!cleanName) {
      return { success: false, error: 'Name cannot be empty.' };
    }
    if (cleanName.length > 50) {
      return { success: false, error: 'Name cannot exceed 50 characters.' };
    }

    const users = getStoredUsers();
    const index = users.findIndex(u => u.id === userId);
    if (index === -1) {
      return { success: false, error: 'User account not found.' };
    }

    const updatedUser: StoredUser = {
      ...users[index],
      name: cleanName,
    };

    users[index] = updatedUser;
    saveStoredUsers(users, updatedUser);

    const raw = localStorage.getItem(CURRENT_USER_STORAGE_KEY);
    if (raw) {
      try {
        const current: UserAccount = JSON.parse(raw);
        if (current.id === userId) {
          current.name = cleanName;
          setCurrentUser(current);
        }
      } catch {
        // ignore
      }
    }

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('3awdli_users_updated', { detail: { users } }));
    }

    return { success: true, user: updatedUser };
  } catch (err) {
    console.error('Failed to update user display name:', err);
    return { success: false, error: 'Failed to update name.' };
  }
}



