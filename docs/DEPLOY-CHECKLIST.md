# Deploy checklist

Do the **Before merging** part first. Your workflow redeploys on every push to `main`, and the new backend refuses to start
without `JWT_SECRET`.

## 1. Before merging

### Required (the backend will not start without the first one)
| Variable | Where | What to put |
|---|---|---|
| `JWT_SECRET` | Render **and** the `taskis` service on `/home/plp/taskis` | A new random value, 64+ characters: `openssl rand -hex 48` |
| `TASKIS_FILE_SECRET` | same places | The **old** secret, so files already stored stay readable. Get it with `git show main:backend/src/main/resources/application.properties` (the value after `JWT_SECRET:`). Needed on the self-hosted server if its `backend/uploads` folder holds files you want to keep |
| `CONFIDENTIAL_PASSKEY` | same places | A new value. The old default (`20300`) is still in the code until the confidential redesign |
| `ADMIN_PASSWORD` | same places | A strong new admin password for the first deploy only. Log in as `nelson`, then **delete the variable** |

The self-hosted workflow runs `systemctl restart taskis`, so the variables above must be in that service's environment
(`Environment=` or an `EnvironmentFile=` in its unit), not only on Render.

### Recommended (faster app, bigger uploads)
| Variable | Where | What to put |
|---|---|---|
| `NEXT_PUBLIC_API_BASE` | Vercel (frontend) | `https://taskis-api.onrender.com`. Today the browser goes through Vercel's proxy, which limits uploads to about 4.5 MB and probably forces live chat onto slow long-polling. This points the app straight at the API. Redeploy the frontend after setting it |

### Optional features (each stays off until its values are set)
| Feature | Variables | Guide |
|---|---|---|
| Persistent files (**do this before going live**) | `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY` | `docs/FILE-STORAGE-SETUP.md` |
| Voice and video calls | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET` | `docs/CALLS-SETUP.md` |
| Desktop push | `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` (`scripts/generate-vapid-keys.sh`) | `docs/DESKTOP-PUSH-SETUP.md` |
| Phone push | `FIREBASE_SERVICE_ACCOUNT` + `google-services.json` in the Android app | `mobile/PUSH-SETUP.md` |

Never commit these values or paste them in chat. Do not regenerate the VAPID keys later (everyone would have to resubscribe).

## 2. Merge, then confirm in the backend log
- `File storage: S3-compatible bucket '...'` (if it says `local disk`, the S3 values are missing)
- `Desktop push enabled.` / `Push notifications enabled.` for the features you configured
- No error about `JWT_SECRET`

## 3. Smoke test (10 minutes)
1. Log in once, close the browser completely, open it again: you should still be signed in.
2. Upload a PDF and a photo in a chat, reload, open them. Then redeploy and open them again (this proves the storage fix).
3. Send a link and a PDF: both show a preview card.
4. Open a DM: phone and video icons appear (if LiveKit is set). Call yourself from a second account.
5. Allow notifications in a desktop browser, close the tab, have someone message you: a notification arrives.
6. Install the new Android APK, share a link from Chrome to Taskis, pick a person, send.
7. Watch the sidebar: online dots change without reloading.

## 4. Things to know
- **Everyone signs in once more** after the deploy (new session system and a new `JWT_SECRET`).
- **Rollback caution:** files uploaded after the merge use a new encryption format that the old code cannot open. Rolling back
  loses access to those files, so fix forward if you can.
- **Run a single backend instance** (presence and call ringing are kept in memory).
- **The Android app needs a new build** (share receiver, push plugin). Web changes reach it without one.
- Files that exist only on Render's disk right now are lost at the next deploy; download any that matter first.
