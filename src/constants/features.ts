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
   * "Continue with Google" on the login and sign-up screens. Off until Google sign-in is set up
   * (it needs a development build and Google Cloud keys); email and password work meanwhile.
   */
  googleSignIn: false,
};
