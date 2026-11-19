import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { ErrorMessage, FooterPrompt, PrimaryButton } from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { OtpInput } from '@/components/auth/OtpInput';
import { isEmail } from '@/lib/validation';
import { sendResetCode, verifyResetCode } from '@/store/auth';

/**
 * How many digits the emailed code has. Must match "Email OTP Length" in the Supabase project's
 * Auth settings (6 unless it's been changed): it's how many boxes there are to type it in.
 */
const CODE_LENGTH = 6;

/**
 * Forgot password, in two steps: the email you signed up with, then the code emailed to it, in
 * a row of boxes. It's a code rather than a link so it works without the email having to open
 * the app: Supabase's "Reset password" email template has to show {{ .Token }} rather than the
 * default link (supabase/templates/reset-password.html is the one to paste in). The right code
 * signs you in, and the app swaps these screens for the new password screen by itself
 * (new-password.tsx; src/app/_layout.tsx).
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = isEmail(email);

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

  // Runs by itself once the last box is filled, and from the button (to try again). The ref
  // stops a second check while one's under way (autofill can fill the boxes twice at once).
  const verifying = useRef(false);
  const verify = async (value: string) => {
    if (value.length < CODE_LENGTH || verifying.current) return;
    verifying.current = true;
    setBusy(true);
    setError(null);
    const problem = await verifyResetCode(email, value);
    verifying.current = false;
    setBusy(false);
    // Right, and the new password screen takes over from these by itself.
    if (problem) setError(problem);
  };

  if (step === 'code') {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={`Enter the ${CODE_LENGTH}-digit code we sent to ${email.trim()}.`}
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
        <OtpInput
          label="Code"
          length={CODE_LENGTH}
          value={code}
          onChangeText={setCode}
          onComplete={verify}
          autoFocus
        />

        <ErrorMessage message={error} />
        <PrimaryButton
          label="Verify"
          onPress={() => verify(code)}
          disabled={code.length < CODE_LENGTH}
          loading={busy}
        />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Forgot password?"
      subtitle="Enter the email you signed up with and we’ll send you a code to reset it."
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
        returnKeyType="send"
        onSubmitEditing={sendCode}
      />

      <ErrorMessage message={error} />
      <PrimaryButton label="Send code" onPress={sendCode} disabled={!canSend} loading={busy} />
      {/* Right under the button, not pinned to the bottom of the screen. */}
      <View style={styles.remembered}>
        {/* Back to the login screen, or opens it when it isn't behind this one. */}
        <FooterPrompt
          prompt="Remembered it?"
          action="Log in"
          onPress={() => router.dismissTo('/login')}
        />
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  remembered: {
    alignItems: 'center',
  },
});
