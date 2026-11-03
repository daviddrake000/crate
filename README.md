# Crate

A tracker for the albums you listen to: log albums with cover art, artist and release date (day and month optional), rate them out of five (half points allowed), write a review, and group them into lists, ranked (numbered) or not. Sort and filter your albums or any list by date logged, release date, rating, title or artist.

## Using it

Open the app at its Firebase address (see `.firebaserc` for the project id):

`https://<project-id>.firebaseapp.com`

Sign in with Google. Your crate syncs between every device you sign in on.

**On your phone:** open that address, then add it to your home screen. In Safari, tap Share, then Add to Home Screen. In Chrome, open the ⋮ menu and choose Add to Home screen or Install app. It then opens full-screen like a normal app, and still works when you're offline; changes sync once you reconnect.

The app follows your device's light or dark setting.

When a new version is published, an open copy of the app (a home-screen app on your phone, a tab left open) moves to it the next time you open or switch back to it, so every device runs the same version. If you're adding or editing an album at the time, it waits until you leave that page. The code is in `src/version.ts`.

## Where your data lives

Albums, cover art and lists are stored in Firestore (Google's cloud database) under your Google account. Security rules (`firestore.rules`) allow only you to read or change them. Each device also keeps a local copy, so the app opens instantly and works offline.

As a second copy, use **Export backup** in the footer now and then. It downloads one `.json` file with everything, cover art included. **Restore from backup** replaces the crate with the contents of a backup file.

## Listening feed for AI assistants

**Settings** (in the account menu) can create a private, read-only link that lets an AI assistant read your albums, ratings, reviews and lists. Crate has no server, so the link is a Firestore address: the app keeps a JSON copy of your crate at `feeds/{secret}`, and the rules let anyone fetch that exact document but never list or search the feeds. **Make a new link** replaces it (the old link stops working at once) and **Turn off** deletes it. **Copy instructions for your assistant** copies a plain-text description of the link and every field. The code is in `src/feed.ts`.

## Setting it up

Crate runs on your own Firebase project, and the free plan is enough. Your project's details stay on your computer: `.env.local` and `.firebaserc` are never committed.

1. Create a project in the [Firebase console](https://console.firebase.google.com) and add a web app.
2. Turn on **Authentication → Sign-in method → Google**, and create a **Firestore** database.
3. To sign in from the dev server, add `localhost` under **Authentication → Settings → Authorized domains** if it isn't listed.
4. Copy `.env.example` to `.env.local` and fill in the web app's config (`firebase apps:sdkconfig` prints it).
5. Copy `.firebaserc.example` to `.firebaserc` and put in your project id.

## Developing

```bash
npm install
npm run dev
```

Then open http://localhost:5174. The dev server uses the same Firebase project and data as the live site.

To publish changes (needs the Firebase CLI: `npm install -g firebase-tools`, then `firebase login`):

```bash
npm run deploy
```

## Project layout

| Path | What it is |
| --- | --- |
| `src/db.ts` | Data model, all writes to Firestore, backup export/restore |
| `src/crate.tsx` | Sign-in state and the live subscription to your albums and lists |
| `src/firebase.ts`, `src/firebaseConfig.ts` | Firebase setup and Google sign-in (values come from `.env.local`) |
| `src/feed.ts`, `src/pages/Settings.tsx` | The read-only listening feed for AI assistants |
| `src/albumQuery.ts` | Sorting and rating filters (kept in the URL) |
| `src/pages/` | Albums, Log/Edit album, Album page, Lists, List page |
| `src/components/` | Rating discs, cover art and vinyl, album grid, sort/filter controls, list picker, list artwork |
| `src/styles.css` | The whole visual design: colours (light and dark), type, layout |
| `firestore.rules`, `firebase.json` | Database security rules and hosting config |
