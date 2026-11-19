import { useState } from 'react';

import { ErrorMessage, PrimaryButton } from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { AuthScreen } from '@/components/auth/AuthScreen';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/validation';
import { setNewPassword } from '@/store/auth';

/**
 * The last step of forgot password: choosing the new password. Once the emailed code checks out
 * (which signs you in), it takes the place of the login and forgot password screens, and it's
 * the only screen until the password is saved; then the app takes over, signed in
 * (src/app/_layout.tsx). No back arrow: there's nothing behind it.
 */
export default function NewPasswordScreen() {
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSave = password.length >= MIN_PASSWORD_LENGTH;
  const submit = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    const problem = await setNewPassword(password);
    setBusy(false);
    // Saved, and the app takes over by itself.
    if (problem) setError(problem);
  };

  return (
    <AuthScreen
      showBack={false}
      title="Set a new password"
      subtitle="Choose the password you’ll log in with."
    >
      <AuthField
        minimal
        label="New password"
        error={passwordProblem(password)}
        secure
        value={password}
        onChangeText={setPassword}
        placeholder="New password"
        autoFocus
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
        disabled={!canSave}
        loading={busy}
      />
    </AuthScreen>
  );
}
