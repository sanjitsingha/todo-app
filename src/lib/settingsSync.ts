import { supabase } from '@/lib/supabase';
import {
  applyAccountSettings,
  getSettings,
  getSettingsSync,
  setSettingsSync,
} from '@/store/settings';

/** Saves the phone's settings to `userId`'s account. */
async function pushSettings(userId: string) {
  if (!supabase) return;
  const sent = getSettings();
  const { error } = await supabase.from('user_settings').upsert({
    user_id: userId,
    feedback: sent.feedback,
    todo_view: sent.todoView,
    appearance: sent.appearance,
  });
  if (error) throw error;
  // Changed again while this was on its way: that goes next time.
  setSettingsSync({ userId, unsynced: getSettings() !== sent });
}

/**
 * Makes the phone's settings and `userId`'s account agree. Just signed in (the phone had someone
 * else's settings, or none synced yet), the account's saved settings win, if it has any;
 * otherwise the phone's go up. After that, changes on the phone go up, and changes made on
 * another phone come down when there's nothing unsent here.
 */
export async function syncSettings(userId: string) {
  if (!supabase) return;
  const state = getSettingsSync();
  const justSignedIn = state.userId !== userId;
  if (!justSignedIn && state.unsynced) {
    await pushSettings(userId);
    return;
  }

  const { data, error } = await supabase
    .from('user_settings')
    .select('feedback, todo_view, appearance')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;

  // Changed on the phone while that was on its way: keep the phone's, and send it next time.
  if (!justSignedIn && getSettingsSync().unsynced) return;

  if (data) {
    applyAccountSettings(
      { feedback: data.feedback, todoView: data.todo_view, appearance: data.appearance },
      userId,
    );
  } else {
    await pushSettings(userId);
  }
}
