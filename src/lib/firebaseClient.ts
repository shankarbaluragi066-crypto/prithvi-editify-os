import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const rawConfig = firebaseConfig as Record<string, string | undefined>;

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const firestoreDb = rawConfig.firestoreDatabaseId
  ? getFirestore(app, rawConfig.firestoreDatabaseId)
  : getFirestore(app);

export const SCOPES = [
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
];

const googleProvider = new GoogleAuthProvider();
SCOPES.forEach((scope) => googleProvider.addScope(scope));
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

// In-memory cache for Google OAuth access token (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initFirebaseGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(firebaseAuth, async (user: FirebaseUser | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        cachedAccessToken = null;
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const getAccessToken = async (): Promise<string | null> => {
  return cachedAccessToken;
};

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: firebaseAuth.currentUser?.uid,
      email: firebaseAuth.currentUser?.email,
      emailVerified: firebaseAuth.currentUser?.emailVerified,
      isAnonymous: firebaseAuth.currentUser?.isAnonymous,
      tenantId: firebaseAuth.currentUser?.tenantId,
      providerInfo:
        firebaseAuth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testFirestoreConnection(): Promise<void> {
  if (!rawConfig.firestoreDatabaseId) return;
  try {
    await getDocFromServer(doc(firestoreDb, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

testFirestoreConnection();

// Preload Google Identity Services (GIS) client in browser for 1P OAuth popup support
let gisScriptPromise: Promise<void> | null = null;
export function ensureGoogleIdentityServicesLoaded(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve();
  if ((window as any).google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (gisScriptPromise) return gisScriptPromise;

  gisScriptPromise = new Promise<void>((resolve) => {
    const existing = document.querySelector('script[src="https://accounts.google.com/gsi/client"]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => resolve());
      setTimeout(() => resolve(), 1500);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });

  return gisScriptPromise;
}

if (typeof window !== 'undefined') {
  ensureGoogleIdentityServicesLoaded();
}

export interface SystemGoogleUserResult {
  uid: string;
  email: string;
  displayName: string | null;
  photoURL?: string | null;
  accessToken?: string | null;
}

async function fetchGoogleUserInfoFromToken(
  accessToken: string
): Promise<{ sub?: string; email?: string; name?: string; picture?: string } | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function signInWithGisTokenPopup(): Promise<SystemGoogleUserResult> {
  return new Promise((resolve, reject) => {
    const googleObj = typeof window !== 'undefined' ? (window as any).google : null;
    const clientId = rawConfig.oAuthClientId;
    if (!googleObj?.accounts?.oauth2 || !clientId) {
      reject(new Error('Google Identity Services not initialized.'));
      return;
    }

    try {
      const tokenClient = googleObj.accounts.oauth2.initTokenClient({
        client_id: clientId,
        scope: SCOPES.join(' '),
        prompt: 'select_account',
        callback: async (response: any) => {
          if (response?.error) {
            reject(new Error(response.error_description || response.error));
            return;
          }
          const token = response?.access_token;
          if (!token) {
            reject(new Error('No access token returned from Google.'));
            return;
          }
          cachedAccessToken = token;
          const info = await fetchGoogleUserInfoFromToken(token);
          if (!info?.email) {
            reject(new Error('Unable to read Google account email address.'));
            return;
          }
          resolve({
            uid: info.sub || info.email,
            email: info.email,
            displayName: info.name || info.email.split('@')[0],
            photoURL: info.picture || null,
            accessToken: token,
          });
        },
        error_callback: (err: any) => {
          reject(new Error(err?.message || err?.type || 'Google popup closed.'));
        },
      });
      tokenClient.requestAccessToken({ prompt: 'select_account' });
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Opens the real system/browser Google Account Selector popup (accounts.google.com)
 * with `prompt: 'select_account'` so the user can pick any Google account logged
 * into their browser/system.
 */
export async function signInWithSystemGooglePopup(): Promise<SystemGoogleUserResult> {
  isSigningIn = true;
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    const token = credential?.accessToken || null;
    if (token) {
      cachedAccessToken = token;
    }

    let resolvedEmail = result.user.email || '';
    let resolvedName = result.user.displayName || null;
    let resolvedPhoto = result.user.photoURL || null;

    if ((!resolvedEmail || !resolvedName) && token) {
      const info = await fetchGoogleUserInfoFromToken(token);
      if (info?.email && !resolvedEmail) resolvedEmail = info.email;
      if (info?.name && !resolvedName) resolvedName = info.name;
      if (info?.picture && !resolvedPhoto) resolvedPhoto = info.picture;
    }

    return {
      uid: result.user.uid,
      email: resolvedEmail,
      displayName: resolvedName,
      photoURL: resolvedPhoto,
      accessToken: token,
    };
  } catch (firebaseErr: any) {
    const code = String(firebaseErr?.code || '');
    const msg = String(firebaseErr?.message || '');
    if (
      code === 'auth/popup-closed-by-user' ||
      code === 'auth/cancelled-popup-request' ||
      msg.toLowerCase().includes('popup-closed-by-user')
    ) {
      throw firebaseErr;
    }
    // Secondary fallback to Google Identity Services OAuth2 popup if available
    if (typeof window !== 'undefined' && (window as any).google?.accounts?.oauth2) {
      return await signInWithGisTokenPopup();
    }
    throw firebaseErr;
  } finally {
    isSigningIn = false;
  }
}

export async function signOutFromFirebase(): Promise<void> {
  cachedAccessToken = null;
  try {
    await firebaseSignOut(firebaseAuth);
  } catch {
    // Ignore sign-out errors
  }
}
