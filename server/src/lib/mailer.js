import { Resend } from 'resend';

const IS_DEV = process.env.NODE_ENV !== 'production';
const FROM_ADDRESS = 'HuskyBook <noreply@huskybook.app>';

// Constructed lazily, on first real send, rather than at module load. The
// Resend constructor throws synchronously if RESEND_API_KEY is missing —
// building it eagerly at import time meant the *entire server* failed to
// boot in production without the key set, not just email delivery. Lazy
// construction means a missing key only breaks the email-sending path,
// which is the actual failure it should be.
let resend = null;
function getResendClient() {
  if (!resend) resend = new Resend(process.env.RESEND_API_KEY);
  return resend;
}

// The one function every auth/notification route depends on for actually
// getting an email out. In dev this just logs — server/src/routes/auth.js
// separately decides whether to also hand the raw link back in the API
// response (devLoginUrl), so that shortcut lives there, not here; this
// function's only job is "does the email go out or not."
export async function sendMagicLinkEmail(email, url) {
  if (IS_DEV) {
    console.log(`\n[mailer] Sign-in link for ${email}:\n  ${url}\n`);
    return;
  }
  await getResendClient().emails.send({
    from: FROM_ADDRESS,
    to: email,
    subject: 'Your HuskyBook sign-in link',
    html: `
      <p>Hi,</p>
      <p>Click the link below to sign in to HuskyBook. This link expires in 15 minutes and can only be used once.</p>
      <p><a href="${url}">Sign in to HuskyBook</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `,
  });
}
