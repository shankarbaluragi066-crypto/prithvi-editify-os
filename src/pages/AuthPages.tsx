import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  LogIn,
  UserPlus,
  KeyRound,
  ShieldCheck,
  Lock,
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Mail,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  loginSchema,
  LoginFormValues,
  registerSchema,
  RegisterFormValues,
} from '../schemas/validation';
import {
  isAuthorizedAdminEmail,
  supabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';
import { DEFAULT_STUDIO_LOGO_URL } from '../utils/seedData';

export const LoginPage: React.FC = () => {
  const {
    user,
    profile,
    loading,
    lastRegistrationEmailStatus,
    loginWithGoogle,
    loginWithEmail,
    registerClientWithEmail,
  } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      navigate('/portal', { replace: true });
    }
  }, [loading, user, profile, navigate]);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  const registerForm = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { displayName: '', email: '', phone: '', companyName: '', password: '' },
  });

  const handleGoogleSignIn = async () => {
    setGoogleBusy(true);
    try {
      const prof = await loginWithGoogle('/login');
      showToast('success', 'Signed In', `Welcome to your Client Portal, ${prof.displayName}`);
      navigate('/portal', { replace: true });
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        return;
      }
      showToast(
        'error',
        'Google Sign-In Failed',
        err instanceof Error ? err.message : 'Unable to complete sign-in.'
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const onEmailLogin = async (values: LoginFormValues) => {
    try {
      const prof = await loginWithEmail(values.email, values.password);
      showToast('success', 'Signed In', `Welcome to your Client Portal, ${prof.displayName}`);
      navigate('/portal', { replace: true });
    } catch (err) {
      showToast(
        'error',
        'Authentication Failed',
        err instanceof Error ? err.message : 'Unable to sign in.'
      );
    }
  };

  const onClientRegister = async (values: RegisterFormValues) => {
    try {
      const prof = await registerClientWithEmail(values);
      if (lastRegistrationEmailStatus?.welcomeEmailStatus === 'sent') {
        showToast(
          'success',
          'Account Created & Welcome Email Sent',
          `Welcome to Prithvi Editify, ${prof.displayName}! A welcome email has been sent to ${prof.email}.`
        );
      } else {
        showToast(
          'success',
          'Client Account Created',
          `Welcome to the Prithvi Editify Client Portal, ${prof.displayName}! Your account is ready.`
        );
      }
      navigate('/portal', { replace: true });
    } catch (err) {
      showToast(
        'error',
        'Registration Failed',
        err instanceof Error ? err.message : 'Unable to register account.'
      );
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-8 space-y-6 shadow-xl">
        <div>
          <img
            src={DEFAULT_STUDIO_LOGO_URL}
            alt="Prithvi Editify"
            className="h-12 w-auto rounded-md bg-white p-1 object-contain border border-[#1E3A5F] mb-3"
          />
          <p className="text-xs font-semibold text-[#10B981] uppercase tracking-wider">
            Prithvi Editify · Client Portal
          </p>
          <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC] mt-1">
            {mode === 'login' ? 'Sign in to Your Client Portal' : 'Create Client Portal Account'}
          </h1>
          <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
            Access your active projects, deliverables, timelines, and INR invoices.
          </p>
        </div>

        {/* Mode Switcher: Sign In vs Client Registration */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#132A4A] rounded-lg">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'login'
                ? 'bg-[#0D1F38] text-[#F8FAFC] shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
              mode === 'register'
                ? 'bg-[#0D1F38] text-[#F8FAFC] shadow-sm'
                : 'text-[#94A3B8] hover:text-[#F8FAFC]'
            }`}
          >
            Client Registration
          </button>
        </div>

        {/* Customer Google Account Selector Sign-In */}
        <button
          type="button"
          disabled={googleBusy}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg shadow-[0_8px_20px_-4px_rgba(16,185,129,0.4)] transition-all cursor-pointer disabled:opacity-60"
        >
          <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-xs font-bold text-[#040D1A] shrink-0">
            G
          </span>
          <span>{googleBusy ? 'Opening Google Account Selector...' : 'Continue with Google'}</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#1E3A5F]" />
          <span className="flex-shrink mx-3 text-[11px] text-[#94A3B8]">
            OR EMAIL ID & PASSWORD
          </span>
          <div className="flex-grow border-t border-[#1E3A5F]" />
        </div>

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onEmailLogin)} noValidate className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                {...loginForm.register('email')}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-[#DC2626] mt-1">
                  {loginForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-xs font-medium text-[#F8FAFC]">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] underline"
                >
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                {...loginForm.register('password')}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-[#DC2626] mt-1">
                  {loginForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#132A4A] hover:bg-[#1E3A5F] border border-[#10B981]/50 rounded-lg transition-colors cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#10B981]" />
              <span>
                {loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign In with Email & Password'}
              </span>
            </button>
          </form>
        ) : (
          <form
            onSubmit={registerForm.handleSubmit(onClientRegister)}
            noValidate
            className="space-y-4"
          >
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Full Name *
              </label>
              <input
                id="reg-name"
                type="text"
                {...registerForm.register('displayName')}
                placeholder="Your full name"
                className="w-full px-3.5 py-2 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
              {registerForm.formState.errors.displayName && (
                <p className="text-xs text-[#DC2626] mt-1">
                  {registerForm.formState.errors.displayName.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Email Address *
              </label>
              <input
                id="reg-email"
                type="email"
                {...registerForm.register('email')}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
              {registerForm.formState.errors.email && (
                <p className="text-xs text-[#DC2626] mt-1">
                  {registerForm.formState.errors.email.message}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="reg-phone"
                  className="block text-xs font-medium text-[#F8FAFC] mb-1"
                >
                  WhatsApp / Phone
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  {...registerForm.register('phone')}
                  placeholder="+91..."
                  className="w-full px-3 py-2 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
                />
              </div>
              <div>
                <label
                  htmlFor="reg-company"
                  className="block text-xs font-medium text-[#F8FAFC] mb-1"
                >
                  Company / Brand
                </label>
                <input
                  id="reg-company"
                  type="text"
                  {...registerForm.register('companyName')}
                  placeholder="Brand name"
                  className="w-full px-3 py-2 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-pass" className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Password (min 6 characters) *
              </label>
              <input
                id="reg-pass"
                type="password"
                {...registerForm.register('password')}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
              {registerForm.formState.errors.password && (
                <p className="text-xs text-[#DC2626] mt-1">
                  {registerForm.formState.errors.password.message}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={registerForm.formState.isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {registerForm.formState.isSubmitting
                  ? 'Creating Client Account...'
                  : 'Create Client Account'}
              </span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

/**
 * Private Studio Administrator Login Page (/admin-login)
 * Unlisted from all public navigation and strictly restricted to authorized admin emails:
 * - shankarbaluragi066@gmail.com (Primary Studio Owner)
 * - prithvieditify.official@gmail.com (Official Studio Administrator)
 */
export const AdminLoginPage: React.FC = () => {
  const { user, profile, isAdmin, loading, loginWithGoogle, loginWithEmail, logout } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [googleBusy, setGoogleBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const loginForm = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (!loading && user && profile) {
      if (isAdmin && isAuthorizedAdminEmail(user.email)) {
        navigate('/admin', { replace: true });
      }
    }
  }, [loading, user, profile, isAdmin, navigate]);

  const handleAdminGoogleSignIn = async () => {
    setAuthError(null);
    setGoogleBusy(true);
    try {
      const prof = await loginWithGoogle('/admin-login');
      if (prof.role === 'admin' && isAuthorizedAdminEmail(prof.email)) {
        showToast('success', 'Studio Admin Authenticated', `Welcome back, ${prof.displayName}`);
        navigate('/admin', { replace: true });
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('cancelled')) {
        return;
      }
      showToast(
        'error',
        'Google Sign-In Failed',
        err instanceof Error ? err.message : 'Unable to complete administrator sign-in.'
      );
    } finally {
      setGoogleBusy(false);
    }
  };

  const onAdminEmailLogin = async (values: LoginFormValues) => {
    setAuthError(null);
    const enteredEmail = values.email.trim().toLowerCase();
    if (!isAuthorizedAdminEmail(enteredEmail)) {
      setAuthError(
        'Access Denied: Unauthorized email address. Only authorized Prithvi Editify Studio Administrators may sign in here.'
      );
      showToast(
        'error',
        'Unauthorized Access',
        'Studio Administrator access is restricted to authorized administrator accounts.'
      );
      return;
    }

    try {
      const prof = await loginWithEmail(values.email, values.password);
      if (!isAuthorizedAdminEmail(prof.email) || prof.role !== 'admin') {
        await logout();
        setAuthError('Access Denied: Studio Administrator verification failed.');
        return;
      }
      showToast('success', 'Studio Admin Authenticated', `Welcome back, ${prof.displayName}`);
      navigate('/admin', { replace: true });
    } catch (err) {
      showToast(
        'error',
        'Administrator Sign-In Failed',
        err instanceof Error ? err.message : 'Invalid administrator credentials.'
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#040D1A] flex flex-col justify-center px-6 py-16">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            to="/"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#94A3B8] hover:text-white transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Public Studio</span>
          </Link>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#132A4A] text-[11px] font-mono text-[#2DD4BF]">
            <Lock className="w-3 h-3" />
            PRIVATE ADMIN ACCESS
          </span>
        </div>

        <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-8 space-y-6 shadow-xl">
          <div>
            <img
              src={DEFAULT_STUDIO_LOGO_URL}
              alt="Prithvi Editify"
              className="h-12 w-auto rounded-md bg-white p-1 object-contain border border-[#1E3A5F] mb-3"
            />
            <p className="text-xs font-semibold text-[#10B981] uppercase tracking-wider">
              Prithvi Editify · Restricted Gateway
            </p>
            <h1 className="font-editorial text-2xl font-semibold text-[#F8FAFC] mt-1">
              Studio Administrator Sign In
            </h1>
            <p className="text-xs text-[#94A3B8] mt-1.5 leading-relaxed">
              This unlisted portal is reserved exclusively for verified Prithvi Editify administrators. Client accounts must sign in via the public Client Portal.
            </p>
          </div>

          {authError && (
            <div className="p-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 flex items-start gap-2.5 text-xs text-[#DC2626]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{authError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={googleBusy}
            onClick={handleAdminGoogleSignIn}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors disabled:opacity-60"
          >
            <ShieldCheck className="w-4 h-4 text-[#10B981]" />
            <span>
              {googleBusy
                ? 'Verifying Admin Google Account...'
                : 'Sign In with Authorized Admin Google Account'}
            </span>
          </button>

          <div className="relative flex py-1 items-center">
            <div className="flex-grow border-t border-[#1E3A5F]" />
            <span className="flex-shrink mx-3 text-[11px] text-[#94A3B8]">OR ADMIN CREDENTIALS</span>
            <div className="flex-grow border-t border-[#1E3A5F]" />
          </div>

          <form onSubmit={loginForm.handleSubmit(onAdminEmailLogin)} noValidate className="space-y-4">
            <div>
              <label htmlFor="admin-email" className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Administrator Email
              </label>
              <input
                id="admin-email"
                type="email"
                autoComplete="username"
                {...loginForm.register('email')}
                placeholder="Authorized administrator email"
                className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-[#DC2626] mt-1">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="admin-password" className="block text-xs font-medium text-[#F8FAFC]">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs text-[#94A3B8] hover:text-[#F8FAFC] underline">
                  Reset admin password
                </Link>
              </div>
              <input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                {...loginForm.register('password')}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-[#DC2626] mt-1">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors"
            >
              <Lock className="w-4 h-4" />
              <span>{loginForm.formState.isSubmitting ? 'Verifying Administrator...' : 'Unlock Studio Admin Console'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const { sendResetLink } = useAuth();
  const { showToast } = useToast();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !cleanEmail.includes('@')) {
      setErrorMessage('Please enter a valid registered email address.');
      return;
    }
    setBusy(true);
    setErrorMessage(null);
    try {
      await sendResetLink(cleanEmail);
      setSent(true);
      showToast(
        'success',
        'Password Reset Requested',
        'If an account exists for that email, reset instructions have been sent.'
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to process password-reset request.';
      setErrorMessage(msg);
      showToast('error', 'Reset Request Failed', msg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-lg p-8 space-y-5">
        <div className="flex items-center gap-2.5 text-[#F8FAFC]">
          <KeyRound className="w-5 h-5 text-[#10B981]" />
          <h1 className="font-editorial text-2xl font-semibold">Reset Password</h1>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed">
          Enter the email address associated with your Prithvi Editify account. We will send a secure password-reset link directly to your registered email address via Supabase Auth.
        </p>

        {errorMessage && (
          <div className="p-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 flex items-start gap-2.5 text-xs text-[#DC2626]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {sent ? (
          <div className="bg-[#132A4A] border border-[#1E3A5F] rounded-lg p-5 text-xs text-[#F8FAFC] space-y-3">
            <div className="flex items-center gap-2 text-[#10B981] font-semibold">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Password-Reset Instructions Dispatched</span>
            </div>
            <p className="text-[#CBD5E1] leading-relaxed">
              If an account exists for <span className="font-semibold text-white">{email.trim()}</span>, a password-reset link has been sent to that email address. Please open the link in your email to set your new password.
            </p>
            <div className="pt-2 flex items-center justify-between border-t border-[#1E3A5F]">
              <Link to="/login" className="inline-block font-semibold text-[#10B981] hover:underline">
                ← Return to Sign In
              </Link>
              <button
                type="button"
                onClick={() => {
                  setSent(false);
                  setErrorMessage(null);
                }}
                className="text-[#94A3B8] hover:text-white underline cursor-pointer"
              >
                Use another email
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-medium text-[#F8FAFC] mb-1">
                Registered Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="reset-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {busy ? 'Requesting Reset Link...' : 'Send Password Reset Link'}
            </button>
            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-[#94A3B8] hover:text-[#F8FAFC]">
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

/**
 * Customer Password Reset Completion Page (/reset-password)
 * Validates Supabase Auth recovery session, updates the user's password via
 * supabase.auth.updateUser({ password }), and triggers the verified password-changed
 * notification only after completion.
 */
export const ResetPasswordPage: React.FC = () => {
  const { user, completePasswordReset } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [recoveryReady, setRecoveryReady] = useState<boolean>(!isSupabaseConfigured);
  const [checkingSession, setCheckingSession] = useState<boolean>(isSupabaseConfigured);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash || '';
      const search = window.location.search || '';
      const combined = `${hash}&${search}`;
      if (combined.includes('error=') || combined.includes('error_description=')) {
        const params = new URLSearchParams(hash.replace(/^#/, '') || search.replace(/^\?/, ''));
        const desc =
          params.get('error_description') ||
          'This password-reset link is invalid or has expired. Please request a new reset link.';
        setLinkError(desc.replace(/\+/g, ' '));
        setCheckingSession(false);
        return;
      }
    }

    if (!isSupabaseConfigured) {
      setRecoveryReady(true);
      setCheckingSession(false);
      return;
    }

    let mounted = true;

    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (!mounted) return;
      if (error) {
        setLinkError(error.message);
      } else if (session?.user) {
        setRecoveryReady(true);
      }
      setCheckingSession(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      if (event === 'PASSWORD_RECOVERY' || (event === 'SIGNED_IN' && session?.user)) {
        setRecoveryReady(true);
        setLinkError(null);
        setCheckingSession(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (newPassword.length < 6) {
      setFormError('Your new password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setFormError('Passwords do not match. Please confirm your new password.');
      return;
    }

    setSubmitting(true);
    try {
      await completePasswordReset(newPassword, user?.email || undefined);
      setCompleted(true);
      showToast(
        'success',
        'Password Updated Successfully',
        'Your Prithvi Editify account password has been updated.'
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Unable to update password. Your reset link may have expired.';
      setFormError(msg);
      showToast('error', 'Password Update Failed', msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="pe-card-interactive bg-[#0D1F38] border border-[#1E3A5F] rounded-xl p-8 space-y-5 shadow-xl">
        <div className="flex items-center gap-2.5 text-[#F8FAFC]">
          <KeyRound className="w-5 h-5 text-[#10B981]" />
          <h1 className="font-editorial text-2xl font-semibold">Set New Password</h1>
        </div>

        {checkingSession ? (
          <div className="py-6 text-xs text-[#94A3B8] text-center">
            Verifying your password-reset session...
          </div>
        ) : completed ? (
          <div className="bg-[#132A4A] border border-[#10B981]/40 rounded-lg p-5 space-y-4 text-xs">
            <div className="flex items-center gap-2 text-[#10B981] font-semibold text-sm">
              <CheckCircle2 className="w-5 h-5 shrink-0" />
              <span>Password Updated Successfully</span>
            </div>
            <p className="text-[#CBD5E1] leading-relaxed">
              Your Prithvi Editify account password has been securely updated. You can now access your Client Portal.
            </p>
            <div className="pt-2 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => navigate('/portal', { replace: true })}
                className="px-4 py-2.5 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] rounded-lg cursor-pointer"
              >
                Continue to Client Portal
              </button>
              <Link
                to="/login"
                className="px-4 py-2.5 text-xs font-semibold text-[#F8FAFC] bg-[#0D1F38] border border-[#1E3A5F] rounded-lg"
              >
                Return to Sign In
              </Link>
            </div>
          </div>
        ) : linkError || (!recoveryReady && !user) ? (
          <div className="bg-[#132A4A] border border-[#DC2626]/40 rounded-lg p-5 space-y-4 text-xs">
            <div className="flex items-start gap-2.5 text-[#DC2626]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Invalid or Expired Password-Reset Link</p>
                <p className="text-[#CBD5E1] mt-1 leading-relaxed">
                  {linkError ||
                    'We could not verify an active password-reset session. Please request a fresh password-reset email and open the link directly from your inbox.'}
                </p>
              </div>
            </div>
            <div className="pt-2 flex items-center justify-between border-t border-[#1E3A5F]">
              <Link
                to="/forgot-password"
                className="px-4 py-2 text-xs font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] rounded-lg"
              >
                Request New Reset Link
              </Link>
              <Link to="/login" className="text-xs text-[#94A3B8] hover:text-white">
                ← Back to Sign In
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-4">
            <p className="text-xs text-[#94A3B8] leading-relaxed">
              Enter and confirm your new password below to complete your password reset.
            </p>

            {formError && (
              <div className="p-3.5 rounded-lg bg-[#DC2626]/10 border border-[#DC2626]/30 flex items-start gap-2.5 text-xs text-[#DC2626]">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            <div>
              <label htmlFor="new-password" className="block text-xs font-medium text-[#F8FAFC] mb-1">
                New Password (min 6 characters) *
              </label>
              <input
                id="new-password"
                type="password"
                required
                minLength={6}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
            </div>

            <div>
              <label
                htmlFor="confirm-password"
                className="block text-xs font-medium text-[#F8FAFC] mb-1"
              >
                Confirm New Password *
              </label>
              <input
                id="confirm-password"
                type="password"
                required
                minLength={6}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-[#132A4A]/60 border border-[#1E3A5F] rounded-lg focus:outline-none focus:border-[#10B981]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 text-sm font-semibold text-white bg-gradient-to-r from-[#0EA5E9] to-[#10B981] hover:opacity-95 rounded-lg transition-colors cursor-pointer disabled:opacity-60"
            >
              {submitting ? 'Updating Password...' : 'Save New Password'}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

