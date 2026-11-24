import type { ReactNode } from 'react';
import { ScrollView, Text, View } from 'react-native';

import { ChatGptLogo } from '@/components/ChatGptLogo';
import { createThemedStyles, useColors } from '@/hooks/useTheme';

const LOGO_SIZE = 22;

/** One app Dooist works with: its logo, its name, and where it stands at the right. */
function IntegrationRow({
  logo,
  title,
  status,
}: {
  logo: ReactNode;
  title: string;
  status: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.row} accessible accessibilityLabel={`${title}, ${status}`}>
      {logo}
      <Text style={styles.rowTitle}>{title}</Text>
      <Text style={styles.status}>{status}</Text>
    </View>
  );
}

/**
 * Integrations, opened from Profile: the other apps Dooist works with, as in the web app's
 * Settings. For now just ChatGPT, which is coming soon, so its row doesn't do anything yet.
 * Google Calendar has its own page (src/app/calendar.tsx), as it does on the web.
 */
export default function IntegrationsScreen() {
  const styles = useStyles();
  const colors = useColors();
  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <IntegrationRow
        logo={<ChatGptLogo size={LOGO_SIZE} color={colors.ink} />}
        title="Connect ChatGPT"
        status="Coming soon"
      />
    </ScrollView>
  );
}

// The same rows as Profile's.
const useStyles = createThemedStyles((colors) => ({
  page: {
    flex: 1,
    backgroundColor: colors.page,
  },
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
    color: colors.text,
  },
  status: {
    fontSize: 14,
    color: colors.textMuted,
  },
}));
