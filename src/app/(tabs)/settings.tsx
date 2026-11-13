import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Dropdown, type DropdownOption } from '@/components/Dropdown';
import { colors } from '@/constants/theme';
import { tick } from '@/lib/feedback';
import { updateSettings, useSettings, type FeedbackMode } from '@/store/settings';

const FEEDBACK_OPTIONS: readonly DropdownOption<FeedbackMode>[] = [
  { value: 'vibrate', label: 'Vibrate' },
  { value: 'tick', label: 'Tick' },
  { value: 'tickVibrate', label: 'Tick with Vibration' },
];

export default function SettingsScreen() {
  const { feedback } = useSettings();

  const setFeedback = (next: FeedbackMode) => {
    updateSettings({ feedback: next });
    // Let the user feel / hear what they just picked.
    tick();
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Ionicons name="volume-medium-outline" size={22} color={colors.ink} />
        <Text style={styles.rowTitle}>Haptic Feedback</Text>
        {/* Wrapped so the row centers it on the title (the button itself sticks to the top). */}
        <View>
          <Dropdown
            value={feedback}
            options={FEEDBACK_OPTIONS}
            onChange={setFeedback}
            accessibilityLabel="Haptic Feedback"
            align="right"
          />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingVertical: 8,
  },
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
  },
  rowTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
});
