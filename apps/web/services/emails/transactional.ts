import 'server-only'
import { send } from './resend'

// Non-billing transactional emails (welcome, contact). Same never-throw contract
// as the billing mails: fire-and-forget, no-op without RESEND_API_KEY.

export async function sendWelcomeAccountMail(args: { email: string; username?: string }): Promise<void> {
  const { email, username } = args
  await send(email, 'Welcome to Jelenius 👋', {
    accentColor: '#171717',
    heading: 'Welcome to Jelenius!',
    subtitle: username
      ? `Hey ${username}, we're thrilled to have you on board.`
      : "We're thrilled to have you on board.",
    body: "You're ready to build and share courses. Here's how to get the most out of it:",
    bulletPoints: [
      'Create your first course and add content in minutes.',
      'Invite learners and track their progress.',
      'Brand your school and share it with the world.',
    ],
  })
}

export async function sendContactMail(args: {
  fromEmail: string
  name?: string
  message: string
  // No platform-wide fallback address on purpose — a self-hosted deployment
  // has no "Jelenius support inbox" to fall back to, so callers must supply
  // the operator's own address.
  to: string
}): Promise<void> {
  const { fromEmail, name, message, to } = args
  await send(to, `New contact form message from ${name || fromEmail}`, {
    accentColor: '#171717',
    heading: 'New contact message',
    subtitle: `From ${name ? `${name} · ` : ''}${fromEmail}`,
    body: message,
  })
}

// NOTE: org-created / org-deleted / account-deleted confirmation emails are
// deliberately NOT sent from here. Unlike Stripe/billing mails (which the web
// webhook owns), user/org lifecycle is owned by apps/api, which has its own
// email service — those confirmations belong there to avoid duplicate sends.
