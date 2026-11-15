import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import {
  FooterPrompt,
  GoogleButton,
  OrDivider,
  PrimaryButton,
  TextLink,
} from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { isEmail } from '@/lib/validation';

/** Log in with Google, or with email and password. UI only: the buttons don't sign in yet. */
export default function LoginScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInputInstance>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canLogIn = isEmail(email) && password.length > 0;

  // UI only: connect these to an auth provider.
  const continueWithGoogle = () => {};
  const logIn = () => {
    if (!canLogIn) return;
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
      <GoogleButton onPress={continueWithGoogle} />
      <OrDivider />

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
        onSubmitEditing={logIn}
      />

      <PrimaryButton label="Log in" onPress={logIn} disabled={!canLogIn} />
    </AuthScreen>
  );
}
