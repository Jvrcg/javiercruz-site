export const prerender = false;

import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const TURNSTILE_VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const NOTE_MAX_LENGTH = 600;
const DROPDOWN_OPTIONS = ['Need your services', 'Tool Idea'];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const RATE_LIMIT_MAX = 3;

// In-memory, per-function-instance rate limit. Vercel can run multiple
// concurrent instances of this function, each with its own copy of this
// map, so this caps abuse per warm instance rather than globally — see
// the "rate limiting" section of the PR/task notes for the tradeoff.
const submissionsByIp = new Map<string, number[]>();

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const recent = (submissionsByIp.get(ip) ?? []).filter(
    (t) => now - t < RATE_LIMIT_WINDOW_MS
  );

  if (recent.length >= RATE_LIMIT_MAX) {
    submissionsByIp.set(ip, recent);
    return true;
  }

  recent.push(now);
  submissionsByIp.set(ip, recent);

  // Opportunistic cleanup so the map doesn't grow unbounded over the
  // lifetime of a warm serverless instance.
  if (submissionsByIp.size > 500) {
    for (const [key, timestamps] of submissionsByIp) {
      const stillRecent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
      if (stillRecent.length === 0) submissionsByIp.delete(key);
      else submissionsByIp.set(key, stillRecent);
    }
  }

  return false;
}

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export const POST: APIRoute = async (context) => {
  const { request } = context;

  // 1. Rate limit check
  let ip = 'unknown';
  try {
    ip = context.clientAddress || 'unknown';
  } catch {
    ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  }

  if (isRateLimited(ip)) {
    return json(
      { error: 'rate_limited', message: 'Too many submissions from this connection. Please try again in an hour.' },
      429
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'invalid_request', message: 'Malformed request.' }, 400);
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const reason = typeof body.reason === 'string' ? body.reason : '';
  const note = typeof body.note === 'string' ? body.note : '';
  const honeypot = typeof body.honeypot === 'string' ? body.honeypot : '';
  const turnstileToken = typeof body.turnstileToken === 'string' ? body.turnstileToken : '';

  // 2. Verify Turnstile token via siteverify
  if (!turnstileToken) {
    return json({ error: 'turnstile_failed', message: 'Verification failed. Please try again.' }, 400);
  }

  try {
    const verifyRes = await fetch(TURNSTILE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: import.meta.env.TURNSTILE_SECRET_KEY,
        response: turnstileToken,
        remoteip: ip !== 'unknown' ? ip : undefined,
      }),
    });
    const verifyData = (await verifyRes.json()) as { success: boolean };

    if (!verifyData.success) {
      return json({ error: 'turnstile_failed', message: 'Verification failed. Please try again.' }, 400);
    }
  } catch {
    return json({ error: 'turnstile_failed', message: 'Verification failed. Please try again.' }, 400);
  }

  // 3. Check honeypot — pretend success, send nothing
  if (honeypot.trim() !== '') {
    return json({ success: true }, 200);
  }

  // 4. Validate all fields independently of client validation
  const fieldErrors: Record<string, string> = {};
  if (!name) fieldErrors.name = 'Name is required.';
  if (!email || !EMAIL_RE.test(email)) fieldErrors.email = 'Enter a valid email address.';
  if (!DROPDOWN_OPTIONS.includes(reason)) fieldErrors.reason = 'Select an option.';
  if (note.length > NOTE_MAX_LENGTH) {
    fieldErrors.note = `Note must be ${NOTE_MAX_LENGTH} characters or fewer.`;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return json({ error: 'validation_failed', fields: fieldErrors }, 400);
  }

  // 5. Send email via Resend
  const resend = new Resend(import.meta.env.RESEND_API_KEY);
  const timestamp = new Date().toISOString();

  try {
    const { error } = await resend.emails.send({
      from: import.meta.env.CONTACT_FORM_FROM_EMAIL,
      to: [import.meta.env.CONTACT_FORM_TO_EMAIL],
      replyTo: email,
      subject: `[Site Contact] ${reason} - ${name}`,
      text: [
        `Name: ${name}`,
        `Email: ${email}`,
        `Reason: ${reason}`,
        `Timestamp: ${timestamp}`,
        '',
        'Note:',
        note,
      ].join('\n'),
    });

    if (error) {
      console.error('Resend send failed:', error);
      return json(
        {
          error: 'send_failed',
          message: "Something went wrong sending your message. Please reach out on LinkedIn instead.",
        },
        502
      );
    }
  } catch (err) {
    console.error('Resend send failed:', err);
    return json(
      {
        error: 'send_failed',
        message: "Something went wrong sending your message. Please reach out on LinkedIn instead.",
      },
      502
    );
  }

  // 6. Return success
  return json({ success: true }, 200);
};
