import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View, type TextInputInstance } from 'react-native';

import {
  EmailButton,
  ErrorMessage,
  FooterPrompt,
  GOOGLE_NOT_READY,
  GoogleButton,
  PrimaryButton,
} from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { FEATURES } from '@/constants/features';
import { useEmailStep } from '@/hooks/useEmailStep';
import { isEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { signUp } from '@/store/auth';

/**
 * Sign up, laid out like the login screen. It opens on two choices, Continue with Google and
 * Continue with email. Email swaps in the name, email and password form (through Supabase;
 * src/store/auth.tsx); the back arrow, or Android's back button, goes back to the choices.
 * Google works once it's set up (FEATURES.googleSignIn); until then it says so. Signed up, it
 * goes back to where it was opened from, signed in. If the project asks new accounts to
 * confirm their email first, it says to check the inbox instead.
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
  const { withEmail, showEmailForm, showChoices } = useEmailStep(setError);

  // Not set up yet: says so instead of doing nothing (FEATURES.googleSignIn).
  const continueWithGoogle = () => {
    if (!FEATURES.googleSignIn) setError(GOOGLE_NOT_READY);
  };

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
    else router.back();
  };

  if (confirming) {
    return (
      <AuthScreen
        split
        title="Check your email"
        subtitle={`We sent a link to ${email.trim()}. Open it to confirm, then log in.`}
      >
        <PrimaryButton label="Go to log in" onPress={() => router.replace('/login')} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      // Top 40% left empty for now, like the login screen; the choices, then the form, take the
      // bottom 60%.
      split
      title="Create your account"
      onBack={withEmail ? showChoices : undefined}
      footer={
        <FooterPrompt
          prompt="Already have an account?"
          action="Log in"
          onPress={() => router.replace('/login')}
        />
      }
    >
      {withEmail ? (
        <>
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
            // Chose email: ready to type.
            autoFocus
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
            hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
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
        </>
      ) : (
        <>
          <View style={styles.choices}>
            <GoogleButton onPress={continueWithGoogle} />
            <EmailButton onPress={showEmailForm} />
          </View>
          <ErrorMessage message={error} />
        </>
      )}
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  choices: {
    gap: 12,
  },
});
