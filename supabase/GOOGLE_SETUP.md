# Google sign-in and Google Calendar setup

Dooist uses one Google OAuth client for two things:

- **Continue with Google** on the login and sign-up screens. This goes through Supabase Auth's Google provider.
- **Connect Google Calendar** in Profile. This goes through the `google-calendar` Edge Function, which writes todos to a "Dooist" calendar in the person's Google account. It's one way: nothing made in Google Calendar comes back to the app.

Both run in the in-app browser, so they also work in Expo Go.

Below, `<ref>` is the Supabase project ref: the subdomain in `EXPO_PUBLIC_SUPABASE_URL` (in `.env.local`). For `https://abcdefgh.supabase.co`, the ref is `abcdefgh`. It's also under **Project Settings → General → Project ID** in the Supabase dashboard. Replace `<ref>` everywhere, angle brackets included.

## 1. Google Cloud

In [Google Cloud Console](https://console.cloud.google.com/), pick or create a project, then:

1. **APIs & Services → Library**: enable the **Google Calendar API**.
2. **Google Auth Platform → Branding**: set the app name to **Dooist** and add a support email.
3. **Audience**: choose External. While it's in **Testing**, add every Google account that will sign in or connect as a test user.
4. **Data Access → Add or remove scopes**: add these four:
   - `openid`
   - `.../auth/userinfo.email`
   - `.../auth/calendar.app.created`
   - `.../auth/calendar.events.readonly`

   `calendar.app.created` lets Dooist make its own calendars and manage events on them. It can't see or change any other calendar. `calendar.events.readonly` lets it read (never change) the events in the person's primary calendar, for **Show calendar events in Dooist** on the Calendar page. It's only asked for when that's switched on.
5. **Clients → Create client → Web application**. Choose Web application, not Android or iOS, even though Dooist is a phone app. Sign-in and Calendar both finish on a server (Supabase), which needs the client secret that only Web clients have. You don't need a package name or SHA-1. Leave **Authorized JavaScript origins** empty. Under **Authorized redirect URIs**, add both of these:
   - `https://<ref>.supabase.co/auth/v1/callback` (for Google sign-in)
   - `https://<ref>.supabase.co/functions/v1/google-calendar/callback` (for Calendar)
6. Copy the **Client ID** and **Client secret** as soon as the client is created. Google may not show the secret again.

## 2. Supabase dashboard

1. **SQL Editor → New query**: paste `supabase/migrations/20261119120000_google_calendar.sql` and run it.
2. **Authentication → Sign In / Providers → Google**: turn it on, and paste the Client ID and Client secret.
3. **Authentication → URL Configuration → Redirect URLs**: add these:
   - `todoapp://**` (development and store builds)
   - `exp://**` (Expo Go)
   - `exps://**` (Expo Go with an https dev server, such as a tunnel)

## 3. Edge Function

From the project folder:

```bash
npx supabase login
npx supabase link --project-ref <ref>
npx supabase secrets set GOOGLE_CLIENT_ID=<client id> GOOGLE_CLIENT_SECRET=<client secret>
npx supabase functions deploy google-calendar --no-verify-jwt
```

`--no-verify-jwt` is required. Google's redirect back to the function carries no Supabase token. The function checks the signed-in user's token itself on every action the app calls.

## What goes to Google Calendar

- **Todo with a time**: an event at that time, lasting its duration (or 30 minutes if it has none). The time zone is the one the phone was in when Calendar was connected.
- **Todo without a time**: an all-day event on its due date.
- **Finished todo**: the event stays, with a "✓" in front of the title, and shows as free time.
- **Deleted todo**: its event is removed.
- **Reminders**: Google's own reminders are off on these events, because the app already sends reminders.

Changes are sent after each sync with Supabase. That happens when the app opens and shortly after each change, from any phone signed in to the account.

**Disconnect** (tap the Google Calendar row in Profile) stops sending todos and hands the access back to Google. The Dooist calendar and its events stay in Google Calendar.

If someone removes Dooist's access in their Google account, or deletes the Dooist calendar, sending stops and Profile shows **Reconnect Google Calendar**.

## Going live

- **Refresh tokens expire after 7 days in Testing.** While the app is in Testing, Google expires refresh tokens for this kind of scope after 7 days. When that happens, Profile shows **Reconnect Google Calendar**.
- **Publishing needs verification.** To let anyone use it, publish the app in the Google Auth Platform. Google may ask to verify it for the Calendar scope.
