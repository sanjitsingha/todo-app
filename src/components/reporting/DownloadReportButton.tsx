// Just this icon, not the whole icon set: an arrow out of a box, for exporting.
import Share from 'lucide-react-native/icons/share';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, Text } from 'react-native';

import { isEveryType, REPORT_TYPES } from '@/constants/reportTypes';
import { createThemedStyles, useColors } from '@/hooks/useTheme';
import {
  dateChoiceSummary,
  type ActivityEvent,
  type DateChoice,
  type ReportType,
} from '@/lib/activity';
import { formatLongDate, formatTime, toDateKey, toTimeKey, type DateKey } from '@/lib/dates';
import { canExportPdf, reportFileName, shareReportPdf } from '@/lib/reportPdf';

const ICON_SIZE = 16;

/**
 * Export: makes a PDF of what the filters show, every row of it, and opens the share sheet to
 * save or send it (src/lib/reportPdf.ts). A spinner in place of the icon while it's being made.
 * On a build from before 1.2.0, which can't make PDFs (it got this screen over the air), it
 * says to install the latest version instead.
 */
export function DownloadReportButton({
  events,
  types,
  date,
  today,
  person,
  initial,
  disabled,
}: {
  events: readonly ActivityEvent[];
  types: readonly ReportType[];
  date: DateChoice;
  today: DateKey;
  /** The signed-in person's name, or their email. */
  person: string;
  initial: string;
  disabled: boolean;
}) {
  const styles = useStyles();
  const colors = useColors();
  const [working, setWorking] = useState(false);

  const download = async () => {
    if (!canExportPdf()) {
      Alert.alert(
        'Update Dooist to export',
        'Exporting PDFs needs the latest version of the app. Install it, and Export will work.',
      );
      return;
    }
    setWorking(true);
    const now = new Date();
    const actions = isEveryType(types)
      ? 'All Actions'
      : REPORT_TYPES.filter(({ value }) => types.includes(value))
          .map(({ label }) => label)
          .join(', ');
    const time = formatTime(toTimeKey(now.getHours(), now.getMinutes()));
    try {
      await shareReportPdf({
        events,
        today,
        title: 'Reporting',
        details: [
          [person, actions, dateChoiceSummary(date, today)].join(' · '),
          `Downloaded ${formatLongDate(toDateKey(now))}, ${time}`,
        ],
        initial,
        fileName: reportFileName(date, today),
      });
    } catch (error) {
      console.warn('Could not make the report PDF', error);
      Alert.alert('Couldn’t make the PDF', 'Please try again.');
    } finally {
      setWorking(false);
    }
  };

  const off = disabled || working;
  return (
    <Pressable
      onPress={download}
      disabled={off}
      hitSlop={4}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={working ? 'Preparing PDF' : 'Export PDF'}
      accessibilityState={{ disabled: off, busy: working }}
    >
      {working ? (
        <ActivityIndicator size="small" color={colors.textMuted} style={styles.spinner} />
      ) : (
        <Share size={ICON_SIZE} color={disabled ? colors.textSubtle : colors.ink} />
      )}
      <Text style={[styles.text, disabled && styles.textDisabled]}>Export</Text>
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  // The height of the filter buttons beside it, and like them just its icon and text, with a
  // shade only while pressed.
  button: {
    height: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    borderRadius: 10,
  },
  pressed: {
    backgroundColor: colors.inputBackground,
  },
  // The icon's size, so the text doesn't move while it spins.
  spinner: {
    width: ICON_SIZE,
    height: ICON_SIZE,
  },
  // As the filter buttons' text.
  text: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  textDisabled: {
    color: colors.textSubtle,
  },
}));
