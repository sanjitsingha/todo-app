import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import type { TextInputInstance } from 'react-native';

import { ErrorMessage, FooterPrompt, PrimaryButton } from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { isEmail, MIN_PASSWORD_LENGTH } from '@/lib/validation';
import { resetPassword, sendResetCode } from '@/store/auth';

/** Supabase's email codes are 6 digits unless the project sets them longer (up to 10). */
const MIN_CODE_LENGTH = 6;
const MAX_CODE_LENGTH = 10;

/**
 * Setting a new password, in two steps: the email you signed up with, then the code emailed to
 * it with your new password. It's a code rather than a link so it works without the email
 * having to open the app (Supabase's "Reset password" email template shows it as {{ .Token }}).
 * Done, you're signed in, and the login screen underneath closes too.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const passwordRef = useRef<TextInputInstance>(null);
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = isEmail(email);
  const canReset =
    code.trim().length >= MIN_CODE_LENGTH && password.length >= MIN_PASSWORD_LENGTH;

  const sendCode = async () => {
    if (!canSend || busy) return;
    setBusy(true);
    setError(null);
    const problem = await sendResetCode(email);
    setBusy(false);
    if (problem) setError(problem);
    else {
      setCode('');
      setStep('code');
    }
  };

  const submit = async () => {
    if (!canReset || busy) return;
    setBusy(true);
    setError(null);
    const problem = await resetPassword(email, code, password);
    setBusy(false);
    if (problem) setError(problem);
    // Signed in: back to the login screen, which closes itself now there's a sign-in.
    else router.back();
  };

  if (step === 'code') {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={`We sent a code to ${email.trim()}. Enter it and choose a new password.`}
        footer={
          <FooterPrompt
            prompt="Didn’t get it?"
            action="Use a different email"
            onPress={() => {
              setError(null);
              setStep('email');
            }}
          />
        }
      >
        <AuthField
          label="Code"
          value={code}
          onChangeText={(value) => setCode(value.replace(/\D/g, ''))}
          placeholder="123456"
          keyboardType="number-pad"
          maxLength={MAX_CODE_LENGTH}
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => passwordRef.current?.focus()}
        />
        <AuthField
          ref={passwordRef}
          label="New password"
          hint={`At least ${MIN_PASSWORD_LENGTH} characters`}
          secure
          value={password}
          onChangeText={setPassword}
          placeholder="Choose a new password"
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="go"
          onSubmitEditing={submit}
        />

        <ErrorMessage message={error} />
        <PrimaryButton
          label="Set new password"
          onPress={submit}
          disabled={!canReset}
          loading={busy}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Forgot password?"
      subtitle="Enter the email you signed up with and we’ll send you a code to reset it."
      footer={
        <FooterPrompt prompt="Remembered it?" action="Log in" onPress={() => router.back()} />
      }
    >
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        placeholder="you@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="send"
        onSubmitEditing={sendCode}
      />

      <ErrorMessage message={error} />
      <PrimaryButton label="Send code" onPress={sendCode} disabled={!canSend} loading={busy} />
    </AuthScreen>
  );
}
