/**
 * Supabase Edge Function: auth-email-events
 * Deploy via: `supabase functions deploy auth-email-events`
 * Secrets required (`supabase secrets set RESEND_API_KEY=... RESEND_FROM_EMAIL=...`):
 * - RESEND_API_KEY
 * - RESEND_FROM_EMAIL
 */

// @ts-ignore - Deno runtime in Supabase Edge Functions
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const AUTHORIZED_ADMIN_EMAILS = [
  'prithvieditify.official@gmail.com',
  'shankarbaluragi066@gmail.com',
];

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const eventType = String(body.eventType || '');
    const customerEmail = String(body.customerEmail || '').trim().toLowerCase();
    const customerName = String(body.customerName || '').trim();
    // @ts-ignore
    const resendKey = (Deno.env.get('RESEND_API_KEY') || '').trim();
    // @ts-ignore
    const fromAddress =
      (Deno.env.get('RESEND_FROM_EMAIL') || '').trim() ||
      'Prithvi Editify <onboarding@resend.dev>';

    if (!customerEmail || !customerEmail.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid customer email required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!resendKey) {
      return new Response(
        JSON.stringify({
          ok: true,
          welcomeEmailStatus: 'pending_provider_config',
          message: 'RESEND_API_KEY secret not set in Supabase Edge Function.',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (eventType === 'registration') {
      const greeting = customerName ? `Hello ${customerName},` : 'Hello,';
      const welcomeText = [
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

      const wRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromAddress,
          to: [customerEmail],
          subject: 'Welcome to Prithvi Editify!',
          text: welcomeText,
        }),
      });

      const registrationTimestamp =
        String(body.registrationTimestamp || '') || new Date().toISOString();

      await fetch('https://api.resend.com/emails', {
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

      return new Response(
        JSON.stringify({
          ok: true,
          welcomeEmailStatus: wRes.ok ? 'sent' : 'failed',
          adminNotificationStatus: 'sent',
        }),
        {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : 'Error' }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
