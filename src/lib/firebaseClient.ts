import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut as firebaseSignOut,
  User as FirebaseUser,
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);

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

// Holds a popup window opened synchronously during the user click event before any async work
let preOpenedAuthPopupWindow: Window | null = null;

function openSynchronousGooglePopupWindow(): Window | null {
  if (typeof window === 'undefined') return null;
  try {
    if (preOpenedAuthPopupWindow && !preOpenedAuthPopupWindow.closed) {
      preOpenedAuthPopupWindow.focus();
      return preOpenedAuthPopupWindow;
    }
    const width = 500;
    const height = 620;
    const top = Math.max(Math.round((window.screen.availHeight - height) / 2), 0);
    const left = Math.max(Math.round((window.screen.availWidth - width) / 2), 0);
    const features = [
      'location=yes',
      'resizable=yes',
      'statusbar=yes',
      'toolbar=no',
      'scrollbars=yes',
      `width=${width}`,
      `height=${height}`,
      `top=${top}`,
      `left=${left}`,
    ].join(',');

    const win = window.open('about:blank', 'pe_google_account_selector', features);
    if (win) {
      try {
        win.document.open();
        win.document.write(
          '<!doctype html><html><head><meta charset="utf-8"><title>Sign in - Google Accounts</title>' +
            '<style>body{margin:0;height:100vh;display:flex;align-items:center;justify-content:center;background:#081629;color:#F8FAFC;font-family:system-ui,-apple-system,sans-serif;}' +
            '.box{text-align:center;padding:24px;}.spinner{width:36px;height:36px;border:3px solid rgba(255,255,255,0.15);border-top-color:#4285F4;border-radius:50%;animation:s 0.8s linear infinite;margin:0 auto 16px;}' +
            '@keyframes s{to{transform:rotate(360deg)}}</style></head>' +
            '<body><div class="box"><div class="spinner"></div><div style="font-size:14px;font-weight:600;">Opening Google Account Selector...</div>' +
            '<div style="font-size:12px;color:#94A3B8;margin-top:6px;">Connecting to accounts.google.com</div></div></body></html>'
        );
        win.document.close();
      } catch {
        // Ignore cross-origin document write errors if already navigated
      }
      preOpenedAuthPopupWindow = win;
    }
    return win;
  } catch {
    return null;
  }
}

function configureFirebasePopupResolver(): void {
  if (typeof window === 'undefined') return;
  const resolver = (firebaseAuth as any)?._popupRedirectResolver;
  if (!resolver || resolver.__pePatched) return;
  resolver.__pePatched = true;

  // 1. Prevent 3rd-party iframe storage partitioning inside the AI Studio preview iframe
  // from falsely rejecting with `auth/web-storage-unsupported` and closing the popup window.
  resolver._isIframeWebStorageSupported = (_auth: unknown, cb: (supported: boolean) => void) => {
    cb(true);
  };

  // 2. Make `_initialize(auth)` resolve immediately with an AuthEventManager proxy so
  // `PopupOperation.onExecution()` -> `_openPopup()` navigates the popup window to
  // `https://photo-poet-4gltc.firebaseapp.com/__/auth/handler` in <3ms without waiting
  // for `apis.google.com/js/api.js` and `iframe.ping()`. When the real gapi iframe finishes
  // initializing in the background, attach all active popup consumers to the real manager.
  const originalInitAndGetManager =
    typeof resolver.initAndGetManager === 'function'
      ? resolver.initAndGetManager.bind(resolver)
      : null;

  if (originalInitAndGetManager) {
    let realInitInFlight: Promise<any> | null = null;

    const ensureBackgroundRealManager = (auth: any, proxyManager: any): Promise<any> => {
      if (proxyManager.__realManager) {
        return Promise.resolve(proxyManager.__realManager);
      }
      if (!realInitInFlight) {
        realInitInFlight = originalInitAndGetManager(auth)
          .then((realManager: any) => {
            proxyManager.__realManager = realManager;
            proxyManager.consumers.forEach((consumer: any) => {
              try {
                realManager.registerConsumer(consumer);
              } catch {
                // Ignore consumer registration errors
              }
            });
            // Keep our proxy in `eventManagers` so both new and existing consumers stay synced
            if (typeof auth?._key === 'function') {
              resolver.eventManagers[auth._key()] = { manager: proxyManager };
            }
            return realManager;
          })
          .catch((err: unknown) => {
            realInitInFlight = null;
            throw err;
          });
      }
      return realInitInFlight || Promise.resolve(null);
    };

    resolver._initialize = (auth: any) => {
      const key = typeof auth?._key === 'function' ? auth._key() : 'default';
      const existing = resolver.eventManagers?.[key]?.manager;
      if (existing) {
        ensureBackgroundRealManager(auth, existing).catch(() => {});
        return Promise.resolve(existing);
      }

      const proxyManager: any = {
        consumers: new Set<any>(),
        __realManager: null,
        registerConsumer(consumer: any) {
          this.consumers.add(consumer);
          if (this.__realManager) {
            this.__realManager.registerConsumer(consumer);
          }
        },
        unregisterConsumer(consumer: any) {
          this.consumers.delete(consumer);
          if (this.__realManager) {
            this.__realManager.unregisterConsumer(consumer);
          }
        },
        onEvent(event: any) {
          if (this.__realManager) {
            return this.__realManager.onEvent(event);
          }
          let handled = false;
          this.consumers.forEach((consumer: any) => {
            const eventIdMatches =
              consumer.eventId === null ||
              (Boolean(event?.eventId) && event.eventId === consumer.eventId);
            if (Array.isArray(consumer.filter) && consumer.filter.includes(event?.type) && eventIdMatches) {
              handled = true;
              consumer.onAuthEvent(event);
            }
          });
          return handled;
        },
      };

      if (!resolver.eventManagers) {
        resolver.eventManagers = {};
      }
      resolver.eventManagers[key] = { manager: proxyManager };
      ensureBackgroundRealManager(auth, proxyManager).catch(() => {});
      return Promise.resolve(proxyManager);
    };
  }

  // 3. Reuse the popup window that was opened synchronously on user click so the browser
  // never blocks `window.open` and navigates immediately to accounts.google.com.
  const originalOpenPopup = resolver._openPopup.bind(resolver);
  resolver._openPopup = async (auth: any, provider: any, authType: any, eventId: any) => {
    if (preOpenedAuthPopupWindow && !preOpenedAuthPopupWindow.closed) {
      const targetWin = preOpenedAuthPopupWindow;
      preOpenedAuthPopupWindow = null;
      const origWindowOpen = window.open;
      window.open = ((url?: string | URL) => {
        if (url) {
          try {
            targetWin.location.replace(String(url));
          } catch {
            targetWin.location.href = String(url);
          }
        }
        try {
          targetWin.focus();
        } catch {
          // Ignore focus errors
        }
        return targetWin;
      }) as typeof window.open;
      try {
        return await originalOpenPopup(auth, provider, authType, eventId);
      } finally {
        window.open = origWindowOpen;
      }
    }
    return await originalOpenPopup(auth, provider, authType, eventId);
  };

  // 4. Proactively initialize the Firebase Auth gapi iframe on app boot
  if (typeof resolver._initialize === 'function') {
    resolver._initialize(firebaseAuth).catch(() => {});
  }
}

configureFirebasePopupResolver();

// In-memory cache for Google OAuth access token (never stored in localStorage/sessionStorage)
let isSigningIn = false;
let cachedAccessToken: string | null = null;

export const initFirebaseGoogleAuth = (
  onAuthSuccess?: (user: FirebaseUser, token: string) => void,
  onAuthFailure?: () => void
) => {
  configureFirebasePopupResolver();
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
  throw new Error(JSON.stringify(errInfo));
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

/**
 * Opens the real system/browser Google Account Selector popup via Firebase Auth
 * (`https://photo-poet-4gltc.firebaseapp.com/__/auth/handler` with `prompt: 'select_account'`).
 * Opens the popup window synchronously on the first line of the click handler so browser
 * popup blockers never block it while Firebase Auth initializes its communication iframe.
 */
export async function signInWithSystemGooglePopup(): Promise<SystemGoogleUserResult> {
  configureFirebasePopupResolver();
  // Open popup window SYNCHRONOUSLY during the user click event (before any await)
  const syncWin = openSynchronousGooglePopupWindow();

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
  } catch (err) {
    if (syncWin && !syncWin.closed && preOpenedAuthPopupWindow === syncWin) {
      try {
        syncWin.close();
      } catch {
        // Ignore close errors
      }
      preOpenedAuthPopupWindow = null;
    }
    throw err;
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
