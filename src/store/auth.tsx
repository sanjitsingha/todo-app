import { isAuthError, isAuthRetryableFetchError, type User } from '@supabase/supabase-js';
import { createContext, use, useEffect, useMemo, useState, type ReactNode } from 'react';

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
};

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthUser(user: User | null | undefined): AuthUser | null {
  if (!user) return null;
  const name = user.user_metadata?.name;
  return {
    id: user.id,
    email: user.email ?? '',
    name: typeof name === 'string' && name.trim() ? name.trim() : undefined,
  };
}

/**
 * Who's signed in, through Supabase Auth. Reads the saved sign-in back at launch (it's kept on
 * the phone, so you stay signed in), and follows every sign-in, sign-out and token refresh
 * after that. Without Supabase keys in .env.local, no one is ever signed in.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(!supabase);

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

  const value = useMemo(() => ({ user, ready }), [user, ready]);
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

/** Emails a code for setting a new password (see resetPassword). */
export async function sendResetCode(email: string): Promise<AuthError> {
  if (!supabase) return NOT_SET_UP;
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return error ? describe(error) : null;
  } catch (error) {
    return describe(error);
  }
}

/** Checks the emailed code, then sets the new password. Leaves you signed in. */
export async function resetPassword(
  email: string,
  code: string,
  password: string,
): Promise<AuthError> {
  if (!supabase) return NOT_SET_UP;
  try {
    const verified = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'recovery',
    });
    if (verified.error) return describe(verified.error);
    const { error } = await supabase.auth.updateUser({ password });
    return error ? describe(error) : null;
  } catch (error) {
    return describe(error);
  }
}

/** Signs out on this phone. The todos stay on it. */
export async function logOut(): Promise<AuthError> {
  if (!supabase) return null;
  try {
    // Just this phone; the account stays signed in elsewhere.
    const { error } = await supabase.auth.signOut({ scope: 'local' });
    return error ? describe(error) : null;
  } catch (error) {
    return describe(error);
  }
}
