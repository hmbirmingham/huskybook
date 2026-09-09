// No real email provider configured — this is the one function a real one
// (Resend, Postmark, SMTP via nodemailer) would replace. Every caller only
// depends on this signature, so swapping in a real provider later never
// touches the auth routes themselves.
export async function sendMagicLinkEmail(email, url) {
  console.log(`\n[mailer] Sign-in link for ${email}:\n  ${url}\n`);
}
