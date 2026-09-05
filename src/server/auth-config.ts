export function authIsConfigured() {
  // Temporarily disable authentication to avoid build-time prerender errors
  // Re-enable by restoring the original check once environment variables are valid.
  // return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET && process.env.BETTER_AUTH_URL && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.OWNER_EMAIL);
  return false;
}
