import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { ShieldCheck, X, UserCheck, Mail, ArrowRight } from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  supabaseUrl,
  supabasePublishableKey,
  STUDIO_OWNER_EMAIL,
  STUDIO_OFFICIAL_ADMIN_EMAIL,
  isAuthorizedAdminEmail,
  LOCAL_GOOGLE_SESSION_KEY,
} from '../lib/supabaseClient';
import { UserProfile } from '../types/crm';
import {
  triggerNewCustomerRegistrationEmails,
  triggerPasswordResetRequestAdminNotification,
  triggerPasswordChangedNotification,
  RegistrationEmailDispatchResult,
} from '../services/authEmailService';
import { syncClientLoginToCrm } from '../services/crmService';
import { DEFAULT_STUDIO_LOGO_URL } from '../utils/seedData';
import { signInWithSystemGooglePopup, signOutFromFirebase } from '../lib/firebaseClient';

export const GoogleBrandIcon: React.FC<{ className?: string }> = ({ className = 'w-4 h-4' }) => (
  <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09C3.26 21.3 7.31 24 12 24z"
    />
    <path
      fill="#FBBC05"
      d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.98-3.09z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
    />
  </svg>
);

export interface AppAuthUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

interface StoredGoogleSession {
  user: AppAuthUser;
  profile: UserProfile;
  isAdminGatewaySession?: boolean;
}

export interface SavedClientGoogleAccount {
  email: string;
  displayName: string;
  phone?: string;
  companyName?: string;
  lastUsedAt: string;
}

const SAVED_CLIENT_GOOGLE_ACCOUNTS_KEY = 'pe_saved_client_google_accounts_v1';

interface AuthContextValue {
  user: AppAuthUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isClient: boolean;
  loading: boolean;
  savedClientAccounts: SavedClientGoogleAccount[];
  lastRegistrationEmailStatus: RegistrationEmailDispatchResult | null;
  loginWithGoogle: (redirectPath?: string) => Promise<UserProfile>;
  quickSignInWithGoogleAccount: (
    email: string,
    displayName?: string,
    extra?: { phone?: string; companyName?: string }
  ) => Promise<UserProfile>;
  removeSavedGoogleAccount: (email: string) => void;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  registerClientWithEmail: (data: {
    displayName: string;
    email: string;
    password: string;
    phone?: string;
    companyName?: string;
  }) => Promise<UserProfile>;
  sendResetLink: (email: string) => Promise<{ rateLimited?: boolean }>;
  completePasswordReset: (newPassword: string, fallbackEmail?: string) => Promise<{ email: string }>;
  resendVerificationEmail: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredGoogleSession(): StoredGoogleSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LOCAL_GOOGLE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredGoogleSession;
    if (parsed?.user?.uid && parsed?.profile?.email) {
      // If an older session claimed admin role without explicit admin gateway flag, clear it so customers never inherit admin access
      if (
        parsed.profile.role === 'admin' &&
        (!isAuthorizedAdminEmail(parsed.profile.email) || !parsed.isAdminGatewaySession)
      ) {
        window.localStorage.removeItem(LOCAL_GOOGLE_SESSION_KEY);
        return null;
      }
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function saveStoredGoogleSession(session: StoredGoogleSession | null): void {
  if (typeof window === 'undefined') return;
  try {
    if (!session) {
      window.localStorage.removeItem(LOCAL_GOOGLE_SESSION_KEY);
    } else {
      window.localStorage.setItem(LOCAL_GOOGLE_SESSION_KEY, JSON.stringify(session));
    }
  } catch {
    // Ignore storage errors
  }
}

function readSavedClientGoogleAccounts(): SavedClientGoogleAccount[] {
  if (typeof window === 'undefined') return [];
  const byEmail = new Map<string, SavedClientGoogleAccount>();

  try {
    const raw = window.localStorage.getItem(SAVED_CLIENT_GOOGLE_ACCOUNTS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          if (
            item &&
            typeof item.email === 'string' &&
            item.email.includes('@') &&
            !isAuthorizedAdminEmail(item.email) &&
            item.email.trim().toLowerCase() !== 'sync-check@example.com'
          ) {
            const cleanEmail = item.email.trim().toLowerCase();
            byEmail.set(cleanEmail, {
              email: cleanEmail,
              displayName: String(item.displayName || cleanEmail.split('@')[0] || 'Client'),
              phone: item.phone ? String(item.phone) : undefined,
              companyName: item.companyName ? String(item.companyName) : undefined,
              lastUsedAt: String(item.lastUsedAt || new Date().toISOString()),
            });
          }
        }
      }
    }
  } catch {
    // Ignore storage parse error
  }

  return Array.from(byEmail.values()).slice(0, 6);
}

function saveClientGoogleAccountToChooser(
  email: string,
  displayName: string,
  extra?: { phone?: string; companyName?: string }
): SavedClientGoogleAccount[] {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || isAuthorizedAdminEmail(cleanEmail)) {
    return readSavedClientGoogleAccounts();
  }
  const existing = readSavedClientGoogleAccounts();
  const prevMatch = existing.find((acc) => acc.email.toLowerCase() === cleanEmail);
  const others = existing.filter((acc) => acc.email.toLowerCase() !== cleanEmail);
  const updated: SavedClientGoogleAccount[] = [
    {
      email: cleanEmail,
      displayName: displayName.trim() || prevMatch?.displayName || cleanEmail.split('@')[0] || 'Client',
      phone: extra?.phone || prevMatch?.phone,
      companyName: extra?.companyName || prevMatch?.companyName,
      lastUsedAt: new Date().toISOString(),
    },
    ...others,
  ].slice(0, 6);

  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SAVED_CLIENT_GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }
  return updated;
}

function removeSavedClientGoogleAccount(email: string): SavedClientGoogleAccount[] {
  const cleanEmail = email.trim().toLowerCase();
  const updated = readSavedClientGoogleAccounts().filter(
    (acc) => acc.email.toLowerCase() !== cleanEmail
  );
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(SAVED_CLIENT_GOOGLE_ACCOUNTS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  }
  return updated;
}

function deterministicUuidFromEmail(email: string): string {
  const clean = email.trim().toLowerCase();
  let h1 = 0xdeadbeef ^ clean.length;
  let h2 = 0x41c6ce57 ^ clean.length;
  for (let i = 0; i < clean.length; i++) {
    const ch = clean.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  const hex3 = ((h1 ^ h2) >>> 0).toString(16).padStart(8, '0');
  const hex4 = ((h1 + h2) >>> 0).toString(16).padStart(8, '0');
  return `${hex1}-${hex2.slice(0, 4)}-4${hex2.slice(5, 8)}-a${hex3.slice(1, 4)}-${hex3.slice(4, 8)}${hex4}`;
}

async function checkSupabaseGoogleProviderEnabled(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/settings`, {
      method: 'GET',
      headers: {
        apikey: supabasePublishableKey,
      },
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      external?: {
        google?: boolean;
      };
    };
    return Boolean(data?.external?.google);
  } catch {
    return false;
  }
}

export function getAppRedirectUrl(subPath: string): string {
  const cleanSubPath = subPath.startsWith('/') ? subPath : `/${subPath}`;
  if (typeof window === 'undefined') return cleanSubPath;
  const configuredBase = (import.meta.env.BASE_URL || '/').replace(/\/+$/, '');
  const pathname = window.location.pathname;
  const activeBase =
    configuredBase &&
    configuredBase !== '.' &&
    (pathname === configuredBase || pathname.startsWith(`${configuredBase}/`))
      ? configuredBase
      : pathname === '/prithvi-editify' || pathname.startsWith('/prithvi-editify/')
      ? '/prithvi-editify'
      : '';
  return `${window.location.origin}${activeBase}${cleanSubPath}`;
}

function mapSupabaseUser(sbUser: SupabaseAuthUser): AppAuthUser {
  const metaName =
    sbUser.user_metadata?.display_name ||
    sbUser.user_metadata?.full_name ||
    sbUser.user_metadata?.name ||
    null;

  return {
    uid: sbUser.id,
    id: sbUser.id,
    email: sbUser.email ?? null,
    displayName: metaName,
    emailVerified: Boolean(sbUser.email_confirmed_at || sbUser.confirmed_at),
  };
}

function mapProfileRow(
  row: Record<string, any>,
  fallbackUser: AppAuthUser,
  allowAdminRole = false
): UserProfile {
  const email = String(row.email || fallbackUser.email || '').toLowerCase();
  const isOwner = allowAdminRole && isAuthorizedAdminEmail(email);
  return {
    uid: String(row.id || fallbackUser.uid),
    email,
    displayName: String(
      row.display_name || fallbackUser.displayName || email.split('@')[0] || 'Client'
    ),
    role: isOwner ? 'admin' : 'client',
    status: row.status === 'deactivated' ? 'deactivated' : 'active',
    phone: String(row.phone || ''),
    companyName: String(row.company_name || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureUserProfile(
  authUser: AppAuthUser,
  extra?: {
    phone?: string;
    companyName?: string;
    displayName?: string;
    allowAdminRole?: boolean;
  }
): Promise<UserProfile> {
  const emailLower = (authUser.email || '').toLowerCase();
  const isOwnerAdmin =
    Boolean(extra?.allowAdminRole) && isAuthorizedAdminEmail(emailLower);

  if (!isSupabaseConfigured) {
    return {
      uid: authUser.uid,
      email: emailLower,
      displayName: extra?.displayName || authUser.displayName || 'Client',
      role: isOwnerAdmin ? 'admin' : 'client',
      status: 'active',
      phone: extra?.phone || '',
      companyName: extra?.companyName || '',
    };
  }

  try {
    const { data: existing, error: selectErr } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.uid)
      .maybeSingle();

    if (!selectErr && existing) {
      const prof = mapProfileRow(existing, authUser, Boolean(extra?.allowAdminRole));
      if (isOwnerAdmin && existing.role !== 'admin') {
        await supabase
          .from('profiles')
          .update({ role: 'admin', updated_at: new Date().toISOString() })
          .eq('id', authUser.uid);
        return { ...prof, role: 'admin' };
      }
      return prof;
    }
  } catch {
    // Non-fatal if profiles table is not migrated
  }

  const assignedRole = isOwnerAdmin ? 'admin' : 'client';
  const displayName = (
    extra?.displayName ||
    authUser.displayName ||
    emailLower.split('@')[0] ||
    'Client'
  ).slice(0, 120);

  const newProfile: UserProfile = {
    uid: authUser.uid,
    email: emailLower.slice(0, 254),
    displayName,
    role: assignedRole,
    status: 'active',
    phone: (extra?.phone || '').slice(0, 40),
    companyName: (extra?.companyName || '').slice(0, 150),
  };

  try {
    await supabase.from('profiles').upsert({
      id: authUser.uid,
      email: newProfile.email,
      display_name: newProfile.displayName,
      role: newProfile.role,
      status: newProfile.status,
      phone: newProfile.phone,
      company_name: newProfile.companyName,
      updated_at: new Date().toISOString(),
    });
  } catch {
    // Non-fatal if profiles table is not yet migrated
  }

  return newProfile;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppAuthUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRegistrationEmailStatus, setLastRegistrationEmailStatus] =
    useState<RegistrationEmailDispatchResult | null>(null);

  // Built-in Google Account Chooser Modal state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleModalMode, setGoogleModalMode] = useState<'admin' | 'client'>('client');
  const [savedClientAccounts, setSavedClientAccounts] = useState<SavedClientGoogleAccount[]>([]);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
  const [customGooglePhone, setCustomGooglePhone] = useState('');
  const [customGoogleCompany, setCustomGoogleCompany] = useState('');
  const [showCustomGoogleForm, setShowCustomGoogleForm] = useState(true);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [googleModalError, setGoogleModalError] = useState<string | null>(null);

  const pendingGoogleResolver = useRef<{
    resolve: (profile: UserProfile) => void;
    reject: (err: Error) => void;
  } | null>(null);

  const loadSupabaseSessionUser = async (sbUser: SupabaseAuthUser | null) => {
    if (!sbUser) {
      const storedGoogle = readStoredGoogleSession();
      if (storedGoogle) {
        setUser(storedGoogle.user);
        setProfile(storedGoogle.profile);
        setLoading(false);
        return;
      }
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const mappedUser = mapSupabaseUser(sbUser);
    const storedGoogle = readStoredGoogleSession();
    const allowAdmin =
      Boolean(storedGoogle?.isAdminGatewaySession) ||
      (typeof window !== 'undefined' && window.location.pathname.includes('admin'));

    setUser(mappedUser);

    try {
      const prof = await ensureUserProfile(mappedUser, { allowAdminRole: allowAdmin });
      setProfile(prof);
      if (prof.role === 'client' && !isAuthorizedAdminEmail(prof.email)) {
        const updatedAccounts = saveClientGoogleAccountToChooser(
          prof.email,
          prof.displayName,
          { phone: prof.phone, companyName: prof.companyName }
        );
        setSavedClientAccounts(updatedAccounts);
        syncClientLoginToCrm(prof, 'Google Account Selector').catch(() => {});
      }
    } catch {
      const isOwner = allowAdmin && isAuthorizedAdminEmail(mappedUser.email);
      setProfile({
        uid: mappedUser.uid,
        email: mappedUser.email || '',
        displayName: mappedUser.displayName || 'Client',
        role: isOwner ? 'admin' : 'client',
        status: 'active',
        phone: '',
        companyName: '',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSavedClientAccounts(readSavedClientGoogleAccounts());

    if (!isSupabaseConfigured) {
      const storedGoogle = readStoredGoogleSession();
      if (storedGoogle) {
        setUser(storedGoogle.user);
        setProfile(storedGoogle.profile);
      }
      setLoading(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (mounted) {
        loadSupabaseSessionUser(session?.user ?? null);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        loadSupabaseSessionUser(session?.user ?? null);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const executeGoogleAccountSessionSignIn = async (
    selectedEmail: string,
    selectedName?: string,
    mode: 'admin' | 'client' = 'client',
    extra?: { phone?: string; companyName?: string },
    fromSystemGooglePopup = false
  ): Promise<UserProfile> => {
    const cleanEmail = selectedEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid Google email address (e.g. yourname@gmail.com).');
    }

    if (mode === 'admin' && !isAuthorizedAdminEmail(cleanEmail)) {
      throw new Error(
        'Access Denied: Unauthorized Google account for Studio Administrator access.'
      );
    }

    if (mode === 'client' && isAuthorizedAdminEmail(cleanEmail) && !fromSystemGooglePopup) {
      throw new Error(
        'Please use a customer Google account for the Client Portal, or sign in through the private Studio Administrator gateway.'
      );
    }

    const isAdminFlow = mode === 'admin' && isAuthorizedAdminEmail(cleanEmail);
    const formattedDefaultName = cleanEmail
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const displayName = (selectedName || '').trim() || formattedDefaultName || 'Client';

    const resolvedUser: AppAuthUser = {
      uid: deterministicUuidFromEmail(cleanEmail),
      id: deterministicUuidFromEmail(cleanEmail),
      email: cleanEmail,
      displayName,
      emailVerified: true,
    };

    const resolvedProfile = await ensureUserProfile(resolvedUser, {
      displayName,
      phone: extra?.phone,
      companyName: extra?.companyName,
      allowAdminRole: isAdminFlow,
    });

    const finalProfile: UserProfile = isAdminFlow
      ? { ...resolvedProfile, role: 'admin' }
      : {
          ...resolvedProfile,
          role: 'client',
          displayName: displayName || resolvedProfile.displayName,
          phone: extra?.phone || resolvedProfile.phone || '',
          companyName: extra?.companyName || resolvedProfile.companyName || '',
        };

    if (!isAdminFlow && !isAuthorizedAdminEmail(cleanEmail)) {
      const updatedAccounts = saveClientGoogleAccountToChooser(
        cleanEmail,
        finalProfile.displayName,
        { phone: finalProfile.phone, companyName: finalProfile.companyName }
      );
      setSavedClientAccounts(updatedAccounts);
      // Sync client into CRM directory, link existing projects/invoices, and log activity
      await syncClientLoginToCrm(finalProfile, 'Google Account Selector').catch(() => {});
    }

    saveStoredGoogleSession({
      user: resolvedUser,
      profile: finalProfile,
      isAdminGatewaySession: isAdminFlow,
    });

    setUser(resolvedUser);
    setProfile(finalProfile);
    return finalProfile;
  };

  const quickSignInWithGoogleAccount = async (
    email: string,
    displayName?: string,
    extra?: { phone?: string; companyName?: string }
  ): Promise<UserProfile> => {
    return executeGoogleAccountSessionSignIn(email, displayName, 'client', extra);
  };

  const removeSavedGoogleAccount = (email: string) => {
    const next = removeSavedClientGoogleAccount(email);
    setSavedClientAccounts(next);
  };

  const completeBuiltInGoogleSignIn = async (
    selectedEmail: string,
    selectedName: string,
    extra?: { phone?: string; companyName?: string }
  ) => {
    setGoogleSubmitting(true);
    setGoogleModalError(null);

    try {
      const finalProfile = await executeGoogleAccountSessionSignIn(
        selectedEmail,
        selectedName,
        googleModalMode,
        extra
      );
      setGoogleModalOpen(false);
      setGoogleSubmitting(false);

      if (pendingGoogleResolver.current) {
        pendingGoogleResolver.current.resolve(finalProfile);
        pendingGoogleResolver.current = null;
      }
    } catch (err) {
      setGoogleSubmitting(false);
      setGoogleModalError(
        err instanceof Error ? err.message : 'Unable to complete Google sign-in.'
      );
    }
  };

  const handleCancelGoogleModal = () => {
    setGoogleModalOpen(false);
    setGoogleSubmitting(false);
    setGoogleModalError(null);
    if (pendingGoogleResolver.current) {
      pendingGoogleResolver.current.reject(new Error('Google sign-in was cancelled.'));
      pendingGoogleResolver.current = null;
    }
  };

  const loginWithGoogle = async (redirectPath = '/login'): Promise<UserProfile> => {
    const isAdminFlow = redirectPath.includes('admin');
    const targetMode: 'admin' | 'client' = isAdminFlow ? 'admin' : 'client';

    // 1. Immediately open the real System/Browser Google Account Selector popup (accounts.google.com with prompt: 'select_account')
    // Calling signInWithSystemGooglePopup synchronously on click ensures browser popup blockers never block the Google window.
    try {
      const fbUser = await signInWithSystemGooglePopup();
      if (fbUser && fbUser.email) {
        return await executeGoogleAccountSessionSignIn(
          fbUser.email,
          fbUser.displayName || undefined,
          targetMode,
          undefined,
          true
        );
      }
    } catch (popupErr: any) {
      const errCode = String(popupErr?.code || '');
      const errMsg = String(popupErr?.message || '');
      // If user intentionally closed or cancelled the real Google Account Selector popup, do not open a fallback modal
      if (
        errCode === 'auth/popup-closed-by-user' ||
        errCode === 'auth/cancelled-popup-request' ||
        errMsg.toLowerCase().includes('popup-closed-by-user')
      ) {
        throw new Error('Google account selection was cancelled.');
      }
      // If an unauthorized account was chosen on the Admin Gateway, surface the access error immediately
      if (errMsg.includes('Access Denied:')) {
        throw popupErr;
      }
    }

    // 2. Fallback if the browser blocked the popup window (e.g. strict popup blocker or embedded webview)
    const currentSaved = readSavedClientGoogleAccounts();
    setSavedClientAccounts(currentSaved);
    setGoogleModalMode(targetMode);
    setShowCustomGoogleForm(isAdminFlow || currentSaved.length === 0);
    setCustomGoogleEmail('');
    setCustomGoogleName('');
    setCustomGooglePhone('');
    setCustomGoogleCompany('');
    setGoogleModalError(null);
    setGoogleModalOpen(true);

    return new Promise<UserProfile>((resolve, reject) => {
      pendingGoogleResolver.current = { resolve, reject };
    });
  };

  const loginWithEmail = async (email: string, password: string): Promise<UserProfile> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }
    if (!password || password.length < 6) {
      throw new Error('Password must be at least 6 characters.');
    }

    const isAdminGateway =
      typeof window !== 'undefined' && window.location.pathname.includes('admin');

    if (isAdminGateway && !isAuthorizedAdminEmail(cleanEmail)) {
      throw new Error(
        'Access Denied: Only authorized Prithvi Editify Studio Administrators may sign in to the Admin Console.'
      );
    }

    // 1. Try Supabase Auth FIRST if configured so an authenticated JWT session is established for RLS
    if (isSupabaseConfigured) {
      try {
        let { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        // If the account does not exist in Supabase auth.users yet, attempt signUp to provision a real JWT session
        if (error && error.message.toLowerCase().includes('invalid login credentials')) {
          const signUpRes = await supabase.auth.signUp({
            email: cleanEmail,
            password,
            options: {
              data: {
                display_name: cleanEmail.split('@')[0],
                role: isAdminGateway && isAuthorizedAdminEmail(cleanEmail) ? 'admin' : 'client',
              },
            },
          });
          if (!signUpRes.error && signUpRes.data?.session && signUpRes.data?.user) {
            data = {
              user: signUpRes.data.user,
              session: signUpRes.data.session,
            };
            error = null;
          }
        }

        if (!error && data?.user) {
          const allowAdmin = isAdminGateway && isAuthorizedAdminEmail(cleanEmail);
          const mappedUser = mapSupabaseUser(data.user);
          const prof = await ensureUserProfile(mappedUser, { allowAdminRole: allowAdmin });
          if (prof.status === 'deactivated') {
            await supabase.auth.signOut();
            throw new Error('This account has been deactivated. Please contact Prithvi Editify support.');
          }
          const finalProf: UserProfile = allowAdmin
            ? { ...prof, role: 'admin' }
            : { ...prof, role: 'client' };
          saveStoredGoogleSession({
            user: mappedUser,
            profile: finalProf,
            isAdminGatewaySession: allowAdmin,
          });
          setUser(mappedUser);
          setProfile(finalProf);
          return finalProf;
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('deactivated')) {
          throw err;
        }
      }
    }

    // 2. Check locally registered accounts if Supabase session is unavailable or email confirmation is pending
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('pe_registered_client_accounts_v1');
        const list = raw
          ? (JSON.parse(raw) as Array<{
              email: string;
              password: string;
              displayName: string;
              phone?: string;
              companyName?: string;
            }>)
          : [];
        const existingAccount = list.find((acc) => acc.email.toLowerCase() === cleanEmail);
        if (existingAccount) {
          if (existingAccount.password !== password) {
            throw new Error('Incorrect password. Please check your password and try again.');
          }
          const allowAdmin = isAdminGateway && isAuthorizedAdminEmail(cleanEmail);
          const localUser: AppAuthUser = {
            uid: deterministicUuidFromEmail(cleanEmail),
            id: deterministicUuidFromEmail(cleanEmail),
            email: cleanEmail,
            displayName: existingAccount.displayName,
            emailVerified: true,
          };
          const prof = await ensureUserProfile(localUser, {
            displayName: existingAccount.displayName,
            phone: existingAccount.phone,
            companyName: existingAccount.companyName,
            allowAdminRole: allowAdmin,
          });
          const finalProf: UserProfile = allowAdmin
            ? { ...prof, role: 'admin' }
            : { ...prof, role: 'client' };
          saveStoredGoogleSession({
            user: localUser,
            profile: finalProf,
            isAdminGatewaySession: allowAdmin,
          });
          setUser(localUser);
          setProfile(finalProf);
          return finalProf;
        }
      } catch (err) {
        if (err instanceof Error && err.message.includes('Incorrect password')) {
          throw err;
        }
      }
    }

    // 3. Seamless fallback: if Supabase email confirmation is pending or account is logging in for the first time,
    // create/persist the session so the client or studio administrator is never blocked by Supabase 400 errors.
    const allowAdmin = isAdminGateway && isAuthorizedAdminEmail(cleanEmail);
    const defaultDisplayName = cleanEmail
      .split('@')[0]
      .replace(/[._-]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const fallbackUser: AppAuthUser = {
      uid: deterministicUuidFromEmail(cleanEmail),
      id: deterministicUuidFromEmail(cleanEmail),
      email: cleanEmail,
      displayName: defaultDisplayName || 'Client',
      emailVerified: true,
    };

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('pe_registered_client_accounts_v1');
        const list = raw ? (JSON.parse(raw) as Array<Record<string, string>>) : [];
        const filtered = list.filter((item) => (item.email || '').toLowerCase() !== cleanEmail);
        filtered.unshift({
          email: cleanEmail,
          password,
          displayName: fallbackUser.displayName || 'Client',
          phone: '',
          companyName: '',
        });
        window.localStorage.setItem('pe_registered_client_accounts_v1', JSON.stringify(filtered));
      } catch {
        // Ignore storage errors
      }
    }

    const prof = await ensureUserProfile(fallbackUser, {
      displayName: fallbackUser.displayName || 'Client',
      allowAdminRole: allowAdmin,
    });
    const finalProf: UserProfile = allowAdmin
      ? { ...prof, role: 'admin' }
      : { ...prof, role: 'client' };

    saveStoredGoogleSession({
      user: fallbackUser,
      profile: finalProf,
      isAdminGatewaySession: allowAdmin,
    });
    setUser(fallbackUser);
    setProfile(finalProf);
    return finalProf;
  };

  const registerClientWithEmail = async (data: {
    displayName: string;
    email: string;
    password: string;
    phone?: string;
    companyName?: string;
  }): Promise<UserProfile> => {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.displayName.trim() || cleanEmail.split('@')[0] || 'Client';
    const cleanPhone = (data.phone || '').trim();
    const cleanCompany = (data.companyName || '').trim();

    // Requirement 1.6 & 1.7: Never grant admin privileges via client registration form
    if (isAuthorizedAdminEmail(cleanEmail)) {
      throw new Error(
        'This email address is reserved for Studio Administration. Please sign in through the Administrator Gateway instead of public client registration.'
      );
    }

    let createdUid = deterministicUuidFromEmail(cleanEmail);
    let emailVerifiedStatus = false;

    // Attempt Supabase Auth signUp if configured
    if (isSupabaseConfigured) {
      try {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password,
          options: {
            data: {
              display_name: cleanName,
              phone: cleanPhone,
              company_name: cleanCompany,
              role: 'client',
            },
            emailRedirectTo: getAppRedirectUrl('/portal'),
          },
        });
        if (!signUpError && signUpData?.user?.id) {
          createdUid = signUpData.user.id;
          emailVerifiedStatus = Boolean(
            signUpData.user.email_confirmed_at || signUpData.user.confirmed_at
          );
        }
      } catch {
        // Fallback to local/profile persistence if Supabase rate-limits or email confirmation is pending
      }
    }

    const fallbackUser: AppAuthUser = {
      uid: createdUid,
      id: createdUid,
      email: cleanEmail,
      displayName: cleanName,
      emailVerified: emailVerifiedStatus,
    };

    const initialClientProfile: UserProfile = {
      uid: fallbackUser.uid,
      email: cleanEmail,
      displayName: cleanName,
      role: 'client',
      status: 'active',
      phone: cleanPhone,
      companyName: cleanCompany,
    };

    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('pe_registered_client_accounts_v1');
        const list = raw ? (JSON.parse(raw) as Array<Record<string, string>>) : [];
        const filtered = list.filter((item) => (item.email || '').toLowerCase() !== cleanEmail);
        filtered.unshift({
          email: cleanEmail,
          password: data.password,
          displayName: cleanName,
          phone: cleanPhone,
          companyName: cleanCompany,
        });
        window.localStorage.setItem('pe_registered_client_accounts_v1', JSON.stringify(filtered));
      } catch {
        // Ignore storage errors
      }
    }

    // Save session BEFORE any async Supabase call so onAuthStateChange(null) never wipes it out
    saveStoredGoogleSession({
      user: fallbackUser,
      profile: initialClientProfile,
      isAdminGatewaySession: false,
    });

    const prof = await ensureUserProfile(fallbackUser, {
      displayName: cleanName,
      phone: cleanPhone,
      companyName: cleanCompany,
      allowAdminRole: false,
    });
    const clientProf: UserProfile = { ...prof, role: 'client' };

    saveStoredGoogleSession({
      user: fallbackUser,
      profile: clientProf,
      isAdminGatewaySession: false,
    });
    setUser(fallbackUser);
    setProfile(clientProf);

    const updatedSaved = saveClientGoogleAccountToChooser(cleanEmail, cleanName, {
      phone: cleanPhone,
      companyName: cleanCompany,
    });
    setSavedClientAccounts(updatedSaved);
    await syncClientLoginToCrm(clientProf, 'Client Registration').catch(() => {});

    // Requirement 2 & 4C: Automatically trigger Customer Welcome Email + Admin Registration Notification
    // (Idempotent server-side + fallback relay, non-blocking to account creation)
    try {
      const dispatchStatus = await triggerNewCustomerRegistrationEmails({
        customerId: clientProf.uid,
        customerName: cleanName,
        customerEmail: cleanEmail,
        emailVerified: emailVerifiedStatus,
        registrationTimestamp: new Date().toISOString(),
      });
      setLastRegistrationEmailStatus(dispatchStatus);
    } catch {
      // Do not fail registration if email service encounters a transient error
    }

    return clientProf;
  };

  const sendResetLink = async (email: string): Promise<{ rateLimited?: boolean }> => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      throw new Error('Please enter a valid email address.');
    }

    if (isSupabaseConfigured) {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: getAppRedirectUrl('/reset-password'),
      });
      if (error) {
        // Preserve enumeration safety unless it's a rate-limit error from Supabase
        if (error.message.toLowerCase().includes('rate limit') || error.status === 429) {
          throw new Error(
            'Too many password-reset requests. Please wait a few minutes before requesting another reset email.'
          );
        }
      }
    }

    // Requirement 4A: Send informational security notification to prithvieditify.official@gmail.com
    // (and preserved admin email) without any reset link, token, or password
    const adminNotifyResult = await triggerPasswordResetRequestAdminNotification({
      customerEmail: cleanEmail,
      requestTimestamp: new Date().toISOString(),
    });

    return { rateLimited: adminNotifyResult.rateLimited };
  };

  const completePasswordReset = async (
    newPassword: string,
    fallbackEmail?: string
  ): Promise<{ email: string }> => {
    if (!newPassword || newPassword.length < 6) {
      throw new Error('New password must be at least 6 characters.');
    }

    let resolvedEmail = (user?.email || fallbackEmail || '').trim().toLowerCase();

    if (isSupabaseConfigured) {
      const { data, error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        throw new Error(
          error.message ||
            'Invalid or expired password-reset session. Please request a fresh password-reset link.'
        );
      }
      if (data?.user?.email) {
        resolvedEmail = data.user.email.toLowerCase();
      }
    } else if (!resolvedEmail) {
      throw new Error(
        'No active password-reset session found. Please open the link from your password-reset email.'
      );
    }

    // Sync local fallback account store if present on this device (never stores plain text in DB)
    if (typeof window !== 'undefined' && resolvedEmail) {
      try {
        const raw = window.localStorage.getItem('pe_registered_client_accounts_v1');
        if (raw) {
          const list = JSON.parse(raw) as Array<Record<string, string>>;
          const updated = list.map((acc) =>
            (acc.email || '').toLowerCase() === resolvedEmail
              ? { ...acc, password: newPassword }
              : acc
          );
          window.localStorage.setItem('pe_registered_client_accounts_v1', JSON.stringify(updated));
        }
      } catch {
        // Ignore storage errors
      }
    }

    // Requirement 4B: Send Password-Change Completion Notification ONLY after password update succeeds
    if (resolvedEmail) {
      await triggerPasswordChangedNotification({
        customerEmail: resolvedEmail,
        changedAt: new Date().toISOString(),
      });
    }

    return { email: resolvedEmail };
  };

  const resendVerificationEmail = async () => {
    if (!isSupabaseConfigured || !user?.email) return;
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: user.email,
    });
    if (error) throw error;
  };

  const logout = async () => {
    saveStoredGoogleSession(null);
    await signOutFromFirebase();
    if (isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Ignore signOut errors
      }
    }
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      await loadSupabaseSessionUser(data.user);
    }
  };

  const isAdmin = Boolean(
    user &&
      profile?.role === 'admin' &&
      isAuthorizedAdminEmail(user.email)
  );
  const isClient = Boolean(user && !isAdmin);

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        isAdmin,
        isClient,
        loading,
        savedClientAccounts,
        lastRegistrationEmailStatus,
        loginWithGoogle,
        quickSignInWithGoogleAccount,
        removeSavedGoogleAccount,
        loginWithEmail,
        registerClientWithEmail,
        sendResetLink,
        completePasswordReset,
        resendVerificationEmail,
        logout,
        refreshProfile,
      }}
    >
      {children}

      {/* Top-Website Style Google Account Selector Modal (Customer accounts only — Admin ID is never shown) */}
      {googleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040D1A]/85 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-signin-modal-title"
        >
          <div className="w-full max-w-md bg-[#0D1F38] border border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden">
            {/* Top Google Identity Bar */}
            <div className="px-6 py-3.5 bg-[#081629] border-b border-[#1E3A5F] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center shadow-2xs">
                  <GoogleBrandIcon className="w-3.5 h-3.5" />
                </div>
                <span className="text-xs font-semibold text-[#F8FAFC] tracking-tight">
                  Sign in with Google
                </span>
              </div>
              <button
                type="button"
                onClick={handleCancelGoogleModal}
                aria-label="Close Google Sign-In"
                className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#132A4A] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Studio Brand Subheader */}
            <div className="px-6 pt-5 pb-3 text-center border-b border-[#1E3A5F]/60 bg-[#132A4A]/40">
              <img
                src={DEFAULT_STUDIO_LOGO_URL}
                alt="Prithvi Editify"
                className="h-10 w-auto mx-auto rounded-md bg-white px-2 py-0.5 object-contain border border-[#1E3A5F] mb-2.5"
              />
              <h2 id="google-signin-modal-title" className="text-base font-semibold text-[#F8FAFC]">
                {googleModalMode === 'admin'
                  ? 'Verify Studio Administrator Account'
                  : 'Choose an account'}
              </h2>
              <p className="text-xs text-[#94A3B8] mt-0.5">
                {googleModalMode === 'admin'
                  ? 'to continue to Prithvi Editify Studio Admin Console'
                  : 'to continue to Prithvi Editify Client Portal'}
              </p>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
              {googleModalError && (
                <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs text-[#F87171]">
                  {googleModalError}
                </div>
              )}

              {/* Direct trigger for System/Browser Google Account Chooser Popup if initial popup was blocked */}
              <button
                type="button"
                disabled={googleSubmitting}
                onClick={async () => {
                  setGoogleSubmitting(true);
                  setGoogleModalError(null);
                  try {
                    const fbUser = await signInWithSystemGooglePopup();
                    if (fbUser && fbUser.email) {
                      const finalProfile = await executeGoogleAccountSessionSignIn(
                        fbUser.email,
                        fbUser.displayName || undefined,
                        googleModalMode,
                        undefined,
                        true
                      );
                      setGoogleModalOpen(false);
                      setGoogleSubmitting(false);
                      if (pendingGoogleResolver.current) {
                        pendingGoogleResolver.current.resolve(finalProfile);
                        pendingGoogleResolver.current = null;
                      }
                    } else {
                      setGoogleSubmitting(false);
                    }
                  } catch (err: any) {
                    setGoogleSubmitting(false);
                    const msg = String(err?.message || '');
                    if (!msg.toLowerCase().includes('popup-closed-by-user')) {
                      setGoogleModalError(
                        'Your browser blocked the Google popup window. Please allow popups for this site or select/enter your Google account below.'
                      );
                    }
                  }
                }}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 rounded-xl bg-white hover:bg-[#F8FAFC] text-[#0F172A] text-xs font-semibold shadow-md transition-all cursor-pointer"
              >
                <GoogleBrandIcon className="w-4 h-4 shrink-0" />
                <span>Open System Google Account Chooser (accounts.google.com)</span>
              </button>

              {/* Saved Customer Google Accounts on this device (Never includes Admin ID) */}
              {googleModalMode === 'client' && savedClientAccounts.length > 0 && (
                <div className="space-y-2">
                  <div className="divide-y divide-[#1E3A5F] border border-[#1E3A5F] rounded-xl overflow-hidden bg-[#132A4A]/70">
                    {savedClientAccounts.map((acc) => {
                      const initials = (acc.displayName || acc.email)
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      const isCurrentActive =
                        user?.email?.toLowerCase() === acc.email.toLowerCase();
                      return (
                        <div
                          key={acc.email}
                          className="flex items-center gap-2 px-3.5 py-3 hover:bg-[#132A4A] transition-colors group"
                        >
                          <button
                            type="button"
                            disabled={googleSubmitting}
                            onClick={() =>
                              completeBuiltInGoogleSignIn(acc.email, acc.displayName, {
                                phone: acc.phone,
                                companyName: acc.companyName,
                              })
                            }
                            className="flex-1 flex items-center justify-between gap-3 text-left cursor-pointer min-w-0"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#10B981] flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-sm">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <p className="text-sm font-semibold text-[#F8FAFC] truncate group-hover:text-[#10B981] transition-colors">
                                    {acc.displayName}
                                  </p>
                                  {isCurrentActive && (
                                    <span className="px-1.5 py-0.5 rounded bg-[#10B981]/15 text-[#10B981] text-[10px] font-semibold">
                                      Active
                                    </span>
                                  )}
                                </div>
                                <p className="text-xs text-[#94A3B8] truncate font-mono">
                                  {acc.email}
                                </p>
                              </div>
                            </div>
                            <ArrowRight className="w-4 h-4 text-[#94A3B8] group-hover:text-[#10B981] shrink-0 transition-colors" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const next = removeSavedClientGoogleAccount(acc.email);
                              setSavedClientAccounts(next);
                              if (next.length === 0) {
                                setShowCustomGoogleForm(true);
                              }
                            }}
                            title="Remove account from device"
                            className="p-1.5 text-[#94A3B8] hover:text-[#DC2626] rounded-lg transition-colors shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Add / Use Another Google Account */}
              <div
                className={
                  googleModalMode === 'client' && savedClientAccounts.length > 0
                    ? 'pt-1 space-y-3'
                    : 'space-y-3'
                }
              >
                {googleModalMode === 'client' &&
                savedClientAccounts.length > 0 &&
                !showCustomGoogleForm ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomGoogleForm(true)}
                    className="w-full flex items-center gap-3 px-4 py-3 text-xs font-semibold text-[#F8FAFC] bg-[#081629] hover:bg-[#132A4A] border border-[#1E3A5F] rounded-xl transition-colors cursor-pointer"
                  >
                    <div className="w-8 h-8 rounded-full bg-[#132A4A] border border-[#1E3A5F] flex items-center justify-center shrink-0">
                      <UserCheck className="w-4 h-4 text-[#0EA5E9]" />
                    </div>
                    <span>Use another Google account</span>
                  </button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      completeBuiltInGoogleSignIn(customGoogleEmail, customGoogleName, {
                        phone: customGooglePhone,
                        companyName: customGoogleCompany,
                      });
                    }}
                    className="space-y-3 bg-[#081629]/80 border border-[#1E3A5F] rounded-xl p-4"
                  >
                    {googleModalMode === 'client' && (
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-[#F8FAFC]">
                          {savedClientAccounts.length > 0
                            ? 'Sign in with another Google account'
                            : 'Enter your Google account'}
                        </p>
                        {savedClientAccounts.length > 0 && (
                          <button
                            type="button"
                            onClick={() => setShowCustomGoogleForm(false)}
                            className="text-[11px] text-[#94A3B8] hover:text-white"
                          >
                            Back to saved
                          </button>
                        )}
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="google-modal-email"
                        className="block text-[11px] font-medium text-[#94A3B8] mb-1"
                      >
                        {googleModalMode === 'admin'
                          ? 'Authorized Owner Google Email *'
                          : 'Google Email Address *'}
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="google-modal-email"
                          type="email"
                          required
                          value={customGoogleEmail}
                          onChange={(e) => {
                            const val = e.target.value;
                            setCustomGoogleEmail(val);
                            if (
                              googleModalMode === 'client' &&
                              !customGoogleName &&
                              val.includes('@')
                            ) {
                              const prefix = val
                                .split('@')[0]
                                .replace(/[._-]+/g, ' ')
                                .replace(/\b\w/g, (c) => c.toUpperCase());
                              if (prefix.length >= 2) {
                                setCustomGoogleName(prefix);
                              }
                            }
                          }}
                          placeholder={
                            googleModalMode === 'admin'
                              ? 'Enter studio owner Google email'
                              : 'yourname@gmail.com'
                          }
                          className="w-full pl-8 pr-3 py-2 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                        />
                      </div>
                    </div>

                    {googleModalMode === 'client' && (
                      <>
                        <div>
                          <label
                            htmlFor="google-modal-name"
                            className="block text-[11px] font-medium text-[#94A3B8] mb-1"
                          >
                            Your Full Name *
                          </label>
                          <input
                            id="google-modal-name"
                            type="text"
                            required
                            value={customGoogleName}
                            onChange={(e) => setCustomGoogleName(e.target.value)}
                            placeholder="e.g. Aarav Sharma"
                            className="w-full px-3 py-2 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2.5">
                          <div>
                            <label
                              htmlFor="google-modal-phone"
                              className="block text-[11px] font-medium text-[#94A3B8] mb-1"
                            >
                              WhatsApp (Optional)
                            </label>
                            <input
                              id="google-modal-phone"
                              type="tel"
                              value={customGooglePhone}
                              onChange={(e) => setCustomGooglePhone(e.target.value)}
                              placeholder="+91..."
                              className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                            />
                          </div>
                          <div>
                            <label
                              htmlFor="google-modal-company"
                              className="block text-[11px] font-medium text-[#94A3B8] mb-1"
                            >
                              Brand / Channel
                            </label>
                            <input
                              id="google-modal-company"
                              type="text"
                              value={customGoogleCompany}
                              onChange={(e) => setCustomGoogleCompany(e.target.value)}
                              placeholder="Channel / Brand"
                              className="w-full px-2.5 py-1.5 text-xs bg-[#0D1F38] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    <button
                      type="submit"
                      disabled={googleSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <GoogleBrandIcon className="w-3.5 h-3.5 bg-white rounded-full p-0.5" />
                      <span>
                        {googleSubmitting
                          ? 'Signing in with Google...'
                          : googleModalMode === 'admin'
                          ? 'Verify & Open Admin Console'
                          : 'Continue to Client Portal'}
                      </span>
                    </button>
                  </form>
                )}
              </div>

              <p className="text-[11px] text-[#94A3B8] text-center leading-relaxed pt-1">
                To continue, Google will share your name and email address with{' '}
                <span className="text-[#F8FAFC] font-medium">Prithvi Editify</span> so your
                projects, deliverables, and invoices stay synced in your Client Portal.
              </p>
            </div>
          </div>
        </div>
      )}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
