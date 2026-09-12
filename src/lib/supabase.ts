import { createClient } from '@supabase/supabase-js';

const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Defensive trim: remove trailing slashes, spaces, and accidental /rest/v1
const cleanUrl = rawUrl.trim().replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '');

if (!cleanUrl || !supabaseAnonKey) {
  throw new Error('Missing or invalid Supabase environment variables in .env.local');
}

export const supabase = createClient(cleanUrl, supabaseAnonKey);