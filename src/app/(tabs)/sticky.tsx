import { Redirect } from 'expo-router';
// Just these icons, not the whole icon set.
import Plus from 'lucide-react-native/icons/plus';
import StickyNote from 'lucide-react-native/icons/sticky-note';
import { useCallback, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Animated from 'react-native-reanimated';

import { DotGrid } from '@/components/DotGrid';
import { StickyEditor, type EditorResult } from '@/components/StickyEditor';
import {
  DraggedSticky,
  StickyBin,
  WallSticky,
  useHiddenWhileDragging,
  useStickyDrag,
} from '@/components/StickyNote';
import { FEATURES } from '@/constants/features';
import { colors } from '@/constants/theme';
import { tick } from '@/lib/feedback';
import { findFreeSpot, type WallSize } from '@/lib/stickyLayout';
import { useStickies } from '@/store/stickies';

/** What's open in the editor: a sticky on the wall by its id, or a new one (null). */
type Editing = { id: string | null; opened: number };

/**
 * Not released yet (FEATURES.sticky): until it is, there's no tab for it, and a link here goes
 * to the Todo screen instead.
 */
export default function StickyRoute() {
  return FEATURES.sticky ? <StickyScreen /> : <Redirect href="/" />;
}

/**
 * The Sticky tab: a dotted wall to stick notes on. Add sticky pops up a new one to write on;
 * Done puts it up on the wall, in the first free spot. Tap a sticky to write on it again, drag
 * it to move it, or drag it onto the bin that comes up at the bottom to take it down.
 */
function StickyScreen() {
  const { stickies, addSticky, editSticky, moveSticky, removeSticky } = useStickies();
  // The wall's full size. The keyboard can squeeze the wall (on Android) while a sticky is
  // written; new ones still go on the whole wall, as it is without the keyboard.
  const [wall, setWall] = useState<WallSize>({ width: 0, height: 0 });
  const fullWall = useRef<WallSize>({ width: 0, height: 0 });
  const drag = useStickyDrag();
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Editing | null>(null);
  const addHidden = useHiddenWhileDragging(drag);

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    const full = {
      width,
      height: width === fullWall.current.width ? Math.max(height, fullWall.current.height) : height,
    };
    fullWall.current = full;
    setWall(full);
    // Drags keep to the wall as it is now, and find the bin where it's drawn.
    drag.wall.set({ width, height });
  };

  const openSticky = useCallback((id: string) => setEditing({ id, opened: Date.now() }), []);
  const addNew = () => setEditing({ id: null, opened: Date.now() });

  const startDrag = useCallback((id: string) => {
    setDraggingId(id);
    tick();
  }, []);
  const drop = useCallback(
    (id: string, x: number, y: number) => {
      moveSticky(id, x, y);
      tick();
    },
    [moveSticky],
  );
  const settled = useCallback(
    (id: string) => setDraggingId((current) => (current === id ? null : current)),
    [],
  );
  const binned = useCallback(
    (id: string) => {
      removeSticky(id);
      setDraggingId((current) => (current === id ? null : current));
    },
    [removeSticky],
  );

  const editingSticky = editing?.id ? stickies.find((sticky) => sticky.id === editing.id) : null;
  const draggedSticky = draggingId ? stickies.find((sticky) => sticky.id === draggingId) : null;

  const placeNew = useCallback(() => findFreeSpot(stickies, wall), [stickies, wall]);
  // Saving and closing the editor happen together, so the sticky on the wall shows the moment
  // the editor's copy goes.
  const onEditorDone = useCallback(
    ({ text, color, placement }: EditorResult) => {
      if (editing?.id) editSticky(editing.id, { text, color });
      else addSticky({ text, color, ...placement });
      setEditing(null);
      tick();
    },
    [editing, editSticky, addSticky],
  );
  const onEditorRemove = useCallback(() => {
    if (editing?.id) removeSticky(editing.id);
    setEditing(null);
  }, [editing, removeSticky]);

  return (
    <View style={styles.wall} onLayout={onLayout}>
      <DotGrid />

      {stickies.map((sticky) => (
        <WallSticky
          key={sticky.id}
          sticky={sticky}
          drag={drag}
          hidden={sticky.id === draggingId || sticky.id === editing?.id}
          onOpen={openSticky}
          onDragStart={startDrag}
          onDrop={drop}
          onSettled={settled}
          onBin={binned}
          onBinHover={tick}
        />
      ))}

      {stickies.length === 0 && !editing ? (
        <View style={styles.empty} pointerEvents="none">
          <StickyNote size={40} color={colors.textSubtle} strokeWidth={1.5} />
          <Text style={styles.emptyTitle}>No stickies yet</Text>
          <Text style={styles.emptyText}>Tap Add sticky to write one and stick it up here.</Text>
        </View>
      ) : null}

      <StickyBin drag={drag} />
      {draggedSticky ? <DraggedSticky sticky={draggedSticky} drag={drag} /> : null}

      <Animated.View style={[styles.addWrap, addHidden]}>
        <Pressable
          onPress={addNew}
          style={({ pressed }) => [styles.addButton, pressed && styles.addButtonPressed]}
          accessibilityRole="button"
          accessibilityLabel="Add sticky"
        >
          <Plus size={18} color={colors.onInk} strokeWidth={2.5} />
          <Text style={styles.addText}>Add sticky</Text>
        </Pressable>
      </Animated.View>

      {editing && wall.width > 0 && (editing.id === null || editingSticky) ? (
        <StickyEditor
          key={editing.opened}
          initialText={editingSticky?.text ?? ''}
          initialColor={editingSticky?.color ?? 'yellow'}
          from={editingSticky ?? null}
          wall={wall}
          placeNew={placeNew}
          onDone={onEditorDone}
          onRemove={onEditorRemove}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  // Stickies dragged past the edge are cut off there, not drawn over the header or tab bar.
  wall: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  empty: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 48,
    gap: 6,
  },
  emptyTitle: {
    marginTop: 8,
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
    color: colors.textMuted,
  },
  addWrap: {
    position: 'absolute',
    right: 16,
    bottom: 16,
  },
  addButton: {
    height: 48,
    paddingLeft: 16,
    paddingRight: 20,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.ink,
    boxShadow: '0 6px 16px rgba(15, 23, 42, 0.22)',
  },
  addButtonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.97 }],
  },
  addText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.onInk,
  },
});
