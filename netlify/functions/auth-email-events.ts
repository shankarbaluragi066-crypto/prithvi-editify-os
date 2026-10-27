/**
 * Netlify Serverless Function: /.netlify/functions/auth-email-events
 * Handles server-side Customer Welcome Emails, Admin New Customer Registration Alerts,
 * Admin Password-Reset Request Notifications, and Verified Password-Changed Confirmations.
 *
 * Environment Variables (set in Netlify Site Settings -> Environment Variables):
 * - RESEND_API_KEY (Server-only transactional email API key)
 * - RESEND_FROM_EMAIL (Verified sender identity, e.g. "Prithvi Editify <hello@yourdomain.com>" or "Prithvi Editify <onboarding@resend.dev>")
 * - STUDIO_ADMIN_EMAIL (Default: shankarbaluragi066@gmail.com)
 * - STUDIO_OFFICIAL_ADMIN_EMAIL (Default: prithvieditify.official@gmail.com)
 */

const STUDIO_ADMIN_EMAIL = (
  process.env.STUDIO_ADMIN_EMAIL || 'shankarbaluragi066@gmail.com'
).toLowerCase();
const STUDIO_OFFICIAL_ADMIN_EMAIL = (
  process.env.STUDIO_OFFICIAL_ADMIN_EMAIL || 'prithvieditify.official@gmail.com'
).toLowerCase();

const AUTHORIZED_ADMIN_EMAILS = Array.from(
  new Set([STUDIO_OFFICIAL_ADMIN_EMAIL, STUDIO_ADMIN_EMAIL])
);

const processedKeys = new Map<string, number>();

function checkIdempotency(key: string, ttlMs: number): boolean {
  const now = Date.now();
  const prev = processedKeys.get(key);
  if (prev && now - prev < ttlMs) return false;
  processedKeys.set(key, now);
  return true;
}

function buildWelcomeEmail(customerName?: string) {
  const cleanName = (customerName || '').trim();
  const greeting = cleanName ? `Hello ${cleanName},` : 'Hello,';
  const subject = 'Welcome to Prithvi Editify!';
  const text = [
    greeting,
    '',
    'Welcome to Prithvi Editify!',
    '',
    "Thank you for creating your account with us. We're excited to help you with your creative projects and make your experience smooth and professional.",
    '',
    'With your Prithvi Editify account, you can access the features available to you, manage your project information, and stay updated on your creative work.',
    '',
    'If you need assistance, have a question about our services, or would like to discuss a project, please contact our team through the official website.',
    '',
    'Thank you for choosing Prithvi Editify.',
    '',
    'Best regards,',
    '',
    'Prithvi Editify Team',
    'Website: https://prithvieditify.netlify.app/',
  ].join('\n');

  const safeGreeting = cleanName ? `Hello ${cleanName.replace(/[<>&"']/g, '')},` : 'Hello,';
  const html = `<!DOCTYPE html>
<html lang="en">
<body style="margin:0;padding:24px;background-color:#040D1A;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#F8FAFC;">
  <div style="max-width:580px;margin:0 auto;background-color:#0D1F38;border:1px solid #1E3A5F;border-radius:12px;padding:32px;">
    <p style="margin:0 0 16px 0;font-size:16px;font-weight:600;color:#F8FAFC;">${safeGreeting}</p>
    <p style="margin:0 0 16px 0;font-size:18px;font-weight:700;color:#10B981;">Welcome to Prithvi Editify!</p>
    <p style="margin:0 0 16px 0;color:#E2E8F0;line-height:1.6;">Thank you for creating your account with us. We're excited to help you with your creative projects and make your experience smooth and professional.</p>
    <p style="margin:0 0 16px 0;color:#E2E8F0;line-height:1.6;">With your Prithvi Editify account, you can access the features available to you, manage your project information, and stay updated on your creative work.</p>
    <p style="margin:0 0 24px 0;color:#E2E8F0;line-height:1.6;">If you need assistance, have a question about our services, or would like to discuss a project, please contact our team through the official website.</p>
    <p style="margin:0 0 8px 0;color:#E2E8F0;">Thank you for choosing Prithvi Editify.</p>
    <p style="margin:16px 0 0 0;color:#94A3B8;">Best regards,<br /><strong style="color:#F8FAFC;">Prithvi Editify Team</strong><br />Website: <a href="https://prithvieditify.netlify.app/" style="color:#0EA5E9;">https://prithvieditify.netlify.app/</a></p>
  </div>
</body>
</html>`;

  return { subject, text, html };
}

export const handler = async (event: { httpMethod?: string; body?: string | null }) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method Not Allowed' }),
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const eventType = String(body.eventType || '');
    const customerEmail = String(body.customerEmail || '').trim().toLowerCase();
    const customerName = String(body.customerName || '').trim();
    const idempotencyKey = String(body.idempotencyKey || `${eventType}:${customerEmail}`);
    const resendKey = (process.env.RESEND_API_KEY || '').trim();
    const fromAddress =
      (process.env.RESEND_FROM_EMAIL || '').trim() || 'Prithvi Editify <onboarding@resend.dev>';

    if (!customerEmail || !customerEmail.includes('@')) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Valid customer email is required.' }),
      };
    }

    if (eventType === 'registration') {
      if (!checkIdempotency(idempotencyKey, 24 * 60 * 60 * 1000)) {
        return {
          statusCode: 200,
          body: JSON.stringify({
            ok: true,
            deduplicated: true,
            welcomeEmailStatus: 'already_sent',
            adminNotificationStatus: 'already_sent',
          }),
        };
      }

      const registrationTimestamp =
        String(body.registrationTimestamp || '') || new Date().toISOString();
      let welcomeEmailStatus: 'sent' | 'pending_provider_config' | 'failed' =
        'pending_provider_config';
      let adminNotificationStatus: 'sent' | 'queued_relay' | 'failed' = 'failed';

      if (resendKey) {
        const welcome = buildWelcomeEmail(customerName);
        const wRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: [customerEmail],
            subject: welcome.subject,
            text: welcome.text,
            html: welcome.html,
          }),
        });
        welcomeEmailStatus = wRes.ok ? 'sent' : 'failed';

        const aRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: AUTHORIZED_ADMIN_EMAILS,
            subject: 'Prithvi Editify — New Customer Registration',
            text: [
              'A new customer has registered on the Prithvi Editify website.',
              '',
              `Customer name: ${customerName || 'Not provided'}`,
              '',
              `Customer email: ${customerEmail}`,
              '',
              `Registration time: ${registrationTimestamp}`,
              '',
              "Open the admin dashboard to review the customer's account.",
            ].join('\n'),
          }),
        });
        if (aRes.ok) {
          adminNotificationStatus = 'sent';
        }
      }

      return {
        statusCode: 200,
        body: JSON.stringify({
          ok: true,
          welcomeEmailStatus,
          adminNotificationStatus,
        }),
      };
    }

    if (eventType === 'password_reset_requested') {
      if (!checkIdempotency(idempotencyKey, 10 * 60 * 1000)) {
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true, deduplicated: true }),
        };
      }

      const requestTimestamp = String(body.requestTimestamp || '') || new Date().toISOString();
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: AUTHORIZED_ADMIN_EMAILS,
            subject: 'Prithvi Editify — Password Reset Request',
            text: [
              'A password-reset request was submitted on the Prithvi Editify website.',
              '',
              `Customer email: ${customerEmail}`,
              '',
              `Request time: ${requestTimestamp}`,
              '',
              'Source: Prithvi Editify website',
              '',
              'This is an informational security notification. The customer must use the password-reset email sent to their own registered address to complete the process.',
            ].join('\n'),
          }),
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    if (eventType === 'password_changed') {
      if (!checkIdempotency(idempotencyKey, 10 * 60 * 1000)) {
        return {
          statusCode: 200,
          body: JSON.stringify({ ok: true, deduplicated: true }),
        };
      }

      const changedAt = String(body.changedAt || '') || new Date().toISOString();
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromAddress,
            to: AUTHORIZED_ADMIN_EMAILS,
            subject: 'Prithvi Editify — Password Changed',
            text: [
              'A customer password change was completed on the Prithvi Editify website.',
              '',
              `Customer email: ${customerEmail}`,
              '',
              `Completed time: ${changedAt}`,
              '',
              'Source: Prithvi Editify website',
            ].join('\n'),
          }),
        });
      }

      return {
        statusCode: 200,
        body: JSON.stringify({ ok: true }),
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  } catch {
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: true }),
    };
  }
};
