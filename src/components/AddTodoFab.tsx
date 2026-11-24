import { useRouter } from 'expo-router';
// Just this icon, not the whole icon set.
import Plus from 'lucide-react-native/icons/plus';
import { Platform, Pressable } from 'react-native';

import { createThemedStyles, useColors } from '@/hooks/useTheme';

const SIZE = 56;
/** From the bottom and right edges of the screen it floats over. */
const MARGIN = 16;

/**
 * Room to leave below a list's last item, so it can be scrolled up clear of the button rather
 * than stay hidden under it.
 */
export const FAB_CLEARANCE = SIZE + MARGIN * 2;

/**
 * The Add todo button: a round Dooist-orange button with a plus, floating at the bottom right of
 * Today and Upcoming. Opens the Add todo sheet, on the day picked in the date strip (today, from
 * Upcoming, since leaving Today puts the strip back on today). Goes in a screen whose content
 * fills it, as the screen's last child, so it sits on top.
 */
export function AddTodoFab() {
  const styles = useStyles();
  const colors = useColors();
  const router = useRouter();
  return (
    <Pressable
      onPress={() => router.push('/add')}
      style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      accessibilityRole="button"
      accessibilityLabel="Add todo"
    >
      <Plus size={26} strokeWidth={2.5} color={colors.onPrimary} />
    </Pressable>
  );
}

const useStyles = createThemedStyles((colors) => ({
  fab: {
    position: 'absolute',
    right: MARGIN,
    bottom: MARGIN,
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    // Raised off the page: a shadow on iOS, elevation on Android.
    ...Platform.select({
      ios: {
        shadowColor: colors.shadow,
        shadowOpacity: 0.2,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
      },
      default: { elevation: 6 },
    }),
  },
  // The same pressed shade as the app's other orange buttons.
  fabPressed: {
    backgroundColor: colors.primaryPressed,
  },
}));
