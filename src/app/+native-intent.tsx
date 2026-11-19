import { AUTH_CALLBACK_PATH, CALENDAR_CALLBACK_PATH } from '@/constants/links';

const BROWSER_RETURNS = [AUTH_CALLBACK_PATH, CALENDAR_CALLBACK_PATH];

/**
 * Links that open the app, before the router acts on them. Google sign-in and connecting Google
 * Calendar come back to the app on a link (src/constants/links.ts) that the in-app browser
 * hands to the code that opened it; on Android it also reaches the router, which has no screen
 * for it. Those stay put (null) instead of showing a "page not found". Anything else goes on
 * as it came.
 */
export function redirectSystemPath({ path, initial }: { path: string; initial: boolean }) {
  try {
    if (BROWSER_RETURNS.some((returnPath) => path.includes(returnPath))) {
      // Opened by the link itself, with nothing on screen yet: start at the beginning.
      return initial ? '/' : null;
    }
    return path;
  } catch {
    return initial ? '/' : null;
  }
}
