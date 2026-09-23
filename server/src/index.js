import { app } from './app.js';

const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.listen(PORT, () => {
  console.log(`HuskyBook API listening on http://localhost:${PORT}`);
  if (IS_PRODUCTION) {
    // Temporary boot-time diagnostic, never logs actual secret values,
    // only presence/prefix, safe for a server log. Added to debug a
    // deployed instance reporting "missing API key" from Resend despite
    // the dashboard showing RESEND_API_KEY as set; remove once resolved.
    console.log('[env check]', {
      RESEND_API_KEY: process.env.RESEND_API_KEY
        ? `set (${process.env.RESEND_API_KEY.slice(0, 5)}..., length ${process.env.RESEND_API_KEY.length})`
        : 'MISSING',
      BASE_URL: process.env.BASE_URL || 'MISSING',
      TURSO_DATABASE_URL: process.env.TURSO_DATABASE_URL || 'MISSING',
      TURSO_AUTH_TOKEN: process.env.TURSO_AUTH_TOKEN ? 'set' : 'MISSING',
    });
  }
});
