# Desktop push notifications setup (one time)

Notifications reach Chrome, Edge, Firefox and installed web apps on a computer or phone, even with every Taskis
tab closed (the browser itself must be running, as with WhatsApp Web). No third-party account is needed.

1. Generate the keys once, on any computer with `openssl`:
   ```bash
   scripts/generate-vapid-keys.sh
   ```
2. On Render, set these environment variables on the backend and redeploy:
   - `VAPID_PUBLIC_KEY` = the first value
   - `VAPID_PRIVATE_KEY` = the second value (keep it private; never commit it or paste it in chat)
   - `VAPID_SUBJECT` (optional) = your site address or a `mailto:` address
   Do not regenerate the keys later: every browser would have to subscribe again.
3. Open Taskis in a desktop browser and allow notifications when asked (or turn on "Desktop alerts" in Settings).
   The log line `Desktop push enabled.` confirms the backend is ready.

## Behaviour
- Every new message and every incoming call notifies the person's subscribed browsers.
- The text says who wrote and how many are unread, never the message, unless the person turns off
  "Hide message text in push alerts" in Settings. `#confidential` is always hidden.
- Nothing is sent while the person has Taskis open and in front of them, and a click on a notification opens that
  conversation.
- When this is on, the old in-page popup stands down so nothing appears twice.
- Logging out removes that browser's subscription.
- Safari on iPhone and Mac only supports this for the installed web app (Share > Add to Home Screen / Add to Dock).

## Not covered yet
- The "Do Not Disturb" and quiet-hours settings only silence the in-page sound; the server does not know about them yet.
