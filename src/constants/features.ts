/**
 * Parts of the app that are built but hidden for now. Off means hidden; the code, and anything
 * already saved, stay as they are, so turning one on is all it takes to bring it back.
 */
export const FEATURES = {
  /**
   * The Sticky tab: a dotted wall of sticky notes (src/app/(tabs)/sticky.tsx). Off: no tab, and
   * its screen sends you to the Todo screen if a link opens it.
   */
  sticky: false,
  /**
   * The day's goal ring beside the month at the top of the Todo screen
   * (src/components/GoalRing.tsx). Off while it waits for a new place in the app.
   */
  goalRingInHeader: false,
  /**
   * Google sign-in ("Continue with Google" on the login and sign-up screens), through the
   * Google provider in Supabase Auth, in the in-app browser; it works in Expo Go too. It needs
   * that provider turned on in Supabase (supabase/GOOGLE_SETUP.md). Off, the button says it
   * isn't ready yet, and email and password still work.
   */
  googleSignIn: true,
};
