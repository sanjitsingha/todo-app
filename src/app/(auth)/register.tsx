import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import {
  FooterPrompt,
  GoogleButton,
  OrDivider,
  PrimaryButton,
} from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { isEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation';

/** Sign up with Google, or with a name, email and password. UI only: nothing is created yet. */
export default function RegisterScreen() {
  const router = useRouter();
  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canRegister =
    name.trim().length > 0 && isEmail(email) && password.length >= MIN_PASSWORD_LENGTH;

  // UI only: connect these to an auth provider.
  const continueWithGoogle = () => {};
  const register = () => {
    if (!canRegister) return;
  };

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
      <GoogleButton onPress={continueWithGoogle} />
      <OrDivider />

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

      <PrimaryButton label="Create account" onPress={register} disabled={!canRegister} />
    </AuthScreen>
  );
}
