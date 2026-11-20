import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  type TextInputInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorMessage, PrimaryButton } from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { createThemedStyles } from '@/hooks/useTheme';
import { MIN_PASSWORD_LENGTH, passwordProblem } from '@/lib/validation';
import { changePassword, useAuth } from '@/store/auth';

/**
 * The Password page, opened from Account: the new password twice, then Save password. For a
 * Google sign-up it sets the first one, a second way in: log in with the email and this
 * password, or keep using Continue with Google. A full page rather than a sheet, so the keyboard,
 * the checks and the error have room.
 */
export default function AccountPasswordScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const passwordRef = useRef<TextInputInstance>(null);
  const confirmRef = useRef<TextInputInstance>(null);
  const { user } = useAuth();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  // One eye, on New password, shows or hides both fields.
  const [revealed, setRevealed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Whether the account signs in with Google. (There's no telling from here whether it has a
  // password already: setting one doesn't add 'email' to its providers, so the page reads the
  // same either way.)
  const withGoogle = user?.providers.includes('google') ?? false;

  // The cursor goes in once the page has finished sliding in: focusing mid-animation can leave
  // the keyboard closed on Android.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing) return;
      unsubscribe();
      passwordRef.current?.focus();
    });
    return unsubscribe;
  }, [navigation]);

  const mismatch = confirm.length > 0 && confirm !== password ? 'Passwords don’t match' : null;
  const canSave = password.length >= MIN_PASSWORD_LENGTH && confirm === password;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    const problem = await changePassword(password);
    setBusy(false);
    if (problem) {
      setError(problem);
      return;
    }
    Alert.alert(
      'Password saved',
      withGoogle
        ? `You can now log in with ${user?.email} and this password, or keep using Continue with Google.`
        : 'Use your new password the next time you log in.',
    );
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <AuthField
          ref={passwordRef}
          label="New password"
          error={passwordProblem(password)}
          secure
          revealed={revealed}
          onRevealedChange={setRevealed}
          value={password}
          onChangeText={setPassword}
          autoFocus={Platform.OS === 'web'}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="next"
          submitBehavior="submit"
          onSubmitEditing={() => confirmRef.current?.focus()}
        />
        <AuthField
          ref={confirmRef}
          label="Confirm password"
          error={mismatch}
          secure
          revealed={revealed}
          revealButton={false}
          value={confirm}
          onChangeText={setConfirm}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={save}
        />

        <ErrorMessage message={error} />
        <PrimaryButton label="Save password" onPress={save} disabled={!canSave} loading={busy} />

        {/* What the password is for, under the button. */}
        <Text style={styles.note}>
          {withGoogle
            ? 'Set a password to also log in with your email. Continue with Google keeps working.'
            : 'Choose a new password for logging in with your email.'}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = createThemedStyles((colors) => ({
  page: {
    flex: 1,
    backgroundColor: colors.page,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 20,
  },
  note: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
}));
