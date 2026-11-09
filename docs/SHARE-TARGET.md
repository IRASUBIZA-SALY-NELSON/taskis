# Share to Taskis (Android)

Taskis appears in the Android share sheet for text, links, photos, videos, audio and documents. After choosing Taskis
the person picks a channel, a person, or their own Notes, adds an optional note, and taps Send.

## How it works
- `TaskisSharePlugin.java` receives the share, copies each file into the app's private cache (never the other app's
  storage) and tells the page. The page shows the "Share to Taskis" sheet (`ShareTarget.tsx`).
- Files are uploaded straight from the phone by the plugin (not through JavaScript), so large videos work. The plugin only
  uploads files it copied itself, and only to the same server the app is showing, so the login token cannot be sent elsewhere.
- Up to 20 files, 500 MB each (the server's limit). Files that are too large or unreadable are skipped with a message.
- Copies are deleted after sending or cancelling.
- The sheet appears after login if something was shared while signed out.

## Not covered
- Individual people appearing directly in the Android share sheet ("Direct Share"); the person is chosen inside Taskis.
- iPhone (needs a Share Extension built in Xcode on a Mac).

## Also fixed here
The app crashed right after login on builds without Firebase set up (`google-services.json` missing), because the push
plugin throws on a background thread. The page now asks the app whether Firebase is configured and skips push
registration when it is not.
