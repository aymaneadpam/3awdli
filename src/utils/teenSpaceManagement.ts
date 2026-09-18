import { TeenSpaceArticle, UserAccount } from '../types';
import { 
  fetchTeenSpaceArticlesFromFirestore, 
  saveTeenSpaceArticleToFirestore, 
  deleteTeenSpaceArticleFromFirestore, 
  subscribeToTeenSpaceArticles 
} from '../lib/firestoreService';

const TEEN_SPACE_ARTICLES_STORAGE_KEY = '3awdli_teen_space_articles';

/**
 * Default initial articles for Teen Space crafted with empathetic, evidence-informed guidance
 */
function createDefaultTeenArticles(): TeenSpaceArticle[] {
  const now = Date.now();
  return [
    {
      id: 'teen_art_01',
      title: "Navigating Exam Anxiety & Academic Pressure: Why Your Worth Isn't a Grade",
      content: `When exam season arrives, the weight in your chest can feel almost suffocating. We tell ourselves that this test, this semester, or this ranking determines our entire future.

In adolescent psychology, we often see students equate their internal worth with external performance. But a test only measures how well you can recall specific data under artificial time pressure on one single afternoon. It cannot measure your creativity, your empathy, your resilience, or the unique perspective you bring to the world.

When pressure builds:
1. Ground your physiology first: Try the 4-7-8 breathing method. Breathe in quietly through your nose for 4 seconds, hold for 7 seconds, and exhale completely through your mouth making a whoosh sound for 8 seconds.
2. Break large study goals into bite-sized 25-minute sprints followed by genuine 5-minute pauses away from screens.
3. Remember to speak to yourself the way you would speak to your closest friend who is nervous.

You are so much more than any number on a report card.`,
      imageUrl: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&w=1200&q=80',
      authorId: 'user_admin_01',
      authorName: 'Aymane Oumlala',
      authorEmail: 'aymaneoumlala@gmail.com',
      authorProfession: 'Platform Director & Admin',
      authorGender: 'Male',
      createdAt: 'Sep 6, 2026',
      createdAtTimestamp: now - 3 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'teen_art_02',
      title: 'Friendship Shifts in Your Teenage Years: When Growing Up Means Growing Apart',
      content: `Few things hurt quite like realizing you and a friend you used to share everything with don't talk anymore. You might replay past conversations in your head, wondering what you did wrong or why they seem different.

The truth is that between the ages of 13 and 20, our identities, interests, and emotional landscapes undergo massive, rapid shifts. Just like trees branching out in separate directions toward the light, friends often develop distinct values and paces.

Growing apart doesn't mean your shared history wasn't real or meaningful. It simply means that relationship served its season, and you are both continuing to discover who you are.

Give yourself permission to grieve the change without blaming yourself or demonizing them. When you hold space for natural transitions, you make room for new connections that resonate with who you are becoming today.`,
      imageUrl: 'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80',
      authorId: 'user_admin_01',
      authorName: 'Aymane Oumlala',
      authorEmail: 'aymaneoumlala@gmail.com',
      authorProfession: 'Platform Director & Admin',
      authorGender: 'Male',
      createdAt: 'Sep 7, 2026',
      createdAtTimestamp: now - 2 * 24 * 60 * 60 * 1000,
    },
    {
      id: 'teen_art_03',
      title: 'The Overthinking Loop: How to Calm Racing Thoughts at Night',
      content: `The lights are off, your phone is placed face-down, but your mind decides it's the exact right moment to review every awkward conversation from middle school, worry about tomorrow's presentation, and question your friendships.

Psychologists call this nocturnal rumination. During the day, our working memory is occupied by school, conversations, and tasks. At night, sensory inputs vanish, leaving an empty stage for dormant worries to take the spotlight.

A simple 3-step technique to disrupt the loop:
• The Brain Dump: Keep a small paper notebook by your bed. Write down the 3 biggest thoughts circling in your mind. Tell yourself: "They are captured safely on paper. I do not need to hold them until tomorrow morning."
• Sensory Relocation: Name 5 neutral sensations in your body right now (the softness of the pillow, the temperature of your hands, the gentle sound of the room).
• Mental Visualization: Imagine packing your worries into a wooden chest, clicking the brass lock shut, and sliding it under a sturdy shelf until morning.

Sleep is your nervous system's sanctuary. Be gentle with your mind tonight.`,
      imageUrl: 'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
      authorId: 'user_admin_01',
      authorName: 'Aymane Oumlala',
      authorEmail: 'aymaneoumlala@gmail.com',
      authorProfession: 'Platform Director & Admin',
      authorGender: 'Male',
      createdAt: 'Sep 8, 2026',
      createdAtTimestamp: now - 20 * 60 * 60 * 1000,
    },
  ];
}

/**
 * Retrieve all Teen Space articles from local storage (or seed defaults)
 */
export function getStoredTeenSpaceArticles(): TeenSpaceArticle[] {
  try {
    const raw = localStorage.getItem(TEEN_SPACE_ARTICLES_STORAGE_KEY);
    if (!raw) {
      const initial = createDefaultTeenArticles();
      localStorage.setItem(TEEN_SPACE_ARTICLES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    const list: TeenSpaceArticle[] = JSON.parse(raw);
    if (!Array.isArray(list) || list.length === 0) {
      const initial = createDefaultTeenArticles();
      localStorage.setItem(TEEN_SPACE_ARTICLES_STORAGE_KEY, JSON.stringify(initial));
      return initial;
    }
    return list;
  } catch (err) {
    console.error('Failed to load Teen Space articles from storage:', err);
    return createDefaultTeenArticles();
  }
}

/**
 * Save Teen Space articles to local storage and sync
 */
export function saveStoredTeenSpaceArticles(articles: TeenSpaceArticle[]) {
  try {
    localStorage.setItem(TEEN_SPACE_ARTICLES_STORAGE_KEY, JSON.stringify(articles));
    window.dispatchEvent(new Event('3awdli_teen_space_updated'));
    window.dispatchEvent(new Event('storage'));
  } catch (err) {
    console.error('Failed to save Teen Space articles to storage:', err);
  }
}

/**
 * Get all visible public Teen Space articles (excludes hidden)
 */
export function getPublicTeenSpaceArticles(): TeenSpaceArticle[] {
  const all = getStoredTeenSpaceArticles();
  return all
    .filter((a) => !a.is_hidden)
    .sort((a, b) => (b.createdAtTimestamp || 0) - (a.createdAtTimestamp || 0));
}

/**
 * Get all hidden Teen Space articles (Writer / Admin view)
 */
export function getHiddenTeenSpaceArticles(): TeenSpaceArticle[] {
  const all = getStoredTeenSpaceArticles();
  return all
    .filter((a) => Boolean(a.is_hidden))
    .sort((a, b) => (b.hiddenAtTimestamp || b.createdAtTimestamp || 0) - (a.hiddenAtTimestamp || a.createdAtTimestamp || 0));
}

/**
 * Save or update an article in local storage & Firestore
 */
export function saveTeenSpaceArticle(article: TeenSpaceArticle): TeenSpaceArticle {
  const list = getStoredTeenSpaceArticles();
  const index = list.findIndex((a) => a.id === article.id);

  if (index >= 0) {
    list[index] = article;
  } else {
    list.unshift(article);
  }

  saveStoredTeenSpaceArticles(list);
  saveTeenSpaceArticleToFirestore(article).catch((err) => {
    console.error('Failed to sync Teen Space article to Firestore:', err);
  });

  return article;
}

/**
 * Create a new article for Teen Space (Writer only)
 */
export function createTeenSpaceArticle(
  data: {
    title: string;
    content: string;
    imageUrl?: string;
  },
  author: UserAccount
): TeenSpaceArticle {
  const now = Date.now();
  const dateStr = new Date(now).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  const defaultImage = 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80';

  const newArticle: TeenSpaceArticle = {
    id: `teen_art_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
    title: data.title.trim(),
    content: data.content.trim(),
    imageUrl: data.imageUrl?.trim() || defaultImage,
    authorId: author.id,
    authorName: author.name,
    authorEmail: author.email,
    authorProfession: author.profession || 'Psychologist',
    authorGender: author.gender || 'Female',
    createdAt: dateStr,
    createdAtTimestamp: now,
  };

  return saveTeenSpaceArticle(newArticle);
}

/**
 * Update an existing article
 */
export function updateTeenSpaceArticle(
  articleId: string,
  updates: Partial<TeenSpaceArticle>
): TeenSpaceArticle {
  const list = getStoredTeenSpaceArticles();
  const index = list.findIndex((a) => a.id === articleId);
  if (index === -1) {
    throw new Error('Article not found');
  }

  const updated: TeenSpaceArticle = {
    ...list[index],
    ...updates,
    updatedAt: new Date().toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    updatedAtTimestamp: Date.now(),
  };

  list[index] = updated;
  saveStoredTeenSpaceArticles(list);
  saveTeenSpaceArticleToFirestore(updated).catch(() => {});
  return updated;
}

/**
 * Hide an article (soft-delete into Hidden Articles section)
 */
export function hideTeenSpaceArticle(articleId: string, hiddenBy: string): TeenSpaceArticle {
  const now = Date.now();
  return updateTeenSpaceArticle(articleId, {
    is_hidden: true,
    hiddenAt: new Date(now).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }),
    hiddenAtTimestamp: now,
    hiddenBy,
  });
}

/**
 * Republish an article from Hidden Articles back to public Teen Space
 */
export function republishTeenSpaceArticle(articleId: string): TeenSpaceArticle {
  return updateTeenSpaceArticle(articleId, {
    is_hidden: false,
    hiddenAt: undefined,
    hiddenAtTimestamp: undefined,
    hiddenBy: undefined,
  });
}

/**
 * Permanently delete an article from storage and Firestore
 */
export function permanentlyDeleteTeenSpaceArticle(articleId: string): boolean {
  const list = getStoredTeenSpaceArticles();
  const filtered = list.filter((a) => a.id !== articleId);
  saveStoredTeenSpaceArticles(filtered);
  deleteTeenSpaceArticleFromFirestore(articleId).catch(() => {});
  return true;
}

/**
 * Initialize real-time synchronization between Firestore and local storage for Teen Space
 */
export function initFirestoreTeenSpaceArticlesSync(): () => void {
  // Fetch immediately once
  fetchTeenSpaceArticlesFromFirestore().then((remoteArticles) => {
    if (remoteArticles && remoteArticles.length > 0) {
      const local = getStoredTeenSpaceArticles();
      const localMap = new Map(local.map((a) => [a.id, a]));
      let changed = false;

      remoteArticles.forEach((rem) => {
        const loc = localMap.get(rem.id);
        if (!loc || (rem.updatedAtTimestamp || 0) > (loc.updatedAtTimestamp || 0)) {
          localMap.set(rem.id, rem);
          changed = true;
        }
      });

      if (changed) {
        saveStoredTeenSpaceArticles(Array.from(localMap.values()));
      }
    }
  }).catch(() => {});

  // Subscribe to real-time updates
  return subscribeToTeenSpaceArticles(
    (remoteArticles) => {
      if (remoteArticles && remoteArticles.length > 0) {
        const local = getStoredTeenSpaceArticles();
        const localMap = new Map(local.map((a) => [a.id, a]));
        let hasChanges = false;

        remoteArticles.forEach((remoteArt) => {
          const localArt = localMap.get(remoteArt.id);
          if (!localArt || (remoteArt.updatedAtTimestamp || 0) > (localArt.updatedAtTimestamp || 0)) {
            localMap.set(remoteArt.id, remoteArt);
            hasChanges = true;
          }
        });

        if (hasChanges) {
          saveStoredTeenSpaceArticles(Array.from(localMap.values()));
        }
      }
    },
    (err) => {
      console.warn('Teen space articles real-time listener failed gracefully:', err);
    }
  );
}
