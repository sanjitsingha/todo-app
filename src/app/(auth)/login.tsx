import { useIsFocused, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import {
  ErrorMessage,
  FooterPrompt,
  GOOGLE_NOT_READY,
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
 * Log in: the email and password form (through Supabase; src/store/auth.tsx), with Continue
 * with Google under its Log in button, and a "New here? Create an account" line at the bottom
 * (it opens sign up instead). Google works once it's set up (FEATURES.googleSignIn); until then
 * it says so. As soon as someone is signed in (here, or by setting a new password on the screen
 * above it) it closes, back to where it was opened from; the todos then sync with the account.
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

  // Not set up yet: says so instead of doing nothing (FEATURES.googleSignIn).
  const continueWithGoogle = () => {
    if (!FEATURES.googleSignIn) setError(GOOGLE_NOT_READY);
  };

  // Swaps this screen for sign up, so back from there goes to where login was opened from.
  const goToSignUp = () => router.replace('/register');

  const canLogIn = isEmail(email) && password.length > 0;
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
      // Top 60% left empty for now; the form takes the bottom 40%, and more when it needs it.
      split
      title="Log in to your account"
      footer={
        <FooterPrompt prompt="New here?" action="Create an account" onPress={goToSignUp} />
      }
    >
      <AuthField
        minimal
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="Email"
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
        minimal
        label="Password"
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        autoCapitalize="none"
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={submit}
      />
      {/* Under the password box, at its right end (there's no label row to sit in). */}
      <View style={styles.forgot}>
        <TextLink onPress={() => router.push('/forgot-password')}>Forgot password?</TextLink>
      </View>

      <ErrorMessage message={error} />
      <PrimaryButton label="Log in" onPress={submit} disabled={!canLogIn} loading={busy} />

      <OrDivider />
      <GoogleButton onPress={continueWithGoogle} />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  // A little closer to the box it belongs to than the form's usual gap.
  forgot: {
    alignSelf: 'flex-end',
    marginTop: -4,
  },
});
