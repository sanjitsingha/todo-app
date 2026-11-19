/**
 * Paths the in-app browser comes back to after Google, as todoapp://<path> (or
 * exp://…/--/<path> in Expo Go). The browser hands what's on the link to the code that opened it
 * (src/store/auth.tsx, src/store/calendar.ts); there's no screen for them, so the router is told
 * to stay where it is when one arrives (src/app/+native-intent.tsx).
 */

/** Back from Google sign-in, with the code that finishes signing in. */
export const AUTH_CALLBACK_PATH = 'auth-callback';

/** Back from connecting Google Calendar, saying how it went. */
export const CALENDAR_CALLBACK_PATH = 'calendar-connected';
