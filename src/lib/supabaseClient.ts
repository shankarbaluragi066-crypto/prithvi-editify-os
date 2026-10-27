import { createClient } from '@supabase/supabase-js';

const DEFAULT_SUPABASE_URL = 'https://kjsnawvgctdsikexzjfp.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_QIkiS3KZxMr5ct9Y7CrfDQ_ZAt4j42V';

const envUrl = (import.meta.env?.VITE_SUPABASE_URL || '').trim();
const envKey = (
  import.meta.env?.VITE_SUPABASE_PUBLISHABLE_KEY ||
  import.meta.env?.VITE_SUPABASE_ANON_KEY ||
  ''
).trim();

export const supabaseUrl =
  envUrl && !envUrl.includes('YOUR_SUPABASE') && !envUrl.includes('YOUR_PROJECT_REF')
    ? envUrl
    : DEFAULT_SUPABASE_URL;

export const supabasePublishableKey =
  envKey && !envKey.includes('YOUR_SUPABASE')
    ? envKey
    : DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    supabaseUrl.startsWith('http')
);

export const supabase = createClient(
  isSupabaseConfigured ? supabaseUrl : 'https://placeholder-project.supabase.co',
  isSupabaseConfigured ? supabasePublishableKey : 'placeholder-publishable-key',
  {
    auth: {
      persistSession: isSupabaseConfigured,
      autoRefreshToken: isSupabaseConfigured,
      detectSessionInUrl: isSupabaseConfigured,
    },
  }
);

export const STUDIO_OWNER_EMAIL = 'shankarbaluragi066@gmail.com';
export const STUDIO_OFFICIAL_ADMIN_EMAIL = 'prithvieditify.official@gmail.com';

export const AUTHORIZED_ADMIN_EMAILS: readonly string[] = [
  STUDIO_OWNER_EMAIL,
  STUDIO_OFFICIAL_ADMIN_EMAIL,
];

export function isAuthorizedAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  const normalized = email.trim().toLowerCase();
  return AUTHORIZED_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalized);
}

export const LOCAL_GOOGLE_SESSION_KEY = 'pe_google_auth_session_v1';

type SchemaStatusListener = (missing: boolean) => void;
let missingSchemaDetected = false;
const schemaListeners = new Set<SchemaStatusListener>();

export function getMissingSchemaStatus(): boolean {
  return missingSchemaDetected;
}

export function subscribeMissingSchemaStatus(listener: SchemaStatusListener): () => void {
  schemaListeners.add(listener);
  return () => {
    schemaListeners.delete(listener);
  };
}

export function markMissingSchemaDetected(): void {
  if (!missingSchemaDetected) {
    missingSchemaDetected = true;
    schemaListeners.forEach((fn) => fn(true));
  }
}

export function isMissingSchemaError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const code = String((error as { code?: unknown }).code || '');
  const message = String((error as { message?: unknown }).message || '').toLowerCase();
  if (
    code === 'PGRST205' ||
    code === '42P01' ||
    code === '42703' ||
    code === 'PGRST204' ||
    (code === '42501' && message.includes('is_admin'))
  ) {
    markMissingSchemaDetected();
    return true;
  }
  if (
    message.includes('schema cache') ||
    message.includes('does not exist') ||
    message.includes('could not find the table') ||
    message.includes('permission denied for function is_admin')
  ) {
    markMissingSchemaDetected();
    return true;
  }
  return false;
}

export function handleSupabaseError(error: unknown, context: string): never {
  if (isMissingSchemaError(error)) {
    throw new Error(
      `Supabase database schema is not yet migrated (${context}). Click "Copy SQL Migration Script" in the top banner and run it in your Supabase SQL Editor.`
    );
  }
  const message =
    error && typeof error === 'object' && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error);
  console.error(`Supabase Error [${context}]:`, error);
  throw new Error(`${context}: ${message}`);
}
