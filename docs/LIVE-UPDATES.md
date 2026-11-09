# Live updates (no more polling)

The sidebar and presence used to ask the server for everything every 5 seconds. Now the server announces changes the
moment they happen and the app listens.

## What is live
- **Online / away / offline** dots: the server tracks who is connected and announces changes on `/topic/presence`.
  Someone is ACTIVE with the app in front of them, AWAY when connected but not in front, OFFLINE 15 seconds after their last
  connection drops (so a quick reconnect does not flicker).
- **Names, avatars, new members, role and active changes**: announced on `/topic/directory`; the sidebar, the chat header and
  the feed's suggestions reload the list once.
- **Unread dots**: the sidebar listens to each conversation and lights the dot the moment a message arrives in one that is not open.
- **Catching up**: after a reconnect, waking the phone, or returning to the tab, the app reloads once to catch up on anything missed.
  A slow safety-net reload (5 minutes) remains in case an event is ever lost.

## What changed on the server
- `GET /api/chat/channels/latest` used to read every message in the database on every call (and returned activity for other
  people's private chats). It is now one database aggregation and only returns channels the caller may see.
- The app reports "I'm here" on focus changes and every 20 seconds, not every 5, and presence is no longer written to the
  database on every report (only when it changes).
- Phone and desktop push now skip anyone who is actively looking at the app, using the same presence.

## Limits
- Presence is kept in the backend's memory: run a single backend instance (as with calls).
