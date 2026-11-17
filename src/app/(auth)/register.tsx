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
import { FEATURES } from '@/constants/features';
import { isEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { signUp } from '@/store/auth';

/**
 * Sign up with a name, email and password (through Supabase; src/store/auth.tsx), or with Google
 * once that's set up (FEATURES.googleSignIn). Signed up, it goes back to where it was opened
 * from, signed in. If the project asks new accounts to confirm their email first, it says to
 * check the inbox instead.
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

  const canRegister =
    name.trim().length > 0 && isEmail(email) && password.length >= MIN_PASSWORD_LENGTH;

  // Not set up yet: hidden behind FEATURES.googleSignIn.
  const continueWithGoogle = () => {};
  const register = async () => {
    if (!canRegister || busy) return;
    setBusy(true);
    setError(null);
    const result = await signUp(name, email, password);
    setBusy(false);
    if (result.error) setError(result.error);
    else if (result.confirm) setConfirming(true);
    else router.back();
  };

  if (confirming) {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={`We sent a link to ${email.trim()}. Open it to confirm, then log in.`}
      >
        <PrimaryButton label="Go to log in" onPress={() => router.replace('/login')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Create account"
      subtitle="Sign up to get started."
      footer={
        <FooterPrompt
          prompt="Already have an account?"
          action="Log in"
          onPress={() => router.replace('/login')}
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
        label="Name"
        value={name}
        onChangeText={setName}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <AuthField
        ref={emailRef}
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
        hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="Create a password"
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
    </AuthScreen>
  );
}
