import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL;
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_ANON_KEY;

// False when the env vars are missing or still the template placeholders.
// Accepts a hosted project or a local one (Supabase CLI runs on 127.0.0.1).
export const isSupabaseConfigured = Boolean(
  SUPABASE_URL &&
  SUPABASE_KEY &&
  /^(https:\/\/.+\.supabase\.co|http:\/\/(localhost|127\.0\.0\.1):\d+)\/?$/.test(SUPABASE_URL) &&
  !SUPABASE_URL.includes('your_project') &&
  !SUPABASE_KEY.startsWith('your_')
);

// Invite and password-reset email links land here with "#...&type=invite"
// (or "type=recovery") in the URL. Read it before the client consumes the hash,
// so the app can ask the person to choose a password.
export const arrivedFromEmailLink = (() => {
  try {
    const type = new URLSearchParams(window.location.hash.replace(/^#/, '')).get('type');
    return type === 'invite' || type === 'recovery';
  } catch {
    return false;
  }
})();

export const supabase = createClient(
  isSupabaseConfigured ? SUPABASE_URL : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? SUPABASE_KEY : 'placeholder'
);
