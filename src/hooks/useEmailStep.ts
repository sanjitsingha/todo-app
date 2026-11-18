import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { BackHandler } from 'react-native';

/**
 * The two steps of the login and sign-up screens: first the choices (Continue with Google,
 * Continue with email), then the email form. While the form shows, Android's back button goes
 * back to the choices, like the screen's back arrow (give it `showChoices`), instead of leaving
 * the screen. Every step clears the screen's error message (`setError`, its state setter).
 */
export function useEmailStep(setError: (error: null) => void) {
  const [withEmail, setWithEmail] = useState(false);
  const focused = useIsFocused();

  // Only while this screen is the one showing: the forgot-password screen above the login form
  // has its own back.
  useEffect(() => {
    if (!withEmail || !focused) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      setError(null);
      setWithEmail(false);
      return true;
    });
    return () => subscription.remove();
  }, [withEmail, focused, setError]);

  const showEmailForm = () => {
    setError(null);
    setWithEmail(true);
  };
  const showChoices = () => {
    setError(null);
    setWithEmail(false);
  };

  return { withEmail, showEmailForm, showChoices };
}
