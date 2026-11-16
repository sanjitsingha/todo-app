import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type PressableInstance,
} from 'react-native';

import { colors } from '@/constants/theme';

export type DropdownOption<T extends string> = {
  value: T;
  label: string;
};

type Props<T extends string> = {
  value: T;
  options: readonly DropdownOption<T>[];
  onChange: (value: T) => void;
  /** Read by screen readers before the current choice, e.g. "Show". */
  accessibilityLabel: string;
  /**
   * Which edge of the button the menu lines up with. Use "right" for a button near the right
   * edge of the screen, so the menu opens leftward and stays on screen.
   */
  align?: 'left' | 'right';
};

type Anchor = { x: number; y: number; width: number; height: number };

/** Space between the button and its menu. */
const MENU_GAP = 6;
/** The menu never comes closer than this to the top or bottom of the screen. */
const SCREEN_MARGIN = 16;
// The menu's padding and row height (used in its styles), to tell whether it fits below.
const ITEM_HEIGHT = 44;
const MENU_PADDING = 6;
/** If the keyboard says it's gone but never does, open the menu anyway after this long. */
const KEYBOARD_WAIT_MS = 500;

/**
 * A button showing the current choice. Tapping it opens a menu of options right below it, or
 * right above it when there isn't room below (a button low on the screen, like one in a
 * half-height sheet).
 */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
  align = 'left',
}: Props<T>) {
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const triggerRef = useRef<PressableInstance>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Kept after closing, so the menu stays in place while it fades out.
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  // The full-screen layer the menu sits in, once laid out; a menu above the button is placed
  // from its bottom edge.
  const [layerHeight, setLayerHeight] = useState(windowHeight);

  const selected = options.find((option) => option.value === value);

  const measureAndOpen = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => {
      setAnchor({ x, y, width, height });
      setIsOpen(true);
    });
  };

  const open = () => {
    if (!Keyboard.isVisible()) {
      measureAndOpen();
      return;
    }
    // A sheet moves back down as the keyboard goes, taking the button with it, so the menu is
    // placed once the keyboard is gone.
    let fallback: ReturnType<typeof setTimeout> | undefined;
    const subscription = Keyboard.addListener('keyboardDidHide', () => {
      subscription.remove();
      clearTimeout(fallback);
      requestAnimationFrame(measureAndOpen);
    });
    fallback = setTimeout(() => {
      subscription.remove();
      measureAndOpen();
    }, KEYBOARD_WAIT_MS);
    Keyboard.dismiss();
  };

  const menuHeight = options.length * ITEM_HEIGHT + MENU_PADDING * 2;
  const opensUp =
    anchor !== null &&
    anchor.y + anchor.height + MENU_GAP + menuHeight > layerHeight - SCREEN_MARGIN &&
    anchor.y - MENU_GAP - menuHeight >= SCREEN_MARGIN;

  const close = () => setIsOpen(false);

  const choose = (next: T) => {
    onChange(next);
    close();
  };

  return (
    <>
      <Pressable
        ref={triggerRef}
        onPress={open}
        style={({ pressed }) => [styles.trigger, pressed && styles.triggerPressed]}
        accessibilityRole="button"
        accessibilityLabel={`${accessibilityLabel}: ${selected?.label ?? ''}`}
        accessibilityState={{ expanded: isOpen }}
      >
        <Text style={styles.triggerText}>{selected?.label}</Text>
        <Ionicons name="chevron-down" size={16} color={colors.textMuted} />
      </Pressable>

      {/* Full-screen and edge-to-edge, so window coordinates line up with the button. */}
      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
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
          <View
            style={[
              styles.menu,
              opensUp
                ? { bottom: layerHeight - anchor.y + MENU_GAP }
                : { top: anchor.y + anchor.height + MENU_GAP },
              align === 'right'
                ? { right: windowWidth - (anchor.x + anchor.width) }
                : { left: anchor.x },
            ]}
          >
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => choose(option.value)}
                  style={({ pressed }) => [styles.item, pressed && styles.itemPressed]}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected: isSelected }}
                >
                  <Text style={[styles.itemText, isSelected && styles.itemTextSelected]}>
                    {option.label}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark" size={18} color={colors.ink} />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  triggerPressed: {
    backgroundColor: colors.border,
  },
  triggerText: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
  },
  menu: {
    position: 'absolute',
    minWidth: 180,
    paddingVertical: MENU_PADDING,
    borderRadius: 12,
    backgroundColor: colors.surface,
    elevation: 8,
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  item: {
    minHeight: ITEM_HEIGHT,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  itemPressed: {
    backgroundColor: colors.inputBackground,
  },
  itemText: {
    fontSize: 15,
    color: colors.text,
  },
  itemTextSelected: {
    fontWeight: '600',
    color: colors.ink,
  },
});
