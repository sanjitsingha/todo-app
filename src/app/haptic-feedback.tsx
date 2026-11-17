// Just these icons, not the whole icon set.
import AudioWaveform from 'lucide-react-native/icons/audio-waveform';
import Vibrate from 'lucide-react-native/icons/vibrate';
import VibrateOff from 'lucide-react-native/icons/vibrate-off';
import Volume2 from 'lucide-react-native/icons/volume-2';

import { ChoiceSheet, type Choice } from '@/components/ChoiceSheet';
import { tick } from '@/lib/feedback';
import { updateSettings, useSettings, type FeedbackMode } from '@/store/settings';

const OPTIONS: readonly Choice<FeedbackMode>[] = [
  { value: 'vibrate', label: 'Vibrate', icon: Vibrate },
  { value: 'tick', label: 'Tick', icon: Volume2 },
  { value: 'tickVibrate', label: 'Tick with Vibration', icon: AudioWaveform },
  { value: 'none', label: 'None', icon: VibrateOff },
];

/**
 * Sheet for what the date and time strips give at each step: a vibration, a tick sound, both,
 * or nothing. Opened from Profile. Picking one saves it, plays it (so you feel or hear what you
 * picked), and closes the sheet.
 */
export default function HapticFeedbackScreen() {
  const { feedback } = useSettings();

  const pick = (value: FeedbackMode) => {
    updateSettings({ feedback: value });
    tick();
  };

  return <ChoiceSheet title="Haptic Feedback" options={OPTIONS} value={feedback} onPick={pick} />;
}
