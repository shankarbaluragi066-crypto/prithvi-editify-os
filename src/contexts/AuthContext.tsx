import React, { createContext, useContext, useEffect, useState } from 'react';
import { User as SupabaseAuthUser } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured, STUDIO_OWNER_EMAIL } from '../lib/supabaseClient';
import { UserProfile } from '../types/crm';

export interface AppAuthUser {
  uid: string;
  id: string;
  email: string | null;
  displayName: string | null;
  emailVerified: boolean;
}

interface AuthContextValue {
  user: AppAuthUser | null;
  profile: UserProfile | null;
  isAdmin: boolean;
  isClient: boolean;
  loading: boolean;
  loginWithGoogle: () => Promise<UserProfile>;
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

function mapProfileRow(row: Record<string, any>, fallbackUser: AppAuthUser): UserProfile {
  const email = String(row.email || fallbackUser.email || '').toLowerCase();
  const isOwner = email === STUDIO_OWNER_EMAIL.toLowerCase();
  return {
    uid: String(row.id || fallbackUser.uid),
    email,
    displayName: String(
      row.display_name || fallbackUser.displayName || email.split('@')[0] || 'Client'
    ),
    role: isOwner || row.role === 'admin' ? 'admin' : 'client',
    status: row.status === 'deactivated' ? 'deactivated' : 'active',
    phone: String(row.phone || ''),
    companyName: String(row.company_name || ''),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function ensureUserProfile(
  authUser: AppAuthUser,
  extra?: { phone?: string; companyName?: string; displayName?: string }
): Promise<UserProfile> {
  const emailLower = (authUser.email || '').toLowerCase();
  const isOwnerAdmin = emailLower === STUDIO_OWNER_EMAIL.toLowerCase();

  if (!isSupabaseConfigured) {
    return {
      uid: authUser.uid,
      email: emailLower,
      displayName: extra?.displayName || authUser.displayName || 'User',
      role: isOwnerAdmin ? 'admin' : 'client',
      status: 'active',
      phone: extra?.phone || '',
      companyName: extra?.companyName || '',
    };
  }

  const { data: existing, error: selectErr } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', authUser.uid)
    .maybeSingle();

  if (!selectErr && existing) {
    const prof = mapProfileRow(existing, authUser);
    if (isOwnerAdmin && existing.role !== 'admin') {
      await supabase
        .from('profiles')
        .update({ role: 'admin', updated_at: new Date().toISOString() })
        .eq('id', authUser.uid);
      return { ...prof, role: 'admin' };
    }
    return prof;
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

  const loadSupabaseSessionUser = async (sbUser: SupabaseAuthUser | null) => {
    if (!sbUser) {
      setUser(null);
      setProfile(null);
      setLoading(false);
      return;
    }

    const mappedUser = mapSupabaseUser(sbUser);
    setUser(mappedUser);

    try {
      const prof = await ensureUserProfile(mappedUser);
      setProfile(prof);
    } catch {
      const isOwner =
        mappedUser.email?.toLowerCase() === STUDIO_OWNER_EMAIL.toLowerCase();
      setProfile({
        uid: mappedUser.uid,
        email: mappedUser.email || '',
        displayName: mappedUser.displayName || 'User',
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
    if (!isSupabaseConfigured) {
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

  const loginWithGoogle = async (): Promise<UserProfile> => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: getAppRedirectUrl('/login'),
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
  };

  const loginWithEmail = async (email: string, password: string): Promise<UserProfile> => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw error;
    if (!data.user) throw new Error('Authentication failed: no user session returned.');

    const mappedUser = mapSupabaseUser(data.user);
    const prof = await ensureUserProfile(mappedUser);
    if (prof.status === 'deactivated') {
      await supabase.auth.signOut();
      throw new Error('This account has been deactivated. Please contact Prithvi Editify support.');
    }
    setUser(mappedUser);
    setProfile(prof);
    return prof;
  };

  const registerClientWithEmail = async (data: {
    displayName: string;
    email: string;
    password: string;
    phone?: string;
    companyName?: string;
  }): Promise<UserProfile> => {
    if (!isSupabaseConfigured) {
      throw new Error(
        'Supabase is not configured. Please set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.'
      );
    }
    const { data: signUpData, error } = await supabase.auth.signUp({
      email: data.email.trim(),
      password: data.password,
      options: {
        data: {
          display_name: data.displayName.trim(),
          phone: (data.phone || '').trim(),
          company_name: (data.companyName || '').trim(),
        },
      },
    });

    if (error) throw error;
    if (!signUpData.user) {
      throw new Error('Registration submitted. Please check your email inbox to confirm your account.');
    }

    const mappedUser = mapSupabaseUser(signUpData.user);
    const prof = await ensureUserProfile(mappedUser, {
      displayName: data.displayName,
      phone: data.phone,
      companyName: data.companyName,
    });
    setUser(mappedUser);
    setProfile(prof);
    return prof;
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
    if (isSupabaseConfigured) {
      await supabase.auth.signOut();
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
      (user.email?.toLowerCase() === STUDIO_OWNER_EMAIL.toLowerCase() ||
        profile?.role === 'admin')
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
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
