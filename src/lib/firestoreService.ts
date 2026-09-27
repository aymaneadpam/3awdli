import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch
} from 'firebase/firestore';
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { db, auth } from './firebase';
import { 
  UserAccount, 
  DiscussionConversation, 
  ConversationShareRequest, 
  SupportRequest,
  LoungeArticle,
  TeenSpaceArticle,
  RuleCategory,
  ChatScheduleWindow
} from '../types';

// Collection references
export const USERS_COLLECTION = 'users';
export const DISCUSSIONS_COLLECTION = 'discussions';
export const SHARE_REQUESTS_COLLECTION = 'share_requests';
export const SUPPORT_REQUESTS_COLLECTION = 'support_requests';
export const LOUNGE_ARTICLES_COLLECTION = 'lounge_articles';
export const TEEN_SPACE_ARTICLES_COLLECTION = 'teen_space_articles';
export const RULES_CATEGORIES_COLLECTION = 'rules_categories';
export const CHAT_SCHEDULES_COLLECTION = 'chat_schedules';

// Helper to remove undefined fields before sending to Firestore
export function sanitizeForFirestore<T extends Record<string, any>>(obj: T): T {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
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

export async function fetchUsersFromFirestore(): Promise<UserAccount[]> {
  try {
    const colRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(colRef);
    const users: UserAccount[] = [];
    snap.forEach((docSnap) => {
      users.push({ id: docSnap.id, ...docSnap.data() } as UserAccount);
    });
    return users;
  } catch (err) {
    console.error('Error fetching users from Firestore:', err);
    return [];
  }
}

export async function saveUserToFirestore(user: UserAccount & { password?: string }): Promise<void> {
  if (!user.id) return;
  try {
    const docRef = doc(db, USERS_COLLECTION, user.id);
    const cleanData = sanitizeForFirestore(user);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error(`Error saving user ${user.id} to Firestore:`, err);
  }
}

export function subscribeToUsers(
  onUsersUpdate: (users: UserAccount[]) => void,
  onError?: (error: Error) => void
): () => void {
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
      console.error('Firestore users subscription error:', err);
      if (onError) onError(err);
    }
  );
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

export async function fetchShareRequestsFromFirestore(): Promise<ConversationShareRequest[]> {
  try {
    const colRef = collection(db, SHARE_REQUESTS_COLLECTION);
    const snap = await getDocs(colRef);
    const list: ConversationShareRequest[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as ConversationShareRequest);
    });
    return list;
  } catch (err) {
    console.error('Error fetching share requests from Firestore:', err);
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
    console.error(`Error saving share request ${request.id} to Firestore:`, err);
  }
}

export function subscribeToShareRequests(
  onUpdate: (requests: ConversationShareRequest[]) => void,
  onError?: (error: Error) => void
): () => void {
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
      console.error('Firestore share requests subscription error:', err);
      if (onError) onError(err);
    }
  );
}

// -------------------------------------------------------------
// FIRESTORE SUPPORT REQUESTS MANAGEMENT
// -------------------------------------------------------------

export async function fetchSupportRequestsFromFirestore(): Promise<SupportRequest[]> {
  try {
    const colRef = collection(db, SUPPORT_REQUESTS_COLLECTION);
    const snap = await getDocs(colRef);
    const list: SupportRequest[] = [];
    snap.forEach((docSnap) => {
      list.push({ id: docSnap.id, ...docSnap.data() } as SupportRequest);
    });
    return list;
  } catch (err) {
    console.error('Error fetching support requests from Firestore:', err);
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
    console.error(`Error saving support request ${req.id} to Firestore:`, err);
  }
}

export function subscribeToSupportRequests(
  onUpdate: (requests: SupportRequest[]) => void,
  onError?: (error: Error) => void
): () => void {
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
      console.error('Firestore support requests subscription error:', err);
      if (onError) onError(err);
    }
  );
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
  const isTargetAdmin = cleanEmail === 'aymaneoumlala@gmail.com';
  const nowStr = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  try {
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

    await saveUserToFirestore({ ...newUser, password });
    return { user: newUser, firebaseUid: cred.user.uid };
  } catch (err: any) {
    // If Email/Password provider is disabled in Firebase Console (auth/operation-not-allowed)
    if (err.code === 'auth/operation-not-allowed') {
      console.warn('Firebase Email/Password is not enabled in Firebase Console. Registering directly in Firestore.');
      const generatedUid = `user_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const newUser: UserAccount = {
        id: generatedUid,
        name: trimmedName,
        email: cleanEmail,
        createdAt: nowStr,
        role: isTargetAdmin ? 'admin' : 'user',
        is_administrator: isTargetAdmin,
        is_founder: isTargetAdmin,
      };

      await saveUserToFirestore({ ...newUser, password });
      return { user: newUser, firebaseUid: generatedUid };
    }
    throw err;
  }
}

export async function firebaseSignInUser(
  email: string,
  password: string,
  existingUserAccount?: UserAccount
): Promise<UserAccount> {
  const cleanEmail = email.trim().toLowerCase();
  
  try {
    const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
    // Fetch profile from Firestore
    try {
      const docRef = doc(db, USERS_COLLECTION, cred.user.uid);
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        return { id: snap.id, ...snap.data() } as UserAccount;
      }
    } catch (fetchErr) {
      console.warn('Firestore profile fetch warning:', fetchErr);
    }
    if (existingUserAccount) return existingUserAccount;
  } catch (err: any) {
    // If Firebase Auth throws operation-not-allowed, invalid-credential, or network errors,
    // verify securely against Firestore database & local user records.
    if (
      err.code === 'auth/operation-not-allowed' || 
      err.code === 'auth/network-request-failed' ||
      err.message?.includes('operation-not-allowed') ||
      err.code === 'auth/invalid-credential' ||
      err.code === 'auth/wrong-password' ||
      err.code === 'auth/user-not-found'
    ) {
      let matched: any = null;
      try {
        const allFirestoreUsers = await fetchUsersFromFirestore();
        matched = allFirestoreUsers.find(u => u.email?.trim().toLowerCase() === cleanEmail);
      } catch (firestoreErr) {
        console.warn('Could not read from Firestore, checking local storage:', firestoreErr);
      }

      if (!matched) {
        try {
          const raw = localStorage.getItem('3awdli_users');
          if (raw) {
            const parsed = JSON.parse(raw);
            if (Array.isArray(parsed)) {
              matched = parsed.find((u: any) => u.email?.trim().toLowerCase() === cleanEmail);
            }
          }
        } catch (storageErr) {
          console.warn('Local storage user check error:', storageErr);
        }
      }
      
      if (!matched && existingUserAccount) {
        matched = existingUserAccount;
      }

      if (!matched) {
        const notFoundErr = new Error('No account was found with this email in the database. Please sign up or continue with Google.');
        (notFoundErr as any).code = 'auth/user-not-found';
        throw notFoundErr;
      }

      // STRICT PASSWORD CHECK: Verify entered password against the stored password
      const storedWithPass = matched as UserAccount & { password?: string };
      const storedPassword = storedWithPass.password;

      if (!storedPassword) {
        const noPassErr = new Error('This account does not have a password set. Please sign in with Google or use "Forgot password" to set one.');
        (noPassErr as any).code = 'auth/no-password-set';
        throw noPassErr;
      }

      if (storedPassword !== password) {
        const passError = new Error('The password entered does not match our records.');
        (passError as any).code = 'auth/wrong-password';
        throw passError;
      }

      // Password matches!
      return matched as UserAccount;
    }

    throw err;
  }

  if (existingUserAccount) {
    return existingUserAccount;
  }

  throw new Error('User profile could not be loaded from database.');
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
  const isTargetAdmin = cleanEmail === 'aymaneoumlala@gmail.com';

  // 1. Check if document exists under user UID
  const docRef = doc(db, USERS_COLLECTION, fbUser.uid);
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

  // 2. Check if a pre-existing profile exists by email
  const allUsers = await fetchUsersFromFirestore();
  const existingByEmail = allUsers.find(u => u.email?.toLowerCase() === cleanEmail);
  if (existingByEmail) {
    const merged: UserAccount = {
      ...existingByEmail,
      id: fbUser.uid,
      name: existingByEmail.name || fbUser.displayName || 'Member',
      avatar: fbUser.photoURL || existingByEmail.avatar,
    };
    if (isTargetAdmin) {
      merged.role = 'admin';
      merged.is_administrator = true;
      merged.is_founder = true;
    }
    await saveUserToFirestore(merged);
    return merged;
  }

  // 3. Create fresh user profile in Firestore
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
// FIRESTORE PASSWORD RESET TOKENS MANAGEMENT
// -------------------------------------------------------------
export const PASSWORD_RESET_TOKENS_COLLECTION = 'password_reset_tokens';

export interface FirestoreResetToken {
  token: string;
  email: string;
  createdAt: number;
  expiresAt: number;
  used: boolean;
  usedAt?: number;
}

export async function saveResetTokenToFirestore(record: FirestoreResetToken): Promise<void> {
  if (!record.token) return;
  try {
    const docRef = doc(db, PASSWORD_RESET_TOKENS_COLLECTION, record.token.trim());
    const cleanData = sanitizeForFirestore(record);
    await setDoc(docRef, cleanData, { merge: true });
  } catch (err) {
    console.error('Error saving reset token to Firestore:', err);
  }
}

export async function getResetTokenFromFirestore(token: string): Promise<FirestoreResetToken | null> {
  if (!token) return null;
  try {
    const docRef = doc(db, PASSWORD_RESET_TOKENS_COLLECTION, token.trim());
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;
    return snap.data() as FirestoreResetToken;
  } catch (err) {
    console.error('Error fetching reset token from Firestore:', err);
    return null;
  }
}

export async function markResetTokenUsedInFirestore(token: string): Promise<boolean> {
  if (!token) return false;
  try {
    const docRef = doc(db, PASSWORD_RESET_TOKENS_COLLECTION, token.trim());
    await updateDoc(docRef, {
      used: true,
      usedAt: Date.now(),
    });
    return true;
  } catch (err) {
    console.error('Error marking reset token used in Firestore:', err);
    return false;
  }
}

/**
 * Overwrite and invalidate the previous password for all Firestore documents
 * matching an email address. Ensures that the old password cannot authenticate.
 */
export async function updateUserPasswordInFirestore(
  email: string,
  newPassword: string
): Promise<{ success: boolean; updatedCount: number }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !newPassword) {
    return { success: false, updatedCount: 0 };
  }

  try {
    const colRef = collection(db, USERS_COLLECTION);
    const snap = await getDocs(colRef);
    let count = 0;
    const nowIso = new Date().toISOString();

    const updatePromises: Promise<any>[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.email && data.email.trim().toLowerCase() === cleanEmail) {
        count++;
        updatePromises.push(
          setDoc(docSnap.ref, {
            ...data,
            password: newPassword,
            updatedAt: nowIso,
            passwordChangedAt: nowIso,
          }, { merge: true }).catch(async (err) => {
            console.warn(`Error updating password on doc ${docSnap.id}:`, err);
          })
        );
      }
    });

    await Promise.all(updatePromises);

    // If no document existed in Firestore, create one so the new password is firmly saved
    if (count === 0) {
      const isTargetAdmin = cleanEmail === 'aymane.habbo@gmail.com' || cleanEmail === 'aymaneoumlala@gmail.com';
      const newDocRef = doc(collection(db, USERS_COLLECTION));
      await setDoc(newDocRef, {
        id: newDocRef.id,
        email: cleanEmail,
        name: cleanEmail.split('@')[0],
        password: newPassword,
        role: isTargetAdmin ? 'admin' : 'user',
        is_administrator: isTargetAdmin,
        is_founder: isTargetAdmin,
        createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        passwordChangedAt: nowIso,
        updatedAt: nowIso,
      });
      count = 1;
    }

    console.log(`[Firestore] Overwrote password for ${cleanEmail} across ${count} document(s)`);
    return { success: true, updatedCount: count };
  } catch (err) {
    console.error('Error updating user password in Firestore:', err);
    return { success: false, updatedCount: 0 };
  }
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

