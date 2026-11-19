import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

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
import { isEmail } from '@/lib/validation';
import { logIn } from '@/store/auth';

/**
 * Log in: where the app starts when no one's signed in (signing in is required;
 * src/app/_layout.tsx). The email and password form (through Supabase; src/store/auth.tsx),
 * with Continue with Google under its Log in button, and a "New here? Create an account" line
 * at the bottom (it opens sign up on top). Logged in either way, the app takes over by itself,
 * on the Todo tab; the todos then sync with the account. No back arrow: nothing's behind it.
 */
export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInputInstance>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canLogIn = isEmail(email) && password.length > 0;
  const submit = async () => {
    if (!canLogIn || busy) return;
    setBusy(true);
    setError(null);
    const problem = await logIn(email, password);
    setBusy(false);
    if (problem) setError(problem);
  };

  return (
    <AuthScreen
      // Top 60% left empty for now; the form takes the bottom 40%, and more when it needs it.
      split
      showBack={false}
      title="Log in to your account"
      footer={
        <FooterPrompt
          prompt="New here?"
          action="Create an account"
          onPress={() => router.push('/register')}
        />
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
      <GoogleButton onError={setError} />
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
