// Gives React Native a `localStorage` kept in SQLite, so the sign-in survives closing the app.
import 'expo-sqlite/localStorage/install';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState } from 'react-native';

import type { Database } from '@/lib/database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/**
 * The app's Supabase client, for signing in and syncing. Null when the project's keys aren't
 * in .env.local: the app then works as before, on the phone only, and signing in says it isn't
 * set up. Both keys are meant to ship in the app; row level security keeps each person's data
 * their own (supabase/migrations).
 */
export const supabase: SupabaseClient<Database> | null =
  url && publishableKey
    ? createClient<Database>(url, publishableKey, {
        auth: {
          storage: localStorage,
          autoRefreshToken: true,
          persistSession: true,
          // Phones have no page URL to read a sign-in from.
          detectSessionInUrl: false,
          // Google sign-in comes back to the app with a one-time code, not the tokens themselves
          // (src/store/auth.tsx, signInWithGoogle).
          flowType: 'pkce',
        },
      })
    : null;

// Keep the sign-in fresh only while the app is open, as Supabase recommends on phones.
if (supabase) {
  const client = supabase;
  AppState.addEventListener('change', (state) => {
    if (state === 'active') client.auth.startAutoRefresh();
    else client.auth.stopAutoRefresh();
  });
}
