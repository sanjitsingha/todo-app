import { useRouter } from 'expo-router';
import { useState } from 'react';

import { FooterPrompt, PrimaryButton } from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { isEmail } from '@/lib/validation';

/**
 * Asks for an email to send a password reset link to, then says to check the inbox.
 * UI only: no email is sent yet, the screen just moves on to the "check your email" step.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);

  const canSend = isEmail(email);

  // UI only: call the auth provider's "send reset email" here.
  const sendLink = () => {
    if (canSend) setSent(true);
  };

  if (sent) {
    return (
      <AuthScreen
        title="Check your email"
        subtitle={`We sent a link to reset your password to ${email.trim()}.`}
        footer={
          <FooterPrompt
            prompt="Didn’t get it?"
            action="Try again"
            onPress={() => setSent(false)}
          />
        }
      >
        <PrimaryButton label="Back to log in" onPress={() => router.back()} />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      title="Forgot password?"
      subtitle="Enter the email you signed up with and we’ll send you a link to reset it."
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
        onSubmitEditing={sendLink}
      />

      <PrimaryButton label="Send reset link" onPress={sendLink} disabled={!canSend} />
    </AuthScreen>
  );
}
