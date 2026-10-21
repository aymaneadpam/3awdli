import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithPopup,
  signInAnonymously,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  UserAccount, 
  DiscussionConversation, 
  ConversationShareRequest, 
  SupportRequest,
  DiscussionReport,
  UserMailboxMessage,
  LoungeArticle,
  TeenSpaceArticle,
  RuleCategory,
  ChatScheduleWindow
} from '../types';

// Collection references
export const USERS_COLLECTION = 'users';
export const DISCUSSIONS_COLLECTION = 'discussions';
export const DISCUSSION_REPORTS_COLLECTION = 'discussion_reports';
export const USER_MAILBOX_MESSAGES_COLLECTION = 'user_mailbox_messages';
export const SHARE_REQUESTS_COLLECTION = 'share_requests';
export const SUPPORT_REQUESTS_COLLECTION = 'support_requests';
export const LOUNGE_ARTICLES_COLLECTION = 'lounge_articles';
export const TEEN_SPACE_ARTICLES_COLLECTION = 'teen_space_articles';
export const RULES_CATEGORIES_COLLECTION = 'rules_categories';
export const CHAT_SCHEDULES_COLLECTION = 'chat_schedules';

// Role checking helpers
export function isUserAdminOrHead(user?: UserAccount | null): boolean {
  if (!user) return false;
  const email = (user.email || '').toLowerCase().trim();
  const isAdmin =
    user.role === 'admin' ||
    user.role === 'administrator' ||
    Boolean(user.is_administrator) ||
    Boolean(user.is_founder) ||
    email === 'aymane.habbo@gmail.com' ||
    email === 'aymaneoumlala@gmail.com';
  const isHead = Boolean(user.is_head_of_listeners);
  return isAdmin || isHead;
}

export function isUserListenerOrHigher(user?: UserAccount | null): boolean {
  if (!user) return false;
  if (isUserAdminOrHead(user)) return true;
  return Boolean(user.is_listener || user.isListener || user.role === 'listener');
}

// Helper to remove undefined fields and strip plaintext passwords before sending to Firestore
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'password') {
      // NEVER store password in Firestore
      continue;
    }
    if (value !== undefined) {
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        result[key] = sanitizeForFirestore(value);
      } else if (Array.isArray(value)) {
        result[key] = value.map(item => 
          item && typeof item === 'object' && !(item instanceof Date)
            ? sanitizeForFirestore(item)
            : item
        );
      } else {
        result[key] = value;
      }
    }
  }
  return result as T;
}

// -------------------------------------------------------------
// FIRESTORE USERS MANAGEMENT
// -------------------------------------------------------------

export async function fetchUsersFromFirestore(currentUser?: UserAccount | null): Promise<UserAccount[]> {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous()) {
    return [];
  }
  try {
    if (isUserAdminOrHead(currentUser)) {
      const colRef = collection(db, USERS_COLLECTION);
      const snap = await getDocs(colRef);
      const users: UserAccount[] = [];
      snap.forEach((docSnap) => {
        users.push({ id: docSnap.id, ...docSnap.data() } as UserAccount);
      });
      return users;
    } else {
      // Regular user only reads own document
      const docRef = doc(db, USERS_COLLECTION, currentUser.id);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return [{ id: snap.id, ...snap.data() } as UserAccount];
      }
      return [];
    }
  } catch (err) {
    // Fail silently from local cache
    return [];
  }
}

export async function saveUserToFirestore(user: UserAccount): Promise<void> {
  if (!user.id) return;
  try {
    const docRef = doc(db, USERS_COLLECTION, user.id);
    const cleanData = sanitizeForFirestore(user);
    delete (cleanData as any).password;
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    // Fail silently
  }
}

export function subscribeToUsers(
  currentUser: UserAccount | null | undefined,
  onUsersUpdate: (users: UserAccount[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous()) {
    onUsersUpdate([]);
    return () => {};
  }

  try {
    if (isUserAdminOrHead(currentUser)) {
      const colRef = collection(db, USERS_COLLECTION);
      return onSnapshot(
        colRef,
        (snap) => {
          const users: UserAccount[] = [];
          snap.forEach((docSnap) => {
            users.push({ id: docSnap.id, ...docSnap.data() } as UserAccount);
          });
          onUsersUpdate(users);
        },
        (err) => {
          // Fail silently
          if (onError) onError(err);
        }
      );
    } else {
      // Regular user only reads own document
      const docRef = doc(db, USERS_COLLECTION, currentUser.id);
      return onSnapshot(
        docRef,
        (docSnap) => {
          if (docSnap.exists()) {
            onUsersUpdate([{ id: docSnap.id, ...docSnap.data() } as UserAccount]);
          } else {
            onUsersUpdate([]);
          }
        },
        (err) => {
          // Fail silently
          if (onError) onError(err);
        }
      );
    }
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

// -------------------------------------------------------------
// FIRESTORE DISCUSSIONS MANAGEMENT
// -------------------------------------------------------------

export async function fetchDiscussionsFromFirestore(): Promise<DiscussionConversation[]> {
  try {
    const colRef = collection(db, DISCUSSIONS_COLLECTION);
    const snap = await getDocs(colRef);
    const list: DiscussionConversation[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as DiscussionConversation);
    });
    return list;
  } catch (err) {
    console.error('Error fetching discussions from Firestore:', err);
    return [];
  }
}

export async function saveDiscussionToFirestore(discussion: DiscussionConversation): Promise<void> {
  if (!discussion.id) return;
  try {
    const docRef = doc(db, DISCUSSIONS_COLLECTION, discussion.id);
    const cleanData = sanitizeForFirestore(discussion);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`Error saving discussion ${discussion.id} to Firestore:`, err);
  }
}

export async function deleteDiscussionFromFirestore(discussionId: string): Promise<boolean> {
  if (!discussionId) return false;
  try {
    const docRef = doc(db, DISCUSSIONS_COLLECTION, discussionId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error(`Error deleting discussion ${discussionId} from Firestore:`, err);
    return false;
  }
}

export async function deleteAllDiscussionsFromFirestore(): Promise<number> {
  try {
    const colRef = collection(db, DISCUSSIONS_COLLECTION);
    const snap = await getDocs(colRef);
    let count = 0;
    const promises: Promise<void>[] = [];
    snap.forEach((docSnap) => {
      promises.push(deleteDoc(doc(db, DISCUSSIONS_COLLECTION, docSnap.id)));
      count++;
    });
    await Promise.all(promises);
    return count;
  } catch (err) {
    console.error('Error deleting all discussions from Firestore:', err);
    return 0;
  }
}

export function subscribeToDiscussions(
  onDiscussionsUpdate: (discussions: DiscussionConversation[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, DISCUSSIONS_COLLECTION);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: DiscussionConversation[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DiscussionConversation);
      });
      onDiscussionsUpdate(list);
    },
    (err) => {
      console.error('Firestore discussions subscription error:', err);
      if (onError) onError(err);
    }
  );
}

// -------------------------------------------------------------
// FIRESTORE SHARE REQUESTS MANAGEMENT
// -------------------------------------------------------------

export async function fetchShareRequestsFromFirestore(currentUser?: UserAccount | null): Promise<ConversationShareRequest[]> {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous() || !isUserListenerOrHigher(currentUser)) {
    return [];
  }
  try {
    const colRef = collection(db, SHARE_REQUESTS_COLLECTION);
    const snap = await getDocs(colRef);
    const list: ConversationShareRequest[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ConversationShareRequest);
    });
    return list;
  } catch (err) {
    return [];
  }
}

export async function saveShareRequestToFirestore(request: ConversationShareRequest): Promise<void> {
  if (!request.id) return;
  try {
    const docRef = doc(db, SHARE_REQUESTS_COLLECTION, request.id);
    const cleanData = sanitizeForFirestore(request);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    // Fail silently
  }
}

export function subscribeToShareRequests(
  currentUser: UserAccount | null | undefined,
  onUpdate: (requests: ConversationShareRequest[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous() || !isUserListenerOrHigher(currentUser)) {
    onUpdate([]);
    return () => {};
  }

  try {
    const colRef = collection(db, SHARE_REQUESTS_COLLECTION);
    return onSnapshot(
      colRef,
      (snap) => {
        const list: ConversationShareRequest[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as ConversationShareRequest);
        });
        onUpdate(list);
      },
      (err) => {
        // Fail silently
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

// -------------------------------------------------------------
// FIRESTORE SUPPORT REQUESTS MANAGEMENT
// -------------------------------------------------------------

export async function fetchSupportRequestsFromFirestore(currentUser?: UserAccount | null): Promise<SupportRequest[]> {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous() || !isUserAdminOrHead(currentUser)) {
    return [];
  }
  try {
    const colRef = collection(db, SUPPORT_REQUESTS_COLLECTION);
    const snap = await getDocs(colRef);
    const list: SupportRequest[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as SupportRequest);
    });
    return list;
  } catch (err) {
    return [];
  }
}

export async function saveSupportRequestToFirestore(req: SupportRequest): Promise<void> {
  if (!req.id) return;
  try {
    const docRef = doc(db, SUPPORT_REQUESTS_COLLECTION, req.id);
    const cleanData = sanitizeForFirestore(req);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    // Fail silently
  }
}

export function subscribeToSupportRequests(
  currentUser: UserAccount | null | undefined,
  onUpdate: (requests: SupportRequest[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous() || !isUserAdminOrHead(currentUser)) {
    onUpdate([]);
    return () => {};
  }

  try {
    const colRef = collection(db, SUPPORT_REQUESTS_COLLECTION);
    return onSnapshot(
      colRef,
      (snap) => {
        const list: SupportRequest[] = [];
        snap.forEach((docSnap) => {
          list.push({ id: docSnap.id, ...docSnap.data() } as SupportRequest);
        });
        onUpdate(list);
      },
      (err) => {
        // Fail silently
        if (onError) onError(err);
      }
    );
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

// -------------------------------------------------------------
// FIRESTORE DISCUSSION REPORTS MANAGEMENT
// -------------------------------------------------------------

export async function fetchReportsFromFirestore(currentUser?: UserAccount | null): Promise<DiscussionReport[]> {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous()) {
    return [];
  }
  try {
    if (isUserAdminOrHead(currentUser)) {
      const colRef = collection(db, DISCUSSION_REPORTS_COLLECTION);
      const snap = await getDocs(colRef);
      const list: DiscussionReport[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DiscussionReport);
      });
      return list;
    } else {
      const q = query(
        collection(db, DISCUSSION_REPORTS_COLLECTION),
        where('reporterId', '==', currentUser.id)
      );
      const snap = await getDocs(q);
      const list: DiscussionReport[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as DiscussionReport);
      });
      return list;
    }
  } catch (err) {
    return [];
  }
}

export async function saveReportToFirestore(report: DiscussionReport): Promise<void> {
  if (!report.id) return;
  try {
    const docRef = doc(db, DISCUSSION_REPORTS_COLLECTION, report.id);
    const cleanData = sanitizeForFirestore(report);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    // Fail silently
  }
}

export async function deleteReportFromFirestore(reportId: string): Promise<void> {
  if (!reportId) return;
  try {
    const docRef = doc(db, DISCUSSION_REPORTS_COLLECTION, reportId);
    await deleteDoc(docRef);
  } catch (err) {
    // Fail silently
  }
}

export function subscribeToReports(
  currentUser: UserAccount | null | undefined,
  onUpdate: (reports: DiscussionReport[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous()) {
    onUpdate([]);
    return () => {};
  }

  try {
    if (isUserAdminOrHead(currentUser)) {
      const colRef = collection(db, DISCUSSION_REPORTS_COLLECTION);
      return onSnapshot(
        colRef,
        (snap) => {
          const list: DiscussionReport[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as DiscussionReport);
          });
          onUpdate(list);
        },
        (err) => {
          // Fail silently
          if (onError) onError(err);
        }
      );
    } else {
      const q = query(
        collection(db, DISCUSSION_REPORTS_COLLECTION),
        where('reporterId', '==', currentUser.id)
      );
      return onSnapshot(
        q,
        (snap) => {
          const list: DiscussionReport[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as DiscussionReport);
          });
          onUpdate(list);
        },
        (err) => {
          // Fail silently
          if (onError) onError(err);
        }
      );
    }
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

// -------------------------------------------------------------
// FIRESTORE USER MAILBOX MESSAGES MANAGEMENT
// -------------------------------------------------------------

export async function fetchUserMailboxMessagesFromFirestore(currentUser?: UserAccount | null): Promise<UserMailboxMessage[]> {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous()) {
    return [];
  }
  try {
    if (isUserAdminOrHead(currentUser)) {
      const colRef = collection(db, USER_MAILBOX_MESSAGES_COLLECTION);
      const snap = await getDocs(colRef);
      const list: UserMailboxMessage[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as UserMailboxMessage);
      });
      return list;
    } else {
      const q = query(
        collection(db, USER_MAILBOX_MESSAGES_COLLECTION),
        where('userId', '==', currentUser.id)
      );
      const snap = await getDocs(q);
      const list: UserMailboxMessage[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as UserMailboxMessage);
      });
      return list;
    }
  } catch (err) {
    return [];
  }
}

export async function saveUserMailboxMessageToFirestore(msg: UserMailboxMessage): Promise<void> {
  if (!msg.id) return;
  try {
    const docRef = doc(db, USER_MAILBOX_MESSAGES_COLLECTION, msg.id);
    const cleanData = sanitizeForFirestore(msg);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    // Fail silently
  }
}

export async function deleteUserMailboxMessageFromFirestore(messageId: string): Promise<void> {
  if (!messageId) return;
  try {
    const docRef = doc(db, USER_MAILBOX_MESSAGES_COLLECTION, messageId);
    await deleteDoc(docRef);
  } catch (err) {
    // Fail silently
  }
}

export function subscribeToUserMailboxMessages(
  currentUser: UserAccount | null | undefined,
  onUpdate: (messages: UserMailboxMessage[]) => void,
  onError?: (error: Error) => void
): () => void {
  if (!currentUser?.id || isCurrentFirebaseUserAnonymous()) {
    onUpdate([]);
    return () => {};
  }

  try {
    if (isUserAdminOrHead(currentUser)) {
      const colRef = collection(db, USER_MAILBOX_MESSAGES_COLLECTION);
      return onSnapshot(
        colRef,
        (snap) => {
          const list: UserMailboxMessage[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as UserMailboxMessage);
          });
          onUpdate(list);
        },
        (err) => {
          // Fail silently
          if (onError) onError(err);
        }
      );
    } else {
      const q = query(
        collection(db, USER_MAILBOX_MESSAGES_COLLECTION),
        where('userId', '==', currentUser.id)
      );
      return onSnapshot(
        q,
        (snap) => {
          const list: UserMailboxMessage[] = [];
          snap.forEach((docSnap) => {
            list.push({ id: docSnap.id, ...docSnap.data() } as UserMailboxMessage);
          });
          onUpdate(list);
        },
        (err) => {
          // Fail silently
          if (onError) onError(err);
        }
      );
    }
  } catch (err: any) {
    if (onError) onError(err);
    return () => {};
  }
}

// -------------------------------------------------------------
// FIREBASE AUTHENTICATION HELPERS
// -------------------------------------------------------------

export async function firebaseRegisterUser(
  name: string,
  email: string,
  password: string
): Promise<{ user: UserAccount; firebaseUid: string }> {
  const cleanEmail = email.trim().toLowerCase();
  const trimmedName = name.trim();
  const isTargetAdmin = cleanEmail === 'aymane.habbo@gmail.com' || cleanEmail === 'aymaneoumlala@gmail.com';
  const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
  const newUser: UserAccount = {
    id: cred.user.uid,
    name: trimmedName,
    email: cleanEmail,
    createdAt: nowStr,
    role: isTargetAdmin ? 'admin' : 'user',
    is_administrator: isTargetAdmin,
    is_founder: isTargetAdmin,
  };

  await saveUserToFirestore(newUser);
  return { user: newUser, firebaseUid: cred.user.uid };
}

export async function firebaseSignInUser(
  email: string,
  password: string,
  existingUserAccount?: UserAccount
): Promise<UserAccount> {
  const cleanEmail = email.trim().toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
  
  // Fetch profile from Firestore
  try {
    const docRef = doc(db, USERS_COLLECTION, cred.user.uid);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return { id: snap.id, ...snap.data() } as UserAccount;
    }
  } catch (fetchErr) {
    console.warn('Firestore profile fetch notice:', fetchErr);
  }

  if (existingUserAccount && existingUserAccount.id === cred.user.uid) {
    return existingUserAccount;
  }

  // Fallback to minimal profile if doc does not yet exist
  const isTargetAdmin = cleanEmail === 'aymane.habbo@gmail.com' || cleanEmail === 'aymaneoumlala@gmail.com';
  const userProfile: UserAccount = {
    id: cred.user.uid,
    name: cleanEmail.split('@')[0],
    email: cleanEmail,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    role: isTargetAdmin ? 'admin' : 'user',
    is_administrator: isTargetAdmin,
    is_founder: isTargetAdmin,
  };
  saveUserToFirestore(userProfile).catch(() => {});
  return userProfile;
}

/**
 * Sign in using Google Provider via Firebase Authentication popup
 * Supported out of the box by Firebase project configuration
 */
export async function firebaseSignInWithGoogle(): Promise<UserAccount> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const cred = await signInWithPopup(auth, provider);
  const fbUser = cred.user;
  const cleanEmail = (fbUser.email || '').toLowerCase().trim();
  const isTargetAdmin = cleanEmail === 'aymane.habbo@gmail.com' || cleanEmail === 'aymaneoumlala@gmail.com';

  // 1. Check if document exists under user UID
  const docRef = doc(db, USERS_COLLECTION, fbUser.uid);
  try {
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const existing = { id: snap.id, ...snap.data() } as UserAccount;
      if (isTargetAdmin && (!existing.is_administrator || existing.role !== 'admin')) {
        existing.role = 'admin';
        existing.is_administrator = true;
        existing.is_founder = true;
        await saveUserToFirestore(existing);
      }
      return existing;
    }
  } catch (err) {
    console.warn('Google sign-in profile fetch notice:', err);
  }

  // 2. Create fresh user profile in Firestore
  const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const newUser: UserAccount = {
    id: fbUser.uid,
    name: fbUser.displayName || fbUser.email?.split('@')[0] || 'Member',
    email: cleanEmail,
    avatar: fbUser.photoURL || undefined,
    createdAt: nowStr,
    role: isTargetAdmin ? 'admin' : 'user',
    is_administrator: isTargetAdmin,
    is_founder: isTargetAdmin,
  };

  await saveUserToFirestore(newUser);
  return newUser;
}

export async function firebaseSignOut(): Promise<void> {
  await fbSignOut(auth);
}

export async function firebaseSendPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(auth, email.trim());
}

export function subscribeToAuthState(callback: (user: FirebaseUser | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

/**
 * Signs in the user using Firebase Anonymous Authentication behind the scenes.
 * Completely invisible to the user: no UI, no prompts, returns the real Firebase user with their UID.
 * Reuses existing active anonymous user if already signed in.
 */
export async function ensureAnonymousFirebaseAuth(): Promise<FirebaseUser | null> {
  try {
    if (auth.currentUser) {
      if (auth.currentUser.isAnonymous) {
        return auth.currentUser;
      }
      // If a non-anonymous user is signed in to Firebase Auth, but caller specifically requested anonymous:
      await fbSignOut(auth).catch(() => {});
    }

    const cred = await signInAnonymously(auth);
    if (cred.user?.uid && typeof localStorage !== 'undefined') {
      try {
        localStorage.setItem('3awdli_anon_firebase_uid', cred.user.uid);
      } catch {
        // fallback
      }
    }
    return cred.user;
  } catch (err: any) {
    if (err?.code === 'auth/admin-restricted-operation' || err?.code === 'auth/operation-not-allowed') {
      console.warn(
        '[Firebase Auth] Anonymous sign-in requires enabling the "Anonymous" provider in Firebase Console: ' +
        'https://console.firebase.google.com/project/awdli-real/authentication/providers'
      );
    } else {
      console.warn('[Firebase Auth] Anonymous sign-in notice:', err?.code || err?.message || err);
    }
    return null;
  }
}

/**
 * Returns current Firebase Auth UID if signed in, or null
 */
export function getCurrentFirebaseAuthUid(): string | null {
  return auth.currentUser?.uid || null;
}

/**
 * Returns true if current Firebase Auth user is signed in anonymously
 */
export function isCurrentFirebaseUserAnonymous(): boolean {
  return Boolean(auth.currentUser?.isAnonymous);
}

// -------------------------------------------------------------
// FIRESTORE LOUNGE ARTICLES MANAGEMENT
// -------------------------------------------------------------

export async function fetchLoungeArticlesFromFirestore(): Promise<LoungeArticle[]> {
  try {
    const colRef = collection(db, LOUNGE_ARTICLES_COLLECTION);
    const snap = await getDocs(colRef);
    const list: LoungeArticle[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as LoungeArticle);
    });
    return list;
  } catch (err) {
    console.error('Error fetching lounge articles from Firestore:', err);
    return [];
  }
}

export async function saveLoungeArticleToFirestore(article: LoungeArticle): Promise<void> {
  if (!article.id) return;
  try {
    const docRef = doc(db, LOUNGE_ARTICLES_COLLECTION, article.id);
    const cleanData = sanitizeForFirestore(article);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`Error saving lounge article ${article.id} to Firestore:`, err);
  }
}

export async function deleteLoungeArticleFromFirestore(id: string): Promise<void> {
  if (!id) return;
  try {
    const docRef = doc(db, LOUNGE_ARTICLES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Error deleting lounge article ${id} from Firestore:`, err);
  }
}

export function subscribeToLoungeArticles(
  onArticlesUpdate: (articles: LoungeArticle[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, LOUNGE_ARTICLES_COLLECTION);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: LoungeArticle[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as LoungeArticle);
      });
      onArticlesUpdate(list);
    },
    (err) => {
      console.error('Firestore lounge articles subscription error:', err);
      if (onError) onError(err);
    }
  );
}

// ==========================================
// TEEN SPACE ARTICLES PERSISTENCE & SYNC
// ==========================================

export async function fetchTeenSpaceArticlesFromFirestore(): Promise<TeenSpaceArticle[]> {
  try {
    const colRef = collection(db, TEEN_SPACE_ARTICLES_COLLECTION);
    const snap = await getDocs(colRef);
    const list: TeenSpaceArticle[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as TeenSpaceArticle);
    });
    return list;
  } catch (err) {
    console.error('Error fetching teen space articles from Firestore:', err);
    return [];
  }
}

export async function saveTeenSpaceArticleToFirestore(article: TeenSpaceArticle): Promise<void> {
  try {
    const docRef = doc(db, TEEN_SPACE_ARTICLES_COLLECTION, article.id);
    const cleanData = sanitizeForFirestore(article);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`Error saving teen space article ${article.id} to Firestore:`, err);
  }
}

export async function deleteTeenSpaceArticleFromFirestore(id: string): Promise<void> {
  try {
    const docRef = doc(db, TEEN_SPACE_ARTICLES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Error deleting teen space article ${id} from Firestore:`, err);
  }
}

export function subscribeToTeenSpaceArticles(
  onArticlesUpdate: (articles: TeenSpaceArticle[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, TEEN_SPACE_ARTICLES_COLLECTION);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: TeenSpaceArticle[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as TeenSpaceArticle);
      });
      onArticlesUpdate(list);
    },
    (err) => {
      console.error('Firestore teen space articles subscription error:', err);
      if (onError) onError(err);
    }
  );
}

// ==========================================
// RULES CATEGORIES PERSISTENCE & SYNC
// ==========================================

export async function fetchRulesCategoriesFromFirestore(): Promise<RuleCategory[]> {
  try {
    const colRef = collection(db, RULES_CATEGORIES_COLLECTION);
    const snap = await getDocs(colRef);
    const list: RuleCategory[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as RuleCategory);
    });
    return list;
  } catch (err) {
    console.error('Error fetching rules categories from Firestore:', err);
    return [];
  }
}

export async function saveRuleCategoryToFirestore(category: RuleCategory): Promise<void> {
  if (!category.id) return;
  try {
    const docRef = doc(db, RULES_CATEGORIES_COLLECTION, category.id);
    const cleanData = sanitizeForFirestore(category);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`Error saving rule category ${category.id} to Firestore:`, err);
  }
}

export async function deleteRuleCategoryFromFirestore(id: string): Promise<void> {
  if (!id) return;
  try {
    const docRef = doc(db, RULES_CATEGORIES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Error deleting rule category ${id} from Firestore:`, err);
  }
}

export function subscribeToRulesCategories(
  onUpdate: (categories: RuleCategory[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, RULES_CATEGORIES_COLLECTION);
  return onSnapshot(
    colRef,
    (snap) => {
      const list: RuleCategory[] = [];
      snap.forEach((docSnap) => {
        list.push({ id: docSnap.id, ...docSnap.data() } as RuleCategory);
      });
      onUpdate(list);
    },
    (err) => {
      console.error('Firestore rules categories subscription error:', err);
      if (onError) onError(err);
    }
  );
}



// -------------------------------------------------------------
// FIRESTORE CHAT SCHEDULES MANAGEMENT
// -------------------------------------------------------------

export async function fetchChatSchedulesFromFirestore(): Promise<ChatScheduleWindow[]> {
  try {
    const colRef = collection(db, CHAT_SCHEDULES_COLLECTION);
    const snap = await getDocs(colRef);
    const schedules: ChatScheduleWindow[] = [];
    snap.forEach((docSnap) => {
      if (docSnap.id === 'site_timezone_config') return;
      schedules.push({ id: docSnap.id, ...docSnap.data() } as ChatScheduleWindow);
    });
    return schedules;
  } catch (err) {
    console.error('Error fetching chat schedules from Firestore:', err);
    return [];
  }
}

export async function saveChatScheduleToFirestore(schedule: ChatScheduleWindow): Promise<void> {
  if (!schedule.id) return;
  try {
    const docRef = doc(db, CHAT_SCHEDULES_COLLECTION, schedule.id);
    const cleanData = sanitizeForFirestore(schedule);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`Error saving chat schedule ${schedule.id} to Firestore:`, err);
    throw err;
  }
}

export async function deleteChatScheduleFromFirestore(id: string): Promise<void> {
  if (!id) return;
  try {
    const docRef = doc(db, CHAT_SCHEDULES_COLLECTION, id);
    await deleteDoc(docRef);
  } catch (err) {
    console.error(`Error deleting chat schedule ${id} from Firestore:`, err);
    throw err;
  }
}

export function subscribeToChatSchedules(
  onUpdate: (schedules: ChatScheduleWindow[]) => void,
  onError?: (error: Error) => void
): () => void {
  const colRef = collection(db, CHAT_SCHEDULES_COLLECTION);
  return onSnapshot(
    colRef,
    (snap) => {
      const schedules: ChatScheduleWindow[] = [];
      snap.forEach((docSnap) => {
        if (docSnap.id === 'site_timezone_config') return;
        schedules.push({ id: docSnap.id, ...docSnap.data() } as ChatScheduleWindow);
      });
      onUpdate(schedules);
    },
    (err) => {
      console.error('Firestore chat schedules subscription error:', err);
      if (onError) onError(err);
    }
  );
}

