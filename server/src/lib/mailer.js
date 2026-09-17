import { Resend } from 'resend';

const IS_DEV = process.env.NODE_ENV !== 'production';
// huskybook.hmbirmingham.me, not the bare hmbirmingham.me — a subdomain
// gets its own DKIM/SPF records in Resend, so this app's transactional
// sending (a stream of magic links to strangers' @uconn.edu addresses)
// never touches whatever reputation/DNS setup the portfolio root domain
// already has.
// Not "noreply@" — Resend's own deliverability insights flagged it as a
// real spam signal (mail providers pattern-match "noreply"-style
// addresses as bulk/automated mail), confirmed after a real test send
// landed in spam rather than the inbox.
const FROM_ADDRESS = 'HuskyBook <hello@huskybook.hmbirmingham.me>';

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

// Shared by every exported function below — in dev this just logs to the
// console (server/src/routes/auth.js separately decides whether to also
// hand a raw sign-in link back in the API response; that shortcut lives
// there, not here). Outside dev, it actually sends via Resend. Pulled out
// once both the sign-in email and the two notification emails needed the
// exact same "log in dev, send for real otherwise" behavior — three copies
// of the same branch would've been one to keep in sync by hand.
async function sendEmail({ to, subject, html, devLabel }) {
  if (IS_DEV) {
    console.log(`\n[mailer] ${devLabel}\n`);
    return;
  }
  await getResendClient().emails.send({ from: FROM_ADDRESS, to, subject, html });
}

export async function sendMagicLinkEmail(email, url) {
  await sendEmail({
    to: email,
    subject: 'Your HuskyBook sign-in link',
    html: `
      <p>Hi,</p>
      <p>Click the link below to sign in to HuskyBook. This link expires in 15 minutes and can only be used once.</p>
      <p><a href="${url}">Sign in to HuskyBook</a></p>
      <p>If you didn't request this, ignore this email.</p>
    `,
    devLabel: `Sign-in link for ${email}:\n  ${url}`,
  });
}

export async function sendRequestNotification(providerEmail, requesterName, listingName) {
  await sendEmail({
    to: providerEmail,
    subject: `New request for "${listingName}"`,
    html: `
      <p>Hi,</p>
      <p><strong>${requesterName}</strong> just requested your listing "${listingName}" on HuskyBook.</p>
      <p>Open Manage Requests in the app to accept or decline.</p>
    `,
    devLabel: `New request for ${providerEmail}: ${requesterName} requested "${listingName}"`,
  });
}

export async function sendRequestStatusUpdate(requesterEmail, status, listingName) {
  await sendEmail({
    to: requesterEmail,
    subject: `Your request was ${status}`,
    html: `
      <p>Hi,</p>
      <p>Your request for "${listingName}" on HuskyBook was <strong>${status}</strong>.</p>
      ${status === 'accepted' ? "<p>Check My Requests in the app for the provider's location and contact info.</p>" : ''}
    `,
    devLabel: `Status update for ${requesterEmail}: "${listingName}" was ${status}`,
  });
}
