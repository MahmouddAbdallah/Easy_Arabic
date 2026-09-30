import { isProduction } from '@/lib/auth/config';

/**
 * Email delivery is a small interface so any provider can be plugged in.
 * Shipped implementation: Resend's HTTPS API (no extra dependency).
 *
 *   EMAIL_PROVIDER   "resend"                         (unset = not configured)
 *   RESEND_API_KEY   API key from your Resend account
 *   EMAIL_FROM       e.g. "Easy Arabic <no-reply@yourdomain.com>" (verified sender)
 *   APP_URL          public base URL used in links, e.g. https://easyarabic.example
 *
 * When nothing is configured no email is sent. In development the message is
 * printed to the server console so the flows can be exercised locally; in
 * production a clear error is logged and nothing (least of all a token) is
 * written to the logs.
 */

export interface EmailMessage {
    to: string;
    subject: string;
    text: string;
    html: string;
}

export interface EmailProvider {
    send(message: EmailMessage): Promise<void>;
}

class ResendProvider implements EmailProvider {
    constructor(private apiKey: string, private from: string) { }

    async send(message: EmailMessage) {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { Authorization: `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ from: this.from, to: [message.to], subject: message.subject, text: message.text, html: message.html }),
            signal: AbortSignal.timeout(10_000),
        });
        if (!res.ok) throw new Error(`Resend responded with HTTP ${res.status}`);
    }
}

class UnconfiguredProvider implements EmailProvider {
    async send(message: EmailMessage) {
        if (!isProduction) {
            console.info(`\n[email:dev] EMAIL_PROVIDER is not configured — printing instead of sending.\nTo: ${message.to}\nSubject: ${message.subject}\n${message.text}\n`);
            return;
        }
        console.error(`[email] EMAIL_PROVIDER is not configured; "${message.subject}" was NOT delivered. See docs/AUTH.md.`);
    }
}

let provider: EmailProvider | undefined;
function getProvider(): EmailProvider {
    if (provider) return provider;
    if (process.env.EMAIL_PROVIDER === 'resend' && process.env.RESEND_API_KEY && process.env.EMAIL_FROM) {
        provider = new ResendProvider(process.env.RESEND_API_KEY, process.env.EMAIL_FROM);
    } else {
        provider = new UnconfiguredProvider();
    }
    return provider;
}

/** Never throws: email problems must not change an endpoint's response. */
async function deliver(message: EmailMessage) {
    try {
        await getProvider().send(message);
    } catch (error) {
        console.error(`[email] failed to send "${message.subject}":`, error instanceof Error ? error.message : 'unknown error');
    }
}

// Links are built from APP_URL, never from the request's Host header (which an
// attacker controls; that would enable password-reset poisoning).
function appUrl(): string | null {
    const url = process.env.APP_URL || (isProduction ? '' : 'http://localhost:3000');
    return url ? url.replace(/\/+$/, '') : null;
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

function layout(paragraphs: string[], action?: { label: string; url: string }) {
    const text = [...paragraphs, action ? `${action.label}: ${action.url}` : ''].filter(Boolean).join('\n\n');
    const html = `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:auto;line-height:1.5">
${paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('\n')}
${action ? `<p><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:10px 18px;background:#0f766e;color:#fff;border-radius:8px;text-decoration:none">${escapeHtml(action.label)}</a></p><p style="font-size:12px;color:#666">Or paste this link into your browser:<br>${escapeHtml(action.url)}</p>` : ''}
</div>`;
    return { text, html };
}

export async function sendPasswordResetEmail(to: string, token: string, ttlMinutes: number) {
    const base = appUrl();
    if (!base) return console.error('[email] APP_URL is not set; cannot build a password reset link.');
    const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
    const { text, html } = layout(
        ['We received a request to reset your Easy Arabic password.', `This link works once and expires in ${ttlMinutes} minutes. If you didn't ask for this, you can ignore this email; your password won't change.`],
        { label: 'Reset password', url }
    );
    await deliver({ to, subject: 'Reset your Easy Arabic password', text, html });
}

export async function sendVerificationEmail(to: string, token: string) {
    const base = appUrl();
    if (!base) return console.error('[email] APP_URL is not set; cannot build a verification link.');
    const url = `${base}/verify-email?token=${encodeURIComponent(token)}`;
    const { text, html } = layout(['Welcome to Easy Arabic! Please confirm your email address to finish setting up your account.'], { label: 'Verify email', url });
    await deliver({ to, subject: 'Verify your Easy Arabic email', text, html });
}

export async function sendPasswordChangedEmail(to: string) {
    const { text, html } = layout(['The password for your Easy Arabic account was just changed, and you were signed out on other devices.', "If this wasn't you, reset your password immediately and contact us."]);
    await deliver({ to, subject: 'Your Easy Arabic password was changed', text, html });
}

/** Sent instead of a "duplicate account" error, so the sign-up form can't be used to discover who is registered. */
export async function sendAccountExistsEmail(to: string) {
    const base = appUrl();
    const { text, html } = layout(
        ['Someone tried to create an Easy Arabic account with this email address, but you already have one.', "If it was you, sign in or reset your password. If not, you can ignore this email."],
        base ? { label: 'Reset password', url: `${base}/forgot-password` } : undefined
    );
    await deliver({ to, subject: 'You already have an Easy Arabic account', text, html });
}
