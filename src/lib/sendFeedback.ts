import Constants from 'expo-constants';
import { Platform } from 'react-native';

import type { FeedbackSubject } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

const OFFLINE = 'Couldn’t reach the server. Check your internet connection and try again.';

/** The version people see on the Updates page (`expo.extra.release`), else the app's. */
function appVersion(): string | null {
  const config = (Constants.expoConfig ?? {}) as {
    version?: unknown;
    extra?: { release?: { version?: unknown } };
  };
  const version = config.extra?.release?.version ?? config.version;
  return typeof version === 'string' ? version : null;
}

/**
 * Saves feedback to the account's project (the feedback table), with the app's version and the
 * phone's system, to help reproduce a problem. Returns what went wrong, or null once it's sent.
 */
export async function sendFeedback(subject: FeedbackSubject, message: string): Promise<string | null> {
  if (!supabase) return 'Feedback isn’t set up in this build.';
  try {
    const { error } = await supabase.from('feedback').insert({
      subject,
      message: message.trim(),
      app_version: appVersion(),
      platform: `${Platform.OS} ${Platform.Version}`.slice(0, 40),
    });
    if (!error) return null;
    // Fetch failures come back as an error with no Postgres code.
    return error.code ? 'Couldn’t send your feedback. Please try again later.' : OFFLINE;
  } catch {
    return OFFLINE;
  }
}
