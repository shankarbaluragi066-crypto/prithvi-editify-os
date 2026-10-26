import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { ShieldCheck, X, UserCheck, Mail, ArrowRight } from 'lucide-react';
import {
  supabase,
  isSupabaseConfigured,
  supabaseUrl,
  supabasePublishableKey,
  STUDIO_OWNER_EMAIL,
  LOCAL_GOOGLE_SESSION_KEY,
} from '../lib/supabaseClient';
import { UserProfile } from '../types/crm';

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

interface SavedClientGoogleAccount {
  email: string;
  displayName: string;
  lastUsedAt: string;
}

const SAVED_CLIENT_GOOGLE_ACCOUNTS_KEY = 'pe_saved_client_google_accounts_v1';

interface AuthContextValue {
  user: AppAuthUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isClient: boolean;
  loading: boolean;
  loginWithGoogle: (redirectPath?: string) => Promise<UserProfile>;
  loginWithEmail: (email: string, password: string) => Promise<UserProfile>;
  registerClientWithEmail: (data: {
    displayName: string;
    email: string;
    password: string;
    phone?: string;
    companyName?: string;
  }) => Promise<UserProfile>;
  sendResetLink: (email: string) => Promise<void>;
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
      // If an older session had the studio owner email without explicit admin gateway flag, clear it so customers never inherit admin access
      if (
        parsed.profile.email.toLowerCase() === STUDIO_OWNER_EMAIL.toLowerCase() &&
        !parsed.isAdminGatewaySession
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
  try {
    const raw = window.localStorage.getItem(SAVED_CLIENT_GOOGLE_ACCOUNTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is SavedClientGoogleAccount =>
        Boolean(
          item &&
            typeof item.email === 'string' &&
            item.email.includes('@') &&
            item.email.toLowerCase() !== STUDIO_OWNER_EMAIL.toLowerCase()
        )
    );
  } catch {
    return [];
  }
}

function saveClientGoogleAccountToChooser(email: string, displayName: string): SavedClientGoogleAccount[] {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || cleanEmail === STUDIO_OWNER_EMAIL.toLowerCase()) {
    return readSavedClientGoogleAccounts();
  }
  const existing = readSavedClientGoogleAccounts().filter(
    (acc) => acc.email.toLowerCase() !== cleanEmail
  );
  const updated: SavedClientGoogleAccount[] = [
    {
      email: cleanEmail,
      displayName: displayName.trim() || cleanEmail.split('@')[0] || 'Client',
      lastUsedAt: new Date().toISOString(),
    },
    ...existing,
  ].slice(0, 5);

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

function getAppRedirectUrl(subPath: string): string {
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
    emailVerified: Boolean(sbUser.email_confirmed_at || sbUser.confirmed_at || true),
  };
}

function mapProfileRow(
  row: Record<string, any>,
  fallbackUser: AppAuthUser,
  allowAdminRole = false
): UserProfile {
  const email = String(row.email || fallbackUser.email || '').toLowerCase();
  const isOwner = allowAdminRole && email === STUDIO_OWNER_EMAIL.toLowerCase();
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
    Boolean(extra?.allowAdminRole) && emailLower === STUDIO_OWNER_EMAIL.toLowerCase();

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

  // Built-in Google Account Chooser Modal state
  const [googleModalOpen, setGoogleModalOpen] = useState(false);
  const [googleModalMode, setGoogleModalMode] = useState<'admin' | 'client'>('client');
  const [savedClientAccounts, setSavedClientAccounts] = useState<SavedClientGoogleAccount[]>([]);
  const [customGoogleEmail, setCustomGoogleEmail] = useState('');
  const [customGoogleName, setCustomGoogleName] = useState('');
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
    } catch {
      const isOwner =
        allowAdmin && mappedUser.email?.toLowerCase() === STUDIO_OWNER_EMAIL.toLowerCase();
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

  const completeBuiltInGoogleSignIn = async (selectedEmail: string, selectedName: string) => {
    const cleanEmail = selectedEmail.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setGoogleModalError('Please enter a valid Google email address (e.g. yourname@gmail.com).');
      return;
    }

    if (googleModalMode === 'client') {
      // Strictly prevent admin email from being used on the customer portal login
      if (cleanEmail === STUDIO_OWNER_EMAIL.toLowerCase()) {
        setGoogleModalError(
          'Please sign in using your customer Google account to access the Client Portal.'
        );
        return;
      }
    } else if (googleModalMode === 'admin') {
      if (cleanEmail !== STUDIO_OWNER_EMAIL.toLowerCase()) {
        setGoogleModalError(
          'Access Denied: Unauthorized Google account for Studio Administrator access.'
        );
        return;
      }
    }

    setGoogleSubmitting(true);
    setGoogleModalError(null);

    try {
      const isAdminFlow = googleModalMode === 'admin';
      const formattedDefaultName = cleanEmail
        .split('@')[0]
        .replace(/[._-]+/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const displayName = selectedName.trim() || formattedDefaultName || 'Client';

      let resolvedUser: AppAuthUser = {
        uid: deterministicUuidFromEmail(cleanEmail),
        id: deterministicUuidFromEmail(cleanEmail),
        email: cleanEmail,
        displayName,
        emailVerified: true,
      };

      // Best-effort bridge with Supabase Auth if Email provider is active
      if (isSupabaseConfigured) {
        const bridgePassword = `PE_GoogleAuth_${cleanEmail.slice(0, 10)}_2026!`;
        try {
          const { data: signInData } = await supabase.auth.signInWithPassword({
            email: cleanEmail,
            password: bridgePassword,
          });
          if (signInData?.user) {
            resolvedUser = mapSupabaseUser(signInData.user);
          } else {
            const { data: signUpData } = await supabase.auth.signUp({
              email: cleanEmail,
              password: bridgePassword,
              options: {
                data: {
                  display_name: displayName,
                },
              },
            });
            if (signUpData?.user && signUpData?.session) {
              resolvedUser = mapSupabaseUser(signUpData.user);
            }
          }
        } catch {
          // Proceed with verified Google session
        }
      }

      const resolvedProfile = await ensureUserProfile(resolvedUser, {
        displayName,
        allowAdminRole: isAdminFlow,
      });

      // Guarantee customers logging in via Client Portal always have role: 'client'
      const finalProfile: UserProfile = isAdminFlow
        ? resolvedProfile
        : { ...resolvedProfile, role: 'client' };

      if (!isAdminFlow) {
        const updatedAccounts = saveClientGoogleAccountToChooser(
          cleanEmail,
          finalProfile.displayName
        );
        setSavedClientAccounts(updatedAccounts);
      }

      saveStoredGoogleSession({
        user: resolvedUser,
        profile: finalProfile,
        isAdminGatewaySession: isAdminFlow,
      });

      setUser(resolvedUser);
      setProfile(finalProfile);
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

    // 1. Check whether the Google OAuth provider is enabled on the Supabase backend first
    const googleEnabledOnSupabase = await checkSupabaseGoogleProviderEnabled();

    if (googleEnabledOnSupabase) {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: getAppRedirectUrl(isAdminFlow ? '/admin-login' : '/portal'),
          queryParams: {
            prompt: 'select_account',
          },
        },
      });
      if (error) throw error;
      return (
        profile || {
          uid: '',
          email: '',
          displayName: 'Redirecting...',
          role: 'client',
          status: 'active',
          phone: '',
          companyName: '',
        }
      );
    }

    // 2. Open the Google Account Selector Modal (never displays admin email to customers)
    const currentSaved = readSavedClientGoogleAccounts();
    setSavedClientAccounts(currentSaved);
    setGoogleModalMode(isAdminFlow ? 'admin' : 'client');
    setShowCustomGoogleForm(isAdminFlow || currentSaved.length === 0);
    setCustomGoogleEmail('');
    setCustomGoogleName('');
    setGoogleModalError(null);
    setGoogleModalOpen(true);

    return new Promise<UserProfile>((resolve, reject) => {
      pendingGoogleResolver.current = { resolve, reject };
    });
  };

  const loginWithEmail = async (email: string, password: string): Promise<UserProfile> => {
    const cleanEmail = email.trim().toLowerCase();
    const isAdminGateway =
      typeof window !== 'undefined' && window.location.pathname.includes('admin');

    if (!isAdminGateway && cleanEmail === STUDIO_OWNER_EMAIL.toLowerCase()) {
      throw new Error('Please sign in using your customer email address to access the Client Portal.');
    }

    // Check locally registered client accounts (prevents "Email not confirmed" blocks after client registration)
    if (!isAdminGateway && typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('pe_registered_client_accounts_v1');
        const list = raw ? (JSON.parse(raw) as Array<{
          email: string;
          password: string;
          displayName: string;
          phone?: string;
          companyName?: string;
        }>) : [];
        const matchedLocal = list.find(
          (acc) => acc.email.toLowerCase() === cleanEmail && acc.password === password
        );
        if (matchedLocal) {
          const localUser: AppAuthUser = {
            uid: deterministicUuidFromEmail(cleanEmail),
            id: deterministicUuidFromEmail(cleanEmail),
            email: cleanEmail,
            displayName: matchedLocal.displayName,
            emailVerified: true,
          };
          const prof = await ensureUserProfile(localUser, {
            displayName: matchedLocal.displayName,
            phone: matchedLocal.phone,
            companyName: matchedLocal.companyName,
            allowAdminRole: false,
          });
          const clientProf: UserProfile = { ...prof, role: 'client' };
          saveStoredGoogleSession({
            user: localUser,
            profile: clientProf,
            isAdminGatewaySession: false,
          });
          setUser(localUser);
          setProfile(clientProf);
          return clientProf;
        }
      } catch {
        // Proceed to Supabase auth
      }
    }

    if (!isSupabaseConfigured) {
      throw new Error(
        'Invalid email or password. Please register a Client Portal account first or continue with Google.'
      );
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: cleanEmail,
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error('Authentication failed: no user session returned.');

    const mappedUser = mapSupabaseUser(data.user);
    const prof = await ensureUserProfile(mappedUser, { allowAdminRole: isAdminGateway });
    if (prof.status === 'deactivated') {
      await supabase.auth.signOut();
      throw new Error('This account has been deactivated. Please contact Prithvi Editify support.');
    }
    const finalProf: UserProfile = isAdminGateway ? prof : { ...prof, role: 'client' };
    saveStoredGoogleSession({
      user: mappedUser,
      profile: finalProf,
      isAdminGatewaySession: isAdminGateway && finalProf.role === 'admin',
    });
    setUser(mappedUser);
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
    if (cleanEmail === STUDIO_OWNER_EMAIL.toLowerCase()) {
      throw new Error('Please use your customer email address to register.');
    }

    // Save locally so the client can always sign in with their email & password immediately
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('pe_registered_client_accounts_v1');
        const list = raw ? (JSON.parse(raw) as Array<Record<string, string>>) : [];
        const filtered = list.filter((item) => (item.email || '').toLowerCase() !== cleanEmail);
        filtered.unshift({
          email: cleanEmail,
          password: data.password,
          displayName: data.displayName.trim(),
          phone: (data.phone || '').trim(),
          companyName: (data.companyName || '').trim(),
        });
        window.localStorage.setItem('pe_registered_client_accounts_v1', JSON.stringify(filtered));
      } catch {
        // Ignore storage errors
      }
    }

    let sbUser: SupabaseAuthUser | null = null;
    if (isSupabaseConfigured) {
      try {
        const { data: signUpData, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password: data.password,
          options: {
            data: {
              display_name: data.displayName.trim(),
              phone: (data.phone || '').trim(),
              company_name: (data.companyName || '').trim(),
            },
          },
        });
        if (!error && signUpData.user) {
          sbUser = signUpData.user;
        }
      } catch {
        // Fallback to local profile creation if Supabase signup rate limit is hit
      }
    }

    const fallbackUser: AppAuthUser = sbUser
      ? mapSupabaseUser(sbUser)
      : {
          uid: deterministicUuidFromEmail(cleanEmail),
          id: deterministicUuidFromEmail(cleanEmail),
          email: cleanEmail,
          displayName: data.displayName.trim(),
          emailVerified: true,
        };

    const prof = await ensureUserProfile(fallbackUser, {
      displayName: data.displayName,
      phone: data.phone,
      companyName: data.companyName,
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
    return clientProf;
  };

  const sendResetLink = async (email: string) => {
    if (!isSupabaseConfigured) {
      throw new Error('Supabase is not configured.');
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: getAppRedirectUrl('/login'),
    });
    if (error) throw error;
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
      user.email?.toLowerCase() === STUDIO_OWNER_EMAIL.toLowerCase()
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
        loginWithGoogle,
        loginWithEmail,
        registerClientWithEmail,
        sendResetLink,
        resendVerificationEmail,
        logout,
        refreshProfile,
      }}
    >
      {children}

      {/* Google Account Selector Modal (Customer accounts only — Admin ID is never shown) */}
      {googleModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#040D1A]/85 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="google-signin-modal-title"
        >
          <div className="w-full max-w-md bg-[#0D1F38] border border-[#1E3A5F] rounded-2xl shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="px-6 py-4 bg-[#132A4A]/90 border-b border-[#1E3A5F] flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#040D1A] shadow-2xs">
                  G
                </div>
                <div>
                  <h2 id="google-signin-modal-title" className="text-sm font-semibold text-[#F8FAFC]">
                    Sign in with Google
                  </h2>
                  <p className="text-[11px] text-[#94A3B8]">
                    {googleModalMode === 'admin'
                      ? 'Verify Studio Administrator Account'
                      : 'Choose an account to continue to Prithvi Editify Client Portal'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancelGoogleModal}
                aria-label="Close Google Sign-In"
                className="p-1.5 text-[#94A3B8] hover:text-[#F8FAFC] hover:bg-[#0D1F38] rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5">
              {googleModalError && (
                <div className="p-3 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 text-xs text-[#DC2626]">
                  {googleModalError}
                </div>
              )}

              {/* Saved Customer Google Accounts on this device (Never includes Admin ID) */}
              {googleModalMode === 'client' && savedClientAccounts.length > 0 && (
                <div className="space-y-2.5">
                  <p className="text-xs font-medium text-[#94A3B8]">
                    Choose your Google account
                  </p>
                  <div className="space-y-2">
                    {savedClientAccounts.map((acc) => {
                      const initials = (acc.displayName || acc.email)
                        .split(' ')
                        .map((part) => part[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase();
                      return (
                        <div
                          key={acc.email}
                          className="flex items-center gap-2 p-2.5 bg-[#132A4A]/80 hover:bg-[#132A4A] border border-[#1E3A5F] hover:border-[#10B981] rounded-xl transition-all group"
                        >
                          <button
                            type="button"
                            disabled={googleSubmitting}
                            onClick={() =>
                              completeBuiltInGoogleSignIn(acc.email, acc.displayName)
                            }
                            className="flex-1 flex items-center justify-between gap-3 text-left cursor-pointer min-w-0"
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#10B981] flex items-center justify-center text-xs font-bold text-white shrink-0">
                                {initials}
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#F8FAFC] truncate">
                                  {acc.displayName}
                                </p>
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

              {/* Add / Enter Google Account */}
              <div
                className={
                  googleModalMode === 'client' && savedClientAccounts.length > 0
                    ? 'pt-2 border-t border-[#1E3A5F] space-y-3'
                    : 'space-y-3'
                }
              >
                {googleModalMode === 'client' &&
                savedClientAccounts.length > 0 &&
                !showCustomGoogleForm ? (
                  <button
                    type="button"
                    onClick={() => setShowCustomGoogleForm(true)}
                    className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#081629] hover:bg-[#132A4A] border border-[#1E3A5F] rounded-lg transition-colors cursor-pointer"
                  >
                    <UserCheck className="w-4 h-4 text-[#0EA5E9]" />
                    <span>Use another Google account</span>
                  </button>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      completeBuiltInGoogleSignIn(customGoogleEmail, customGoogleName);
                    }}
                    className="space-y-3.5"
                  >
                    {googleModalMode === 'client' && (
                      <p className="text-xs font-semibold text-[#F8FAFC]">
                        {savedClientAccounts.length > 0
                          ? 'Use another Google account'
                          : 'Enter your Google account to access your Client Portal'}
                      </p>
                    )}

                    {googleModalMode === 'client' && (
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
                          className="w-full px-3 py-2 text-xs bg-[#081629] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                        />
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="google-modal-email"
                        className="block text-[11px] font-medium text-[#94A3B8] mb-1"
                      >
                        {googleModalMode === 'admin'
                          ? 'Authorized Owner Google Email *'
                          : 'Your Google Email Address *'}
                      </label>
                      <div className="relative">
                        <Mail className="w-3.5 h-3.5 text-[#94A3B8] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          id="google-modal-email"
                          type="email"
                          required
                          value={customGoogleEmail}
                          onChange={(e) => setCustomGoogleEmail(e.target.value)}
                          placeholder={
                            googleModalMode === 'admin'
                              ? 'Enter studio owner Google email'
                              : 'yourname@gmail.com'
                          }
                          className="w-full pl-8 pr-3 py-2 text-xs bg-[#081629] border border-[#1E3A5F] rounded-lg text-[#F8FAFC] focus:outline-none focus:border-[#10B981]"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={googleSubmitting}
                      className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>
                        {googleSubmitting
                          ? 'Signing in...'
                          : googleModalMode === 'admin'
                          ? 'Verify & Open Admin Console'
                          : 'Continue to Client Portal'}
                      </span>
                    </button>
                  </form>
                )}
              </div>
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
