import type { NativeStackNavigationProp } from 'expo-router/native-stack';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Platform, Text, View, type TextInputInstance } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorMessage, PrimaryButton } from '@/components/auth/AuthButtons';
import { AuthField } from '@/components/auth/AuthField';
import { SheetGrabber } from '@/components/SheetGrabber';
import { createThemedStyles } from '@/hooks/useTheme';
import { updateDisplayName, useAuth } from '@/store/auth';

/** Longest name it takes. */
const MAX_NAME_LENGTH = 60;

/**
 * Sheet for changing your name, opened from Account. Saved in the account (updateDisplayName in
 * src/store/auth.tsx), so it shows on every phone signed in to it, and it stays even after
 * signing in with Google again.
 */
export default function AccountNameScreen() {
  const styles = useStyles();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<Record<string, object | undefined>>>();
  const inputRef = useRef<TextInputInstance>(null);
  const { user } = useAuth();
  const current = user?.name ?? '';
  const [name, setName] = useState(current);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The cursor goes in once the sheet has finished sliding up: focusing mid-animation can leave
  // the keyboard closed on Android (as in the add sheet, src/app/add.tsx).
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const unsubscribe = navigation.addListener('transitionEnd', (event) => {
      if (event.data.closing) return;
      unsubscribe();
      inputRef.current?.focus();
    });
    return unsubscribe;
  }, [navigation]);

  const trimmed = name.trim();
  const canSave = trimmed.length > 0 && trimmed !== current;

  const save = async () => {
    if (!canSave || busy) return;
    setBusy(true);
    setError(null);
    const problem = await updateDisplayName(trimmed);
    setBusy(false);
    if (problem) setError(problem);
    else router.back();
  };

  // iOS already pads the sheet for the home indicator; Android needs room for the nav bar.
  const bottomPadding = Platform.OS === 'android' ? Math.max(insets.bottom, 16) : 16;

  return (
    <View style={[styles.screen, { paddingBottom: bottomPadding }]}>
      <SheetGrabber />
      <Text style={styles.heading}>Name</Text>

      <View style={styles.form}>
        <AuthField
          ref={inputRef}
          minimal
          label="Name"
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          autoFocus={Platform.OS === 'web'}
          autoCapitalize="words"
          autoComplete="name"
          textContentType="name"
          maxLength={MAX_NAME_LENGTH}
          returnKeyType="done"
          onSubmitEditing={save}
        />
        <ErrorMessage message={error} />
        <PrimaryButton label="Save" onPress={save} disabled={!canSave} loading={busy} />
      </View>
    </View>
  );
}

const useStyles = createThemedStyles((colors) => ({
  screen: {
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 10 : 24,
  },
  heading: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.text,
  },
  form: {
    marginTop: 16,
    gap: 16,
  },
}));
