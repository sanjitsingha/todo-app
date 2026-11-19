import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import {
  ErrorMessage,
  FooterPrompt,
  GoogleButton,
  OrDivider,
  PrimaryButton,
} from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { isEmail, MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/validation';
import { signUp } from '@/store/auth';

/**
 * Sign up, opened on top of log in and laid out like it: the name, email and password form
 * (through Supabase; src/store/auth.tsx), with Continue with Google under its Create account
 * button. Signed up, the app takes over by itself, signed in. If the project asks new accounts
 * to confirm their email first, it says to check the inbox instead, then back to log in.
 */
export default function RegisterScreen() {
  const router = useRouter();
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // Back down to log in, which is always under this screen (or opens it, if it somehow isn't).
  const goToLogIn = () => router.dismissTo('/login');

  const canRegister =
    name.trim().length > 0 && isEmail(email) && password.length >= MIN_PASSWORD_LENGTH;
  const register = async () => {
    if (!canRegister || busy) return;
    setBusy(true);
    setError(null);
    const result = await signUp(name, email, password);
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.confirm) setConfirming(true);
    // Otherwise signed in: the app takes over from these screens by itself.
  };

  if (confirming) {
    return (
      <AuthScreen
        split
        title="Check your email"
        subtitle={`We sent a link to ${email.trim()}. Open it to confirm, then log in.`}
      >
        <PrimaryButton label="Go to log in" onPress={goToLogIn} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      // Top 60% left empty for now, like the login screen; the form takes the bottom 40%, and
      // more when it needs it.
      split
      title="Create your account"
      footer={
        <FooterPrompt prompt="Already have an account?" action="Log in" onPress={goToLogIn} />
      }
    >
      <AuthField
        minimal
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <AuthField
        ref={emailRef}
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
        error={passwordProblem(password)}
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="Password"
        autoCapitalize="none"
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={register}
      />

      <ErrorMessage message={error} />
      <PrimaryButton
        label="Create account"
        onPress={register}
        disabled={!canRegister}
        loading={busy}
      />

      <OrDivider />
      <GoogleButton onError={setError} />
    </AuthScreen>
  );
}
