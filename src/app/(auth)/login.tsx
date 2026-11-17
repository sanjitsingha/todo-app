import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import {
  ErrorMessage,
  FooterPrompt,
  GoogleButton,
  OrDivider,
  PrimaryButton,
  TextLink,
} from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { FEATURES } from '@/constants/features';
import { isEmail } from '@/lib/validation';
import { logIn, useAuth } from '@/store/auth';

/**
 * Log in with email and password (through Supabase; src/store/auth.tsx), or with Google once
 * that's set up (FEATURES.googleSignIn). As soon as someone is signed in (here, or by setting a
 * new password on the screen above it) it closes, back to where it was opened from; the todos
 * then sync with the account.
 */
export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInputInstance>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Only while it's the screen showing, so a sign-in from the password screen above it waits
  // until that screen has closed.
  const { user } = useAuth();
  const focused = useIsFocused();
  useEffect(() => {
    if (user && focused) router.back();
  }, [user, focused, router]);

  const canLogIn = isEmail(email) && password.length > 0;

  // Not set up yet: hidden behind FEATURES.googleSignIn.
  const continueWithGoogle = () => {};
  const submit = async () => {
    if (!canLogIn || busy) return;
    setBusy(true);
    setError(null);
    const problem = await logIn(email, password);
    setBusy(false);
    // Signed in, the screen closes itself (above).
    if (problem) setError(problem);
  };

  return (
    <AuthScreen
      title="Welcome back"
      subtitle="Log in to your account."
      footer={
        <FooterPrompt
          prompt="Don’t have an account?"
          action="Sign up"
          onPress={() => router.replace('/register')}
        />
      }
    >
      {FEATURES.googleSignIn ? (
        <>
          <GoogleButton onPress={continueWithGoogle} />
          <OrDivider />
        </>
      ) : null}

      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <AuthField
        ref={passwordRef}
        label="Password"
        labelAction={
          <TextLink onPress={() => router.push('/forgot-password')}>Forgot password?</TextLink>
        }
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="Your password"
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />

      <ErrorMessage message={error} />
      <PrimaryButton label="Log in" onPress={submit} disabled={!canLogIn} loading={busy} />
    </AuthScreen>
  );
}
