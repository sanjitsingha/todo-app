import {
  isAuthError,
  isAuthRetryableFetchError,
  isAuthSessionMissingError,
  type User,
} from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  use,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';

import { AUTH_CALLBACK_PATH } from '@/constants/links';
import { appLink } from '@/lib/appLink';
import { supabase } from '@/lib/supabase';

/** Someone signed in to the app. */
export type AuthUser = {
  id: string;
  email: string;
  name?: string;
};

type AuthContextValue = {
  /** Who's signed in, or null when no one is. */
  user: AuthUser | null;
  /** False until the saved sign-in (if any) has been read back at launch. */
  ready: boolean;
  /**
   * True from the moment a forgot password code is checked until the new password is saved.
   * The right code signs you in, but the app keeps you on the new password screen meanwhile.
   */
  resettingPassword: boolean;
};

const AuthContext = createContext<AuthContextValue | null>(null);

// Kept outside React, so verifyResetCode can set it before the sign-in it brings shows up:
// that sign-in then lands on the new password screen rather than in the app.
let resettingPassword = false;
const resetListeners = new Set<() => void>();

function setResettingPassword(value: boolean) {
  if (resettingPassword === value) return;
  resettingPassword = value;
  resetListeners.forEach((listener) => listener());
}

function subscribeToReset(listener: () => void) {
  resetListeners.add(listener);
  return () => {
    resetListeners.delete(listener);
  };
}

const getResettingPassword = () => resettingPassword;

function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  // `name` is set by sign up; Google accounts bring `name` and `full_name`.
  const name = user.user_metadata?.name ?? user.user_metadata?.full_name;
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
  };
}

/**
 * Who's signed in, through Supabase Auth. Reads the saved sign-in back at launch (it's kept on
 * the phone, so you stay signed in), and follows every sign-in, sign-out and token refresh
 * after that. Without Supabase keys in .env.local, no one is ever signed in, so the app stays
 * on the login screen (signing in is required; src/app/_layout.tsx).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!supabase);
  const resetting = useSyncExternalStore(subscribeToReset, getResettingPassword);

  useEffect(() => {
    if (!supabase) return;
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toAuthUser(data.session?.user));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      const next = toAuthUser(session?.user);
      // Token refreshes report the same person; keep the same object so nothing re-syncs.
      setUser((current) =>
        current?.id === next?.id && current?.email === next?.email && current?.name === next?.name
          ? current
          : next,
      );
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({ user, ready, resettingPassword: resetting }),
    [user, ready, resetting],
  );
  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const context = use(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}

/** What a sign-in action gives back: null, or what went wrong, ready to show. */
export type AuthError = string | null;

const NOT_SET_UP = 'Signing in isn’t set up yet.';

/** A Supabase error as a short sentence for the screen. */
function describe(error: unknown): string {
  if (isAuthRetryableFetchError(error)) {
    return 'Couldn’t reach the server. Check your internet connection and try again.';
  }
  // Setting a new password with no sign-in from a reset code behind it.
  if (isAuthSessionMissingError(error)) {
    return 'Your reset code has run out. Go back and ask for a new one.';
  }
  if (isAuthError(error)) {
    switch (error.code) {
      case 'invalid_credentials':
        return 'That email and password don’t match.';
      case 'user_already_exists':
      case 'email_exists':
        return 'There’s already an account with this email. Try logging in.';
      case 'email_not_confirmed':
        return 'Confirm your email first, using the link we sent you.';
      case 'weak_password':
        return 'Choose a stronger password.';
      case 'email_address_invalid':
        return 'That email address doesn’t look right.';
      case 'otp_expired':
        return 'That code has expired or isn’t right. Ask for a new one.';
      case 'same_password':
        return 'Choose a password you haven’t used before.';
      case 'over_email_send_rate_limit':
      case 'over_request_rate_limit':
        return 'Too many tries. Wait a few minutes and try again.';
    }
    return error.message;
  }
  return 'Something went wrong. Please try again.';
}

export async function logIn(email: string, password: string): Promise<AuthError> {
  if (!supabase) return NOT_SET_UP;
  try {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? describe(error) : null;
  } catch (error) {
    return describe(error);
  }
}

/**
 * Makes an account. `confirm` is true when the project asks new accounts to confirm their email
 * first (Supabase's "Confirm email"): there's no sign-in until they do.
 */
export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ error: AuthError; confirm: boolean }> {
  if (!supabase) return { error: NOT_SET_UP, confirm: false };
  try {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim() } },
    });
    if (error) return { error: describe(error), confirm: false };
    return { error: null, confirm: !data.session };
  } catch (error) {
    return { error: describe(error), confirm: false };
  }
}

/** Emails a code for setting a new password (see verifyResetCode). */
export async function sendResetCode(email: string): Promise<AuthError> {
  if (!supabase) return NOT_SET_UP;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return error ? describe(error) : null;
  } catch (error) {
    return describe(error);
  }
}

/**
 * Checks the emailed code (from sendResetCode). When it's right, you're signed in, and the app
 * shows the new password screen (setNewPassword) instead of the todos until it's saved.
 */
export async function verifyResetCode(email: string, code: string): Promise<AuthError> {
  if (!supabase) return NOT_SET_UP;
  // Before checking: the sign-in a right code brings can show up before verifyOtp returns.
  setResettingPassword(true);
  try {
    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (error) setResettingPassword(false);
    return error ? describe(error) : null;
  } catch (error) {
    setResettingPassword(false);
    return describe(error);
  }
}

/** Sets a new password for whoever's signed in, after verifyResetCode. Then on into the app. */
export async function setNewPassword(password: string): Promise<AuthError> {
  if (!supabase) return NOT_SET_UP;
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setResettingPassword(false);
    return error ? describe(error) : null;
  } catch (error) {
    return describe(error);
  }
}

/** The first value of a link's query parameter. */
function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Signs in with Google, through the project's Google provider in Supabase Auth: Google's page
 * opens in the in-app browser, and comes back to todoapp://auth-callback with a code that's
 * swapped for the sign-in. Needs the Google provider turned on in Supabase, and the callback in
 * its Redirect URLs (supabase/GOOGLE_SETUP.md). Closing the browser isn't an error: it gives
 * back null and nothing happens. Works in Expo Go too (the callback is then exp://…, see
 * src/lib/appLink.ts).
 */
export async function signInWithGoogle(): Promise<AuthError> {
  if (!supabase) return NOT_SET_UP;
  try {
    const redirectTo = appLink(AUTH_CALLBACK_PATH);
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo, skipBrowserRedirect: true },
    });
    if (error) return describe(error);

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') return null;

    const { queryParams } = Linking.parse(result.url);
    const code = firstParam(queryParams?.code);
    if (!code) {
      return (
        firstParam(queryParams?.error_description) ??
        'Google sign-in didn’t finish. Please try again.'
      );
    }
    const exchanged = await supabase.auth.exchangeCodeForSession(code);
    return exchanged.error ? describe(exchanged.error) : null;
  } catch (error) {
    return describe(error);
  }
}

/** Signs out on this phone, back to the login screen. The todos stay on it. */
export async function logOut(): Promise<AuthError> {
  if (!supabase) return null;
  setResettingPassword(false);
  try {
    // Just this phone; the account stays signed in elsewhere.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return error ? describe(error) : null;
  } catch (error) {
    return describe(error);
  }
}
