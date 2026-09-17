// No real email provider configured — these are the functions a real one
// (Resend, Postmark, SMTP via nodemailer) would replace. Every caller only
// depends on these signatures, so swapping in a real provider later never
// touches the auth/request routes themselves.

export async function sendMagicLinkEmail(email, url) {
  console.log(`\n[mailer] Sign-in link for ${email}:\n  ${url}\n`);
}

export async function sendRequestNotification(providerEmail, requesterName, listingName) {
  console.log(
    `\n[mailer] New request for ${providerEmail}: ${requesterName} requested "${listingName}"\n`
  );
}

export async function sendRequestStatusUpdate(requesterEmail, status, listingName) {
  console.log(
    `\n[mailer] Status update for ${requesterEmail}: "${listingName}" was ${status}\n`
  );
}
