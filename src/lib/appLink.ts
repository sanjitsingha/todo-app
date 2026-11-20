import { isRunningInExpoGo } from 'expo';
import Constants, { AppOwnership } from 'expo-constants';
import { getBundleOrigin } from 'expo/internal/bundle-origin';
import * as Linking from 'expo-linking';
import type { AuthSessionOpenOptions } from 'expo-web-browser';

/**
 * How to open the in-app browser for a page that comes back to the app (Google sign-in,
 * connecting Google Calendar). On Android the browser opens inside the app's own task, so coming
 * back to the app closes it. By default it gets a task of its own, and Android can't close that
 * one: it stays open in the background, still on the last page, and the next time the browser
 * opens, that old page can come back instead (an old sign-in, which then ends on the Supabase
 * Site URL). iOS ignores this.
 */
export const BROWSER_RETURN_OPTIONS: AuthSessionOpenOptions = { createTask: false };

function inExpoGo(): boolean {
  try {
    return isRunningInExpoGo() || Constants.appOwnership === AppOwnership.Expo;
  } catch {
    return false;
  }
}

/**
 * The start of a link into the app in Expo Go: exp://host for a dev server on http (the usual
 * one on the local network), exps://host for one on https (a tunnel). It has to be the address
 * Expo Go actually loaded the app from, scheme included, or Expo Go takes the link for another
 * project and restarts the app instead of passing the link in.
 */
function expoGoBase(): string | null {
  try {
    // Where the running JavaScript came from, e.g. https://abc.on.expo.app or
    // http://192.168.1.5:8081. expo-linking builds Expo Go links from it the same way.
    const origin = getBundleOrigin();
    const match = origin ? /^(https?):\/\/([^/]+)/.exec(origin) : null;
    if (match) return `${match[1] === 'https' ? 'exps' : 'exp'}://${match[2]}`;
  } catch {
    // Fall through to the address the dev server gave.
  }
  const host = Constants.expoConfig?.hostUri ?? Constants.expoGoConfig?.debuggerHost;
  return host ? `exp://${host.replace(/\/+$/, '')}` : null;
}

/**
 * A link back into the app at `path`, for a page in the in-app browser to come back to (Google
 * sign-in, connecting Google Calendar). In a build it's todoapp://path.
 *
 * In Expo Go it's exp://<dev server>/--/path (exps:// for an https dev server), because Expo Go
 * only opens its own links. expo-linking's createURL has come out as todoapp://path in Expo Go on
 * Android, which nothing on the phone opens, so the browser just keeps loading after Google. So
 * in Expo Go this builds the link itself.
 */
export function appLink(path: string): string {
  if (inExpoGo()) {
    const base = expoGoBase();
    if (base) return `${base}/--/${path}`;
  }
  return Linking.createURL(path);
}
