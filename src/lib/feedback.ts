import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

import { getSettings } from '@/store/settings';

const TICK_SOUND = require('../../assets/sounds/tick.wav');

// A fast swipe can tick again before the last tick has finished playing, so ticks take turns
// across a few players instead of cutting one off mid-sound.
const PLAYER_COUNT = 3;
let players: AudioPlayer[] = [];
let nextPlayer = 0;

/**
 * Keeps the tick sound loaded while the feedback setting uses it, and frees it otherwise.
 * Runs on every tick rather than subscribing to settings changes: a module-level subscription
 * outlives Fast Refresh, so old copies of this file would keep running in development.
 */
function syncPlayers() {
  const usesSound = getSettings().feedback !== 'vibrate';
  if (usesSound && players.length === 0) {
    // Mix with other apps, so a tick never pauses the user's music, and stay quiet when the
    // phone is on silent or vibrate (the vibration still plays).
    setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false }).catch(
      () => {},
    );
    players = Array.from({ length: PLAYER_COUNT }, () => createAudioPlayer(TICK_SOUND));
    nextPlayer = 0;
  } else if (!usesSound && players.length > 0) {
    players.forEach((player) => player.remove());
    players = [];
  }
}

// Load the sound up front, so the first tick isn't late.
syncPlayers();

function playTickSound() {
  const player = players[nextPlayer];
  if (!player) return;
  nextPlayer = (nextPlayer + 1) % players.length;
  try {
    player.seekTo(0).catch(() => {});
    player.play();
  } catch {
    // A missed tick is not worth crashing over.
  }
}

function lightVibration() {
  if (Platform.OS === 'android') {
    // Context_Click is a light tick (lighter than Virtual_Key below), works on every Android
    // version, and follows the phone's touch-feedback setting.
    Haptics.performAndroidHapticsAsync(Haptics.AndroidHaptics.Context_Click).catch(() => {});
  } else {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
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
 * Settings: a firm vibration, a tick sound, or a tick sound with a light vibration.
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
  }
}
