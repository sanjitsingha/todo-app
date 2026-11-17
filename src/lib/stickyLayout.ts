import { STICKY_GAP, STICKY_MAX_TILT, STICKY_SIZE } from '@/constants/sticky';
import type { Sticky } from '@/store/stickies';

/** Where a sticky sits on the wall: its top-left corner, and how far it leans, in degrees. */
export type Placement = { x: number; y: number; rotation: number };

export type WallSize = { width: number; height: number };

/** Room kept clear along the bottom of the wall for the Add sticky button and the bin. */
const BOTTOM_CLEARANCE = 72;
/** A spot counts as taken while another sticky covers this much of it, across or down. */
const TAKEN_SHARE = 0.6;
/** With every spot taken, a new sticky goes this far down and right of the last one. */
const CASCADE = 24;

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

/** A slight lean, either way, so stickies don't all line up like tiles. */
export function randomTilt(): number {
  return (Math.random() * 2 - 1) * STICKY_MAX_TILT;
}

/**
 * Where a new sticky goes: the first free spot on an even grid across the wall, left to right
 * and top to bottom, the grid centered across. With no spot free, it goes a little down and
 * right of the top sticky, as when sticking one more on a full wall.
 */
export function findFreeSpot(stickies: readonly Sticky[], wall: WallSize): Placement {
  const step = STICKY_SIZE + STICKY_GAP;
  const columns = Math.max(1, Math.floor((wall.width - STICKY_GAP) / step));
  const rows = Math.max(1, Math.floor((wall.height - BOTTOM_CLEARANCE - STICKY_GAP) / step));
  const left = Math.max(0, (wall.width - (columns * step - STICKY_GAP)) / 2);
  const reach = STICKY_SIZE * TAKEN_SHARE;

  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const x = left + column * step;
      const y = STICKY_GAP + row * step;
      const taken = stickies.some(
        (sticky) => Math.abs(sticky.x - x) < reach && Math.abs(sticky.y - y) < reach,
      );
      if (!taken) return { x, y, rotation: randomTilt() };
    }
  }

  const top = stickies.at(-1);
  const maxX = Math.max(0, wall.width - STICKY_SIZE);
  const maxY = Math.max(0, wall.height - BOTTOM_CLEARANCE - STICKY_SIZE);
  return {
    x: top ? clamp(top.x + CASCADE, 0, maxX) : left,
    y: top ? clamp(top.y + CASCADE, 0, maxY) : STICKY_GAP,
    rotation: randomTilt(),
  };
}
