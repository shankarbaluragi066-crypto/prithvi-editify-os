import {
  STUDIO_OWNER_EMAIL,
  STUDIO_OFFICIAL_ADMIN_EMAIL,
  AUTHORIZED_ADMIN_EMAILS,
  supabase,
  isSupabaseConfigured,
} from '../lib/supabaseClient';

export interface AdminEmailNotificationPreferences {
  primaryOwnerEmail: string;
  officialAdminEmail: string;
  enableCustomerWelcomeEmail: boolean;
  notifyAdminsOnRegistration: boolean;
  notifyAdminsOnPasswordResetRequest: boolean;
  notifyAdminsOnPasswordChanged: boolean;
  notifyPrimaryOwner: boolean;
  notifyOfficialAdmin: boolean;
  updatedAt: string;
}

export interface EmailDeliveryAuditEntry {
  id: string;
  idempotencyKey: string;
  eventType:
    | 'customer_welcome'
    | 'admin_new_registration'
    | 'admin_password_reset_request'
    | 'password_changed_confirmation';
  recipientEmail: string;
  subject: string;
  status: 'sent' | 'queued_relay' | 'pending_provider_config' | 'deduplicated' | 'failed';
  provider: string;
  note?: string;
  timestamp: string;
}

export interface RegistrationEmailDispatchResult {
  welcomeEmailStatus: 'sent' | 'pending_provider_config' | 'already_sent' | 'failed';
  adminNotificationStatus: 'sent' | 'queued_relay' | 'already_sent' | 'failed';
  message: string;
}

const ADMIN_EMAIL_PREFS_KEY = 'pe_admin_email_notification_prefs_v1';
const EMAIL_AUDIT_LOGS_KEY = 'pe_email_delivery_audit_logs_v1';
const WELCOME_SENT_REGISTRY_KEY = 'pe_welcome_email_sent_registry_v1';
const RESET_RATE_LIMIT_KEY = 'pe_password_reset_rate_limit_v1';

const RESET_NOTIFICATION_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes per email

export const DEFAULT_ADMIN_EMAIL_PREFS: AdminEmailNotificationPreferences = {
  primaryOwnerEmail: STUDIO_OWNER_EMAIL,
  officialAdminEmail: STUDIO_OFFICIAL_ADMIN_EMAIL,
  enableCustomerWelcomeEmail: true,
  notifyAdminsOnRegistration: true,
  notifyAdminsOnPasswordResetRequest: true,
  notifyAdminsOnPasswordChanged: true,
  notifyPrimaryOwner: true,
  notifyOfficialAdmin: true,
  updatedAt: new Date().toISOString(),
};

export function getAdminEmailNotificationSettings(): AdminEmailNotificationPreferences {
  if (typeof window === 'undefined') return DEFAULT_ADMIN_EMAIL_PREFS;
  try {
    const raw = window.localStorage.getItem(ADMIN_EMAIL_PREFS_KEY);
    if (!raw) return DEFAULT_ADMIN_EMAIL_PREFS;
    const parsed = JSON.parse(raw) as Partial<AdminEmailNotificationPreferences>;
    return {
      ...DEFAULT_ADMIN_EMAIL_PREFS,
      ...parsed,
      primaryOwnerEmail: STUDIO_OWNER_EMAIL,
      officialAdminEmail: STUDIO_OFFICIAL_ADMIN_EMAIL,
    };
  } catch {
    return DEFAULT_ADMIN_EMAIL_PREFS;
  }
}

export function saveAdminEmailNotificationSettings(
  prefs: Partial<AdminEmailNotificationPreferences>
): AdminEmailNotificationPreferences {
  const current = getAdminEmailNotificationSettings();
  const updated: AdminEmailNotificationPreferences = {
    ...current,
    ...prefs,
    primaryOwnerEmail: STUDIO_OWNER_EMAIL,
    officialAdminEmail: STUDIO_OFFICIAL_ADMIN_EMAIL,
    updatedAt: new Date().toISOString(),
  };
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.setItem(ADMIN_EMAIL_PREFS_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage quota errors
    }
  }
  return updated;
}

export function getActiveAdminNotificationRecipients(): string[] {
  const prefs = getAdminEmailNotificationSettings();
  const recipients: string[] = [];
  if (prefs.notifyOfficialAdmin) {
    recipients.push(STUDIO_OFFICIAL_ADMIN_EMAIL);
  }
  if (prefs.notifyPrimaryOwner) {
    recipients.push(STUDIO_OWNER_EMAIL);
  }
  return recipients.length > 0 ? Array.from(new Set(recipients)) : [...AUTHORIZED_ADMIN_EMAILS];
}

export function getEmailDeliveryAuditLogs(): EmailDeliveryAuditEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(EMAIL_AUDIT_LOGS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordEmailDeliveryAudit(
  entry: Omit<EmailDeliveryAuditEntry, 'id' | 'timestamp'>
): void {
  if (typeof window === 'undefined') return;
  try {
    const nextEntry: EmailDeliveryAuditEntry = {
      ...entry,
      id: `email_audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    const existing = getEmailDeliveryAuditLogs();
    const updated = [nextEntry, ...existing].slice(0, 100);
    window.localStorage.setItem(EMAIL_AUDIT_LOGS_KEY, JSON.stringify(updated));
  } catch {
    // Ignore storage errors
  }
}

function hasWelcomeEmailAlreadyBeenSent(email: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const raw = window.localStorage.getItem(WELCOME_SENT_REGISTRY_KEY);
    if (!raw) return false;
    const map = JSON.parse(raw) as Record<string, string>;
    return Boolean(map[email.trim().toLowerCase()]);
  } catch {
    return false;
  }
}

function markWelcomeEmailSent(email: string): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(WELCOME_SENT_REGISTRY_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, string>) : {};
    map[email.trim().toLowerCase()] = new Date().toISOString();
    window.localStorage.setItem(WELCOME_SENT_REGISTRY_KEY, JSON.stringify(map));
  } catch {
    // Ignore storage errors
  }
}

export function checkPasswordResetCooldown(email: string): {
  allowed: boolean;
  retryAfterSeconds?: number;
} {
  if (typeof window === 'undefined') return { allowed: true };
  try {
    const cleanEmail = email.trim().toLowerCase();
    const raw = window.localStorage.getItem(RESET_RATE_LIMIT_KEY);
    const map = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    const lastSent = map[cleanEmail] || 0;
    const elapsed = Date.now() - lastSent;
    if (lastSent > 0 && elapsed < RESET_NOTIFICATION_COOLDOWN_MS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil((RESET_NOTIFICATION_COOLDOWN_MS - elapsed) / 1000),
      };
    }
    map[cleanEmail] = Date.now();
    window.localStorage.setItem(RESET_RATE_LIMIT_KEY, JSON.stringify(map));
    return { allowed: true };
  } catch {
    return { allowed: true };
  }
}

/**
 * Triggers the idempotent server-side Customer Welcome Email + Admin Registration Notification
 * (`prithvieditify.official@gmail.com` & `shankarbaluragi066@gmail.com`).
 */
export async function triggerNewCustomerRegistrationEmails(params: {
  customerId: string;
  customerName?: string;
  customerEmail: string;
  emailVerified?: boolean;
  registrationTimestamp?: string;
}): Promise<RegistrationEmailDispatchResult> {
  const cleanEmail = params.customerEmail.trim().toLowerCase();
  const cleanName = (params.customerName || '').trim();
  const timestamp = params.registrationTimestamp || new Date().toISOString();
  const idempotencyKey = `welcome:${cleanEmail}`;

  // 1. Client-side idempotency guard to avoid duplicate calls on refresh/re-login
  if (hasWelcomeEmailAlreadyBeenSent(cleanEmail)) {
    return {
      welcomeEmailStatus: 'already_sent',
      adminNotificationStatus: 'already_sent',
      message: 'Welcome email already processed for this account.',
    };
  }

  const prefs = getAdminEmailNotificationSettings();
  const adminRecipients = getActiveAdminNotificationRecipients();

  let welcomeEmailStatus: RegistrationEmailDispatchResult['welcomeEmailStatus'] =
    'pending_provider_config';
  let adminNotificationStatus: RegistrationEmailDispatchResult['adminNotificationStatus'] =
    'failed';

  // 2. Call server-side endpoint (/api/auth/events/registration) or Netlify function (/.netlify/functions/auth-email-events)
  const endpoints = ['/api/auth/events/registration', '/.netlify/functions/auth-email-events'];

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'registration',
          idempotencyKey,
          customerId: params.customerId,
          customerName: cleanName,
          customerEmail: cleanEmail,
          emailVerified: Boolean(params.emailVerified),
          registrationTimestamp: timestamp,
          adminRecipients,
          enableCustomerWelcomeEmail: prefs.enableCustomerWelcomeEmail,
          notifyAdminsOnRegistration: prefs.notifyAdminsOnRegistration,
        }),
      });

      if (response.ok) {
        const data = (await response.json().catch(() => ({}))) as {
          welcomeEmailStatus?: RegistrationEmailDispatchResult['welcomeEmailStatus'];
          adminNotificationStatus?: RegistrationEmailDispatchResult['adminNotificationStatus'];
          provider?: string;
        };
        if (data.welcomeEmailStatus) {
          welcomeEmailStatus = data.welcomeEmailStatus;
        }
        if (data.adminNotificationStatus) {
          adminNotificationStatus = data.adminNotificationStatus;
        }
        break;
      }
    } catch {
      // Try next endpoint or fallback
    }
  }

  // 3. If Supabase Edge Function is deployed, invoke it non-blockingly as well
  if (isSupabaseConfigured && welcomeEmailStatus === 'pending_provider_config') {
    try {
      const { data, error } = await supabase.functions.invoke('auth-email-events', {
        body: {
          eventType: 'registration',
          idempotencyKey,
          customerId: params.customerId,
          customerName: cleanName,
          customerEmail: cleanEmail,
          registrationTimestamp: timestamp,
          adminRecipients,
        },
      });
      if (!error && data?.welcomeEmailStatus === 'sent') {
        welcomeEmailStatus = 'sent';
        adminNotificationStatus = 'sent';
      }
    } catch {
      // Edge function optional if server/Netlify handles it
    }
  }

  // 4. Fallback administrative notification relay to prithvieditify.official@gmail.com & shankarbaluragi066@gmail.com
  // if server did not confirm admin notification dispatch
  if (prefs.notifyAdminsOnRegistration && adminNotificationStatus === 'failed') {
    for (const adminEmail of adminRecipients) {
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            _subject: 'Prithvi Editify — New Customer Registration',
            _template: 'table',
            _captcha: 'false',
            Notification: 'A new customer has registered on the Prithvi Editify website.',
            Customer_Name: cleanName || 'Not provided',
            Customer_Email: cleanEmail,
            Registration_Time: timestamp,
            Action_Required: 'Open the admin dashboard to review the customer account.',
          }),
        });
        if (res.ok) {
          adminNotificationStatus = 'queued_relay';
        }
      } catch {
        // Non-blocking
      }
    }
  }

  markWelcomeEmailSent(cleanEmail);

  recordEmailDeliveryAudit({
    idempotencyKey,
    eventType: 'customer_welcome',
    recipientEmail: cleanEmail,
    subject: 'Welcome to Prithvi Editify!',
    status: welcomeEmailStatus === 'sent' ? 'sent' : 'pending_provider_config',
    provider: welcomeEmailStatus === 'sent' ? 'transactional_api' : 'supabase_auth_or_pending_key',
    note:
      welcomeEmailStatus === 'sent'
        ? 'Welcome email dispatched via configured transactional email provider.'
        : 'Account created. Configure RESEND_API_KEY in server/Supabase secrets to enable custom HTML welcome email delivery.',
  });

  for (const adminEmail of adminRecipients) {
    recordEmailDeliveryAudit({
      idempotencyKey: `admin_reg:${adminEmail}:${cleanEmail}`,
      eventType: 'admin_new_registration',
      recipientEmail: adminEmail,
      subject: 'Prithvi Editify — New Customer Registration',
      status:
        adminNotificationStatus === 'sent'
          ? 'sent'
          : adminNotificationStatus === 'queued_relay'
          ? 'queued_relay'
          : 'failed',
      provider: adminNotificationStatus === 'sent' ? 'transactional_api' : 'formsubmit_relay',
    });
  }

  return {
    welcomeEmailStatus,
    adminNotificationStatus,
    message:
      welcomeEmailStatus === 'sent'
        ? 'Welcome email sent to your registered email address.'
        : 'Account created successfully.',
  };
}

/**
 * Sends an informational security notification to `prithvieditify.official@gmail.com`
 * (and preserved admin recipients) when a password-reset request is submitted.
 * NEVER includes any password, reset token, authentication token, or reset link.
 */
export async function triggerPasswordResetRequestAdminNotification(params: {
  customerEmail: string;
  requestTimestamp?: string;
}): Promise<{ notified: boolean; rateLimited?: boolean }> {
  const cleanEmail = params.customerEmail.trim().toLowerCase();
  const timestamp = params.requestTimestamp || new Date().toISOString();

  const cooldown = checkPasswordResetCooldown(cleanEmail);
  if (!cooldown.allowed) {
    recordEmailDeliveryAudit({
      idempotencyKey: `pw_reset_req_dedup:${cleanEmail}:${Math.floor(Date.now() / RESET_NOTIFICATION_COOLDOWN_MS)}`,
      eventType: 'admin_password_reset_request',
      recipientEmail: STUDIO_OFFICIAL_ADMIN_EMAIL,
      subject: 'Prithvi Editify — Password Reset Request',
      status: 'deduplicated',
      provider: 'rate_limiter',
      note: 'Suppressed duplicate password-reset admin alert within cooldown window.',
    });
    return { notified: false, rateLimited: true };
  }

  const prefs = getAdminEmailNotificationSettings();
  if (!prefs.notifyAdminsOnPasswordResetRequest) {
    return { notified: false };
  }

  const adminRecipients = getActiveAdminNotificationRecipients();
  const idempotencyKey = `pw_reset_req:${cleanEmail}:${Math.floor(Date.now() / RESET_NOTIFICATION_COOLDOWN_MS)}`;
  let notified = false;

  const endpoints = [
    '/api/auth/events/password-reset-requested',
    '/.netlify/functions/auth-email-events',
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'password_reset_requested',
          idempotencyKey,
          customerEmail: cleanEmail,
          requestTimestamp: timestamp,
          source: 'Prithvi Editify website',
          adminRecipients,
        }),
      });
      if (res.ok) {
        notified = true;
        break;
      }
    } catch {
      // Try next endpoint
    }
  }

  if (!notified) {
    for (const adminEmail of adminRecipients) {
      try {
        const res = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            _subject: 'Prithvi Editify — Password Reset Request',
            _template: 'table',
            _captcha: 'false',
            Notice: 'A password-reset request was submitted on the Prithvi Editify website.',
            Customer_Email: cleanEmail,
            Request_Time: timestamp,
            Source: 'Prithvi Editify website',
            Security_Note:
              'This is an informational security notification. The customer must use the password-reset email sent to their own registered address to complete the process.',
          }),
        });
        if (res.ok) {
          notified = true;
        }
      } catch {
        // Non-blocking
      }
    }
  }

  for (const adminEmail of adminRecipients) {
    recordEmailDeliveryAudit({
      idempotencyKey: `${idempotencyKey}:${adminEmail}`,
      eventType: 'admin_password_reset_request',
      recipientEmail: adminEmail,
      subject: 'Prithvi Editify — Password Reset Request',
      status: notified ? 'queued_relay' : 'failed',
      provider: 'server_notification',
      note: 'Informational reset-request notification (no tokens or secrets included).',
    });
  }

  return { notified };
}

/**
 * Triggered ONLY after a customer actually completes a password update via a valid
 * Supabase recovery session (`supabase.auth.updateUser({ password })`).
 * Never includes the new password or any authentication secret.
 */
export async function triggerPasswordChangedNotification(params: {
  customerEmail: string;
  changedAt?: string;
}): Promise<void> {
  const cleanEmail = params.customerEmail.trim().toLowerCase();
  if (!cleanEmail) return;
  const changedAt = params.changedAt || new Date().toISOString();
  const prefs = getAdminEmailNotificationSettings();
  const adminRecipients = prefs.notifyAdminsOnPasswordChanged
    ? getActiveAdminNotificationRecipients()
    : [];
  const idempotencyKey = `pw_changed:${cleanEmail}:${changedAt.slice(0, 16)}`;

  const endpoints = [
    '/api/auth/events/password-changed',
    '/.netlify/functions/auth-email-events',
  ];

  let dispatched = false;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          eventType: 'password_changed',
          idempotencyKey,
          customerEmail: cleanEmail,
          changedAt,
          source: 'Prithvi Editify website',
          adminRecipients,
        }),
      });
      if (res.ok) {
        dispatched = true;
        break;
      }
    } catch {
      // Non-blocking
    }
  }

  if (!dispatched && adminRecipients.length > 0) {
    for (const adminEmail of adminRecipients) {
      try {
        await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(adminEmail)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
          },
          body: JSON.stringify({
            _subject: 'Prithvi Editify — Password Changed',
            _template: 'table',
            _captcha: 'false',
            Notice:
              'A customer password change was completed via a verified Supabase recovery session on the Prithvi Editify website.',
            Customer_Email: cleanEmail,
            Completed_At: changedAt,
            Source: 'Prithvi Editify website',
          }),
        });
      } catch {
        // Non-blocking
      }
    }
  }

  recordEmailDeliveryAudit({
    idempotencyKey,
    eventType: 'password_changed_confirmation',
    recipientEmail: STUDIO_OFFICIAL_ADMIN_EMAIL,
    subject: 'Prithvi Editify — Password Changed',
    status: dispatched ? 'sent' : 'queued_relay',
    provider: 'server_notification',
    note: 'Password change completed via verified Supabase recovery session.',
  });
}
