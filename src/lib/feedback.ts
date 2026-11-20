import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getSettings } from '@/store/settings';

const TICK_SOUND = require('../../assets/sounds/tick.wav');

// A fast swipe ticks again and again, so ticks take turns across a few players. Each one
// rewinds a moment after it plays (the tick is 35 ms long), so it's back at the start, ready,
// by its next turn. Rewinding just before playing instead (seekTo, then play) could start the
// sound before the rewind landed, from the end: a silent tick, often, on a fast swipe.
const PLAYER_COUNT = 6;
/** Long enough for the 35 ms tick to finish before its player rewinds. */
const REWIND_AFTER_MS = 60;

type TickPlayer = { player: AudioPlayer; ready: boolean };
let players: TickPlayer[] = [];
let nextPlayer = 0;

/**
 * Keeps the tick sound loaded while the feedback setting uses it, and frees it otherwise.
 * Runs on every tick rather than subscribing to settings changes: a module-level subscription
 * outlives Fast Refresh, so old copies of this file would keep running in development.
 */
function syncPlayers() {
  const { feedback } = getSettings();
  const usesSound = feedback === 'tick' || feedback === 'tickVibrate';
  if (usesSound && players.length === 0) {
    // Mix with other apps, so a tick never pauses the user's music, and stay quiet when the
    // phone is on silent or vibrate (the vibration still plays).
    setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false }).catch(
      () => {},
    );
    players = Array.from({ length: PLAYER_COUNT }, () => ({
      player: createAudioPlayer(TICK_SOUND, {
        // Play from a copy on the device. In development the sound otherwise streams from the
        // dev server (through the tunnel, even), and a rewind can wait on the network.
        downloadFirst: true,
        // iOS otherwise switches audio off after each tick and back on for the next, which
        // makes every tick late.
        keepAudioSessionActive: true,
      }),
      ready: true,
    }));
    nextPlayer = 0;
  } else if (!usesSound && players.length > 0) {
    players.forEach(({ player }) => player.remove());
    players = [];
  }
}

// Load the sound up front, so the first tick isn't late.
syncPlayers();

/** Plays the tick on the next player that's back at the start. None ready: skips it, rather than tick late. */
function playTickSound() {
  for (let tried = 0; tried < players.length; tried++) {
    const entry = players[nextPlayer];
    nextPlayer = (nextPlayer + 1) % players.length;
    if (!entry?.ready) continue;
    entry.ready = false;
    try {
      entry.player.play();
    } catch {
      // A missed tick is not worth crashing over.
    }
    setTimeout(() => {
      entry.player
        .seekTo(0)
        .catch(() => {})
        .finally(() => {
          entry.ready = true;
        });
    }, REWIND_AFTER_MS);
    return;
  }
}

function lightVibration() {
  if (Platform.OS === 'android') {
    // Context_Click is a light tick (lighter than Virtual_Key below), works on every Android
    // version, and follows the phone's touch-feedback setting.
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click).catch(() => {});
  } else {
    // The crisp tick of the iOS picker wheels.
    Haptics.selectionAsync().catch(() => {});
  }
}

function firmVibration() {
  if (Platform.OS === 'android') {
    // Virtual_Key is the crisp click of the system nav buttons: clearly stronger than the
    // tick types, works on every Android version, and follows the phone's touch-feedback setting.
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Virtual_Key).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  }
}

/**
 * One step of a swipeable strip (days, hours, minutes), as picked under "Haptic Feedback" in
 * Profile: a firm vibration, a tick sound, a tick sound with a light vibration, or nothing.
 */
export function tick() {
  syncPlayers();
  switch (getSettings().feedback) {
    case 'vibrate':
      firmVibration();
      break;
    case 'tick':
      playTickSound();
      break;
    case 'tickVibrate':
      playTickSound();
      lightVibration();
      break;
    case 'none':
      break;
  }
}
