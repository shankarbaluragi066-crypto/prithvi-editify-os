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

function createGoogleProvider(): GoogleAuthProvider {
  const provider = new GoogleAuthProvider();
  SCOPES.forEach((scope) => provider.addScope(scope));
  provider.setCustomParameters({
    prompt: 'select_account',
  });
  return provider;
}

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

/**
 * Opens the real system/browser Google Account Selector popup via Firebase Auth
 * (`https://photo-poet-4gltc.firebaseapp.com/__/auth/handler` with `prompt: 'select_account'`)
 * so it never triggers a GIS `origin_mismatch` error.
 */
export async function signInWithSystemGooglePopup(): Promise<SystemGoogleUserResult> {
  isSigningIn = true;
  try {
    const provider = createGoogleProvider();
    const result = await signInWithPopup(firebaseAuth, provider);
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
