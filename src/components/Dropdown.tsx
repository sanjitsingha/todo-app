import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type PressableInstance } from 'react-native';

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
};

type Anchor = { x: number; y: number; height: number };

/** A button showing the current choice. Tapping it opens a menu of options right below it. */
export function Dropdown<T extends string>({
  value,
  options,
  onChange,
  accessibilityLabel,
}: Props<T>) {
  const triggerRef = useRef<PressableInstance>(null);
  const [isOpen, setIsOpen] = useState(false);
  // Kept after closing, so the menu stays in place while it fades out.
  const [anchor, setAnchor] = useState<Anchor | null>(null);

  const selected = options.find((option) => option.value === value);

  const open = () => {
    triggerRef.current?.measureInWindow((x, y, _width, height) => {
      setAnchor({ x, y, height });
      setIsOpen(true);
    });
  };

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
        <Pressable style={StyleSheet.absoluteFill} onPress={close} accessibilityLabel="Close menu" />
        {anchor ? (
          <View style={[styles.menu, { top: anchor.y + anchor.height + 6, left: anchor.x }]}>
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
                    <Ionicons name="checkmark" size={18} color={colors.primary} />
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
    backgroundColor: colors.inputBackground,
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
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: colors.surface,
    elevation: 8,
    shadowColor: colors.text,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
  },
  item: {
    minHeight: 44,
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
    color: colors.primary,
  },
});
