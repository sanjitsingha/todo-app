// Just these icons, not the whole icon set.
import Moon from 'lucide-react-native/icons/moon';
import Sun from 'lucide-react-native/icons/sun';
import SunMoon from 'lucide-react-native/icons/sun-moon';

import { ChoiceSheet, type Choice } from '@/components/ChoiceSheet';
import { updateSettings, useSettings, type Appearance } from '@/store/settings';

const OPTIONS: readonly Choice<Appearance>[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: SunMoon },
];

/**
 * Sheet for the app's look: Light, Dark, or following the phone (System). Opened from Profile.
 * Picking one saves it and closes the sheet, and the whole app changes over at once
 * (src/hooks/useTheme.ts, and ThemeSync in src/app/_layout.tsx).
 */
export default function AppearanceScreen() {
  const { appearance } = useSettings();

  return (
    <ChoiceSheet
      title="Appearance"
      options={OPTIONS}
      value={appearance}
      onPick={(value) => updateSettings({ appearance: value })}
    />
  );
}
