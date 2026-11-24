import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ErrorMessage, PrimaryButton } from '@/components/auth/AuthButtons';
import { FEEDBACK_SUBJECTS, MAX_FEEDBACK_LENGTH } from '@/constants/feedback';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { sendFeedback } from '@/lib/sendFeedback';
import { setFeedbackSubject, useFeedbackSubject } from '@/store/feedbackDraft';

/**
 * The Feedback page, opened from Profile: a Subject (what part of the app it's about, picked in
 * a bottom sheet, src/app/feedback-subject.tsx), what they'd like to say, and Send. It's saved in the Supabase project's feedback table (read it in
 * the dashboard). A full page rather than a sheet, so the message box and keyboard have room.
 */
export default function FeedbackScreen() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const subject = useFeedbackSubject();
  const [message, setMessage] = useState('');
  const [focused, setFocused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Each visit starts with no subject picked.
  useEffect(() => {
    setFeedbackSubject(null);
    return () => setFeedbackSubject(null);
  }, []);

  const chosen = FEEDBACK_SUBJECTS.find((option) => option.value === subject);

  const pickSubject = () => {
    Keyboard.dismiss();
    router.push('/feedback-subject');
  };

  const canSend = subject !== null && message.trim().length > 0;

  const send = async () => {
    if (!canSend || busy) return;
    setBusy(true);
    setError(null);
    const problem = await sendFeedback(subject, message);
    setBusy(false);
    // What they wrote stays put, so they can try again.
    if (problem) {
      setError(problem);
      return;
    }
    Alert.alert('Thanks for your feedback', 'It helps make Dooist better.');
    router.back();
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.page}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View>
          <Text style={styles.label}>Subject</Text>
          {/* Opens the Subject sheet. */}
          <Pressable
            onPress={pickSubject}
            style={({ pressed }) => [styles.subject, pressed && styles.subjectPressed]}
            accessibilityRole="button"
            accessibilityLabel={`Subject: ${chosen?.label ?? 'Choose a subject'}`}
          >
            {chosen?.icon ? <chosen.icon size={20} color={colors.ink} /> : null}
            <Text
              style={[styles.subjectText, !chosen && styles.subjectPlaceholder]}
              numberOfLines={1}
            >
              {chosen?.label ?? 'Choose a subject'}
            </Text>
            <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
          </Pressable>
        </View>

        <View>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.message, focused && styles.messageFocused]}
            value={message}
            onChangeText={setMessage}
            placeholder="Write your feedback"
            placeholderTextColor={colors.textSubtle}
            multiline
            textAlignVertical="top"
            maxLength={MAX_FEEDBACK_LENGTH}
            autoCapitalize="sentences"
            // Just the line cursor, as in AuthField.
            selectionHandleColor="transparent"
            accessibilityLabel="Message"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          {/* Only once it's getting close to the limit. */}
          {message.length > MAX_FEEDBACK_LENGTH * 0.8 ? (
            <Text style={styles.count}>
              {message.length} / {MAX_FEEDBACK_LENGTH}
            </Text>
          ) : null}
        </View>

        <ErrorMessage message={error} />
        <PrimaryButton label="Send feedback" onPress={send} disabled={!canSend} loading={busy} />

        <Text style={styles.footnote}>
          Tell us what’s working, what isn’t, or what you’d like to see next.
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
  // As AuthField's label.
  label: {
    marginBottom: 8,
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  // No box, just an underline, so the choice lines up with its label. The underline turns
  // Dooist orange while pressed.
  subject: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
  },
  subjectPressed: {
    borderBottomColor: colors.primary,
  },
  subjectText: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
  },
  subjectPlaceholder: {
    color: colors.textSubtle,
  },
  // A white box several lines tall, outlined in gray (Dooist orange while typing).
  message: {
    minHeight: 160,
    maxHeight: 320,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    // Hides the browser's focus box on web.
    outlineStyle: 'solid',
    outlineWidth: 0,
  },
  messageFocused: {
    borderColor: colors.primary,
  },
  count: {
    marginTop: 6,
    alignSelf: 'flex-end',
    fontSize: 13,
    color: colors.textMuted,
  },
  // Under the Send button, in small gray.
  footnote: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textMuted,
  },
}));
