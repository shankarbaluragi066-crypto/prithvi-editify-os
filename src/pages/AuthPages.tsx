import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { LogIn, UserPlus, KeyRound, ShieldCheck } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import {
  loginSchema,
  LoginFormValues,
  registerSchema,
  RegisterFormValues,
} from '../schemas/validation';
import { STUDIO_OWNER_EMAIL } from '../lib/supabaseClient';

export const LoginPage: React.FC = () => {
  const { user, profile, isAdmin, loading, loginWithGoogle, loginWithEmail, registerClientWithEmail } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [googleBusy, setGoogleBusy] = useState(false);

  useEffect(() => {
    if (!loading && user && profile) {
      navigate(isAdmin ? '/admin' : '/portal', { replace: true });
    }
  }, [loading, user, profile, isAdmin, navigate]);

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
      const prof = await loginWithGoogle();
      showToast('success', 'Signed In', `Welcome back, ${prof.displayName}`);
      navigate(prof.role === 'admin' ? '/admin' : '/portal');
    } catch (err) {
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
      showToast('success', 'Signed In', `Welcome back, ${prof.displayName}`);
      navigate(prof.role === 'admin' ? '/admin' : '/portal');
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
      showToast(
        'success',
        'Client Account Created',
        'A verification email has been sent. Welcome to the Prithvi Editify Client Portal.'
      );
      navigate(prof.role === 'admin' ? '/admin' : '/portal');
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
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-8 space-y-6">
        <div>
          <p className="text-xs font-semibold text-[#6E7785]">Prithvi Editify Workspace</p>
          <h1 className="font-editorial text-2xl font-semibold text-[#172333] mt-1">
            {mode === 'login' ? 'Sign in to Portal' : 'Create Client Portal Account'}
          </h1>
          <p className="text-xs text-[#6E7785] mt-1.5 leading-relaxed">
            Access your projects, deliverables, timelines, and INR invoices.
          </p>
        </div>

        {/* Mode Switcher */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-[#F5F5F1] rounded-lg">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'login' ? 'bg-white text-[#172333] shadow-sm' : 'text-[#6E7785] hover:text-[#172333]'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2 text-xs font-semibold rounded-md transition-colors ${
              mode === 'register' ? 'bg-white text-[#172333] shadow-sm' : 'text-[#6E7785] hover:text-[#172333]'
            }`}
          >
            Client Registration
          </button>
        </div>

        {/* Google Sign-In (Primary Provisioned Method) */}
        <button
          type="button"
          disabled={googleBusy}
          onClick={handleGoogleSignIn}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors disabled:opacity-60"
        >
          <ShieldCheck className="w-4 h-4 text-[#F18A45]" />
          <span>{googleBusy ? 'Connecting to Google...' : 'Continue with Google'}</span>
        </button>

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-[#E2E4DF]" />
          <span className="flex-shrink mx-3 text-[11px] text-[#6E7785]">OR EMAIL & PASSWORD</span>
          <div className="flex-grow border-t border-[#E2E4DF]" />
        </div>

        {mode === 'login' ? (
          <form onSubmit={loginForm.handleSubmit(onEmailLogin)} noValidate className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-medium text-[#172333] mb-1">
                Email Address
              </label>
              <input
                id="login-email"
                type="email"
                {...loginForm.register('email')}
                placeholder="you@example.com"
                className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
              />
              {loginForm.formState.errors.email && (
                <p className="text-xs text-[#B93832] mt-1">{loginForm.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="login-password" className="block text-xs font-medium text-[#172333]">
                  Password
                </label>
                <Link to="/forgot-password" className="text-xs text-[#6E7785] hover:text-[#172333] underline">
                  Forgot password?
                </Link>
              </div>
              <input
                id="login-password"
                type="password"
                {...loginForm.register('password')}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg focus:outline-none focus:border-[#172333]"
              />
              {loginForm.formState.errors.password && (
                <p className="text-xs text-[#B93832] mt-1">{loginForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={loginForm.formState.isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors"
            >
              <LogIn className="w-4 h-4" />
              <span>{loginForm.formState.isSubmitting ? 'Signing in...' : 'Sign In with Email'}</span>
            </button>
          </form>
        ) : (
          <form onSubmit={registerForm.handleSubmit(onClientRegister)} noValidate className="space-y-4">
            <div>
              <label htmlFor="reg-name" className="block text-xs font-medium text-[#172333] mb-1">
                Full Name *
              </label>
              <input
                id="reg-name"
                type="text"
                {...registerForm.register('displayName')}
                placeholder="Your full name"
                className="w-full px-3.5 py-2 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg"
              />
              {registerForm.formState.errors.displayName && (
                <p className="text-xs text-[#B93832] mt-1">{registerForm.formState.errors.displayName.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="reg-email" className="block text-xs font-medium text-[#172333] mb-1">
                Email Address *
              </label>
              <input
                id="reg-email"
                type="email"
                {...registerForm.register('email')}
                placeholder="you@company.com"
                className="w-full px-3.5 py-2 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg"
              />
              {registerForm.formState.errors.email && (
                <p className="text-xs text-[#B93832] mt-1">{registerForm.formState.errors.email.message}</p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="reg-phone" className="block text-xs font-medium text-[#172333] mb-1">
                  WhatsApp / Phone
                </label>
                <input
                  id="reg-phone"
                  type="tel"
                  {...registerForm.register('phone')}
                  placeholder="+91..."
                  className="w-full px-3 py-2 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg"
                />
              </div>
              <div>
                <label htmlFor="reg-company" className="block text-xs font-medium text-[#172333] mb-1">
                  Company / Brand
                </label>
                <input
                  id="reg-company"
                  type="text"
                  {...registerForm.register('companyName')}
                  placeholder="Brand name"
                  className="w-full px-3 py-2 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg"
                />
              </div>
            </div>

            <div>
              <label htmlFor="reg-pass" className="block text-xs font-medium text-[#172333] mb-1">
                Password (min 8 characters) *
              </label>
              <input
                id="reg-pass"
                type="password"
                {...registerForm.register('password')}
                placeholder="••••••••"
                className="w-full px-3.5 py-2 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg"
              />
              {registerForm.formState.errors.password && (
                <p className="text-xs text-[#B93832] mt-1">{registerForm.formState.errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={registerForm.formState.isSubmitting}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-[#172333] bg-[#F18A45] hover:bg-[#e07934] rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span>{registerForm.formState.isSubmitting ? 'Creating Account...' : 'Create Client Account'}</span>
            </button>
          </form>
        )}

        <div className="pt-4 border-t border-[#E2E4DF] text-[11px] text-[#6E7785] space-y-1">
          <p>
            <span className="font-semibold text-[#172333]">Role Security:</span> All self-registered accounts receive the{' '}
            <span className="font-mono text-[#172333]">client</span> role enforced by Supabase Row Level Security (RLS).
          </p>
          <p>
            Studio Administrator access is strictly restricted to verified studio owner{' '}
            <span className="font-mono text-[#172333]">{STUDIO_OWNER_EMAIL}</span>.
          </p>
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    try {
      await sendResetLink(email);
      setSent(true);
      showToast('success', 'Reset Link Dispatched', 'Check your inbox for password reset instructions.');
    } catch (err) {
      showToast(
        'error',
        'Reset Failed',
        err instanceof Error ? err.message : 'Unable to send reset email.'
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <div className="bg-white border border-[#E2E4DF] rounded-lg p-8 space-y-5">
        <div className="flex items-center gap-2.5 text-[#172333]">
          <KeyRound className="w-5 h-5 text-[#F18A45]" />
          <h1 className="font-editorial text-2xl font-semibold">Reset Password</h1>
        </div>
        <p className="text-xs text-[#6E7785] leading-relaxed">
          Enter the email address associated with your Prithvi Editify portal account and we will send a Supabase password reset link.
        </p>

        {sent ? (
          <div className="bg-[#F5F5F1] border border-[#E2E4DF] rounded-lg p-4 text-xs text-[#172333] space-y-3">
            <p>
              If an account exists for <span className="font-semibold">{email}</span>, a password reset link has been sent.
            </p>
            <Link to="/login" className="inline-block font-semibold text-[#F18A45] hover:underline">
              ← Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="reset-email" className="block text-xs font-medium text-[#172333] mb-1">
                Email Address
              </label>
              <input
                id="reset-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3.5 py-2.5 text-sm bg-[#F5F5F1]/60 border border-[#E2E4DF] rounded-lg"
              />
            </div>
            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 text-sm font-semibold text-white bg-[#172333] hover:bg-[#24364A] rounded-lg transition-colors"
            >
              {busy ? 'Sending...' : 'Send Reset Link'}
            </button>
            <div className="text-center pt-2">
              <Link to="/login" className="text-xs text-[#6E7785] hover:text-[#172333]">
                ← Back to Sign In
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};
