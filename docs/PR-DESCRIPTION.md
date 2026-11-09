## Summary

Security fixes, a login that stays signed in, voice and video calls, phone and desktop push notifications, document and link
previews, sharing into Taskis from other Android apps, live presence and unread dots, and persistent file storage.
10 commits, reviewable one by one.

**Read `docs/DEPLOY-CHECKLIST.md` before merging.** The backend now refuses to start without `JWT_SECRET`, and `main` deploys
automatically.

## What is in it
1. **Remove hardcoded admin password and JWT secret default.** The seeder reset the admin password to a fixed value on every
   boot and the JWT secret had a committed fallback, so anyone with the repo could sign in as admin or forge tokens.
   `JWT_SECRET` is now required (64+ chars); the admin gets `ADMIN_PASSWORD` or a random one.
2. **Stay signed in.** A 90-day sliding refresh token (stored hashed, revocable) renews the session in the background; logout
   revokes it. Also removes the first-visit "What's new" popup.
3. **Capacitor Android/iOS shells and PWA assets.**
4. **Phone push (Firebase).** Who wrote and how many are unread, never the text unless the person turns "Hide message text" off;
   `#confidential` always hidden.
5. **Document and link previews.** First-page thumbnails for PDF and Word, text excerpts, rich link cards from a new
   `/api/links/preview` endpoint that only reaches public hosts on ports 80/443.
6. **1-to-1 voice and video calls (LiveKit Cloud).** Ringing over the live connection, busy/declined/missed handling, call log lines
   in the chat, short-lived per-room tokens.
7. **Desktop push (Web Push/VAPID).** Works with the tab closed; same privacy rule; the old in-page popup (which included the
   message text) stands down when push is on.
8. **Share to Taskis (Android).** Native receiver copies shared files into private storage and uploads them directly; also fixes
   an app crash after login on builds without Firebase.
9. **Live sidebar and presence.** Replaces 5-second polling. `/channels/latest` no longer loads every message into memory and no
   longer exposes other people's private-chat activity.
10. **Persistent file storage.** S3-compatible bucket (e.g. Cloudflare R2) so uploads survive redeploys, plus streaming
    encryption so large files no longer need whole-file memory.

## Testing
- 25 backend unit tests pass (privacy of push text, LiveKit tokens, Web Push delivery decrypted the way a browser would,
  streaming encryption incl. tampering/truncation/old format, S3 signing against Amazon's published example, storage).
- A 300 MB file uploaded and downloaded byte-identical through a server capped at 256 MB, in local and (fake) bucket mode, with
  an independent signature verifier.
- Calls: ringing, accept/decline/cancel/busy verified end to end; the incoming-call screen verified in a browser.
- Android: share sheet (text and a PDF) verified on a physical phone.
- Frontend typechecks and builds.

## Not tested (needs real accounts or devices)
- Real audio/video (needs LiveKit keys), real push delivery (needs Firebase; a real browser subscription), a real R2 bucket,
  sharing from Photos/Files (tested with `adb`), iPhone.

## Known gaps (not in this PR)
- Confidential redesign (fingerprint, view-once). The old passkey default (`20300`) is still in the code; override it with
  `CONFIDENTIAL_PASSKEY`.
- Login throttle keys on the proxy's IP; no per-device session list yet.
- Do Not Disturb / quiet hours do not yet silence server push.
- The manifest says "end-to-end encrypted", which is not accurate (only files are encrypted at rest).
- Android: the status bar overlaps the header; link cards in the app show less than in the browser.
