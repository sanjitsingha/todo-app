// Just this icon, not the whole icon set.
import EllipsisVertical from 'lucide-react-native/icons/ellipsis-vertical';
import { useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  type PressableInstance,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { createThemedStyles, useColors } from '@/hooks/useTheme';

export type OverflowAction = {
  label: string;
  onPress: () => void;
  /** Red, for something that undoes or removes, like Disconnect. */
  destructive?: boolean;
};

type Props = {
  actions: readonly OverflowAction[];
  /** Read by screen readers, e.g. "Google account options". */
  accessibilityLabel: string;
};

type Anchor = { x: number; y: number; width: number; height: number };

/** Space between the button and its menu. */
const MENU_GAP = 4;
const ITEM_HEIGHT = 44;
/** The menu's quick fade in as it opens. */
const MENU_FADE_IN = FadeIn.duration(120);
const MENU_PADDING = 6;
/** The menu never comes closer than this to the top or bottom of the screen. */
const SCREEN_MARGIN = 16;

/**
 * A ⋮ button that opens a small menu of actions under it, lined up with its right edge (it sits
 * at the right end of a row), or above it when there isn't room below. Picking one closes the
 * menu and runs it. Laid out like the Dropdown's menu (src/components/Dropdown.tsx).
 */
export function OverflowMenu({ actions, accessibilityLabel }: Props) {
  const styles = useStyles();
  const colors = useColors();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const triggerRef = useRef<PressableInstance>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Where the button was when the menu last opened.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [layerHeight, setLayerHeight] = useState(windowHeight);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setIsOpen(true);
    });
  };
  const close = () => setIsOpen(false);

  const menuHeight = actions.length * ITEM_HEIGHT + MENU_PADDING * 2;
  const opensUp =
    anchor !== null &&
    anchor.y + anchor.height + MENU_GAP + menuHeight > layerHeight - SCREEN_MARGIN &&
    anchor.y - MENU_GAP - menuHeight >= SCREEN_MARGIN;

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={open}
        hitSlop={8}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ expanded: isOpen }}
      >
        <EllipsisVertical size={20} color={colors.textMuted} />
      </Pressable>

      {/* Full-screen and edge-to-edge, so window coordinates line up with the button. */}
      <Modal
        visible={isOpen}
        transparent
        // No Modal fade: Android's lasts 200 ms and starts slowly, so the menu felt late to
        // show. The menu fades in quickly by itself (MENU_FADE_IN) and closes at once.
        animationType="none"
        onRequestClose={close}
        statusBarTranslucent
        navigationBarTranslucent
      >
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={close}
          onLayout={(event) => setLayerHeight(event.nativeEvent.layout.height)}
          accessibilityLabel="Close menu"
        />
        {anchor ? (
          <Animated.View
            entering={MENU_FADE_IN}
            style={[
              styles.menu,
              opensUp
                ? { bottom: layerHeight - anchor.y + MENU_GAP }
                : { top: anchor.y + anchor.height + MENU_GAP },
              { right: windowWidth - (anchor.x + anchor.width) },
            ]}
          >
            {actions.map((action) => (
              <Pressable
                key={action.label}
                onPress={() => {
                  close();
                  action.onPress();
                }}
                style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                accessibilityRole="menuitem"
              >
                <Text style={[styles.itemText, action.destructive && styles.itemDestructive]}>
                  {action.label}
                </Text>
              </Pressable>
            ))}
          </Animated.View>
        ) : null}
      </Modal>
    </>
  );
}

const useStyles = createThemedStyles((colors) => ({
  trigger: {
    padding: 8,
    borderRadius: 20,
  },
  triggerPressed: {
    backgroundColor: colors.inputBackground,
  },
  menu: {
    position: 'absolute',
    minWidth: 170,
    paddingVertical: MENU_PADDING,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    elevation: 8,
    shadowColor: colors.shadow,
    shadowOpacity: 0.16,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  item: {
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  itemPressed: {
    backgroundColor: colors.inputBackground,
  },
  itemText: {
    fontSize: 15,
    color: colors.text,
  },
  itemDestructive: {
    color: colors.danger,
  },
}));
