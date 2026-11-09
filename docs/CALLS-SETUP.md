# Voice and video calls setup (one time)

Calls run through LiveKit Cloud. They stay off, and the call buttons stay hidden, until all three values are set.

1. Create a free project at https://cloud.livekit.io.
2. In the project, open **Settings > Keys** and create a key. Note the **WebSocket URL** (`wss://<project>.livekit.cloud`),
   the **API key** and the **API secret**.
3. On Render, set these environment variables on the backend and redeploy:
   - `LIVEKIT_URL` = the `wss://...` URL
   - `LIVEKIT_API_KEY` = the API key
   - `LIVEKIT_API_SECRET` = the API secret (keep it private; never commit it or paste it in chat)
4. Open a direct message. A phone and a video icon appear in the header. Calls are 1-to-1 and only inside direct messages.

To try it on this computer, add the same three `export` lines to `.local-test/env` and restart the backend.

## How it behaves
- The other person's screen rings within a second over the live connection. If they are on another call, the caller is told.
- Unanswered calls stop ringing after 45 seconds and leave "Missed voice/video call" in the chat. Answered calls leave
  "Voice/Video call - 4:12".
- Video targets 720p at 30 fps with adaptive quality, echo cancellation, noise suppression and automatic gain.
- If the app is closed, the phone gets a "calls" push notification (needs Firebase, see `mobile/PUSH-SETUP.md`); tapping it
  opens the app and shows the ringing call.
- Ringing state is kept in the backend's memory, so run a single backend instance.
