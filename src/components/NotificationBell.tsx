import { useRouter } from 'expo-router';
// Just this icon, not the whole icon set.
import Bell from 'lucide-react-native/icons/bell';
import { Pressable, View } from 'react-native';

import { createThemedStyles, useColors } from '@/hooks/useTheme';
import { useUnreadCount } from '@/store/notifications';

/**
 * Bell at the right of Profile's header: opens the Notifications page. An orange dot on it
 * while any notification is unread.
 */
export function NotificationBell() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  const unread = useUnreadCount();

  return (
    <Pressable
      onPress={() => router.push('/notifications')}
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      android_ripple={{ color: colors.ripple, borderless: true, radius: 22 }}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Bell size={BELL_SIZE} color={colors.ink} />
      {unread > 0 ? <View style={styles.dot} /> : null}
    </Pressable>
  );
}

/** A size down from the back arrow's 24, so it sits quietly in the header. */
const BELL_SIZE = 20;
const DOT_SIZE = 8;

const useStyles = createThemedStyles((colors) => ({
  // Mirrors the back arrow on the left (src/components/BackButton.tsx).
  button: {
    marginEnd: 8,
    padding: 8,
    borderRadius: 20,
  },
  pressed: {
    opacity: 0.6,
  },
  // On the bell's top right, ringed in the header's color so it stands off the icon.
  dot: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: DOT_SIZE + 4,
    height: DOT_SIZE + 4,
    borderRadius: (DOT_SIZE + 4) / 2,
    borderWidth: 2,
    borderColor: colors.pageHeader,
    backgroundColor: colors.primary,
  },
}));
