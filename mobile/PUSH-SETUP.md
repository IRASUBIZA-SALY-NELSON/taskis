# Push notifications setup (one time)

Push is built in but stays off until Firebase is connected.

1. Go to https://console.firebase.google.com and create a project (free; Analytics can be off).
2. In the project, **Add app > Android**. Package name: `rw.salynelson.taskis`. Download `google-services.json`
   and put it at `mobile/android/app/google-services.json`.
3. **Project settings > Service accounts > Generate new private key.** Open the downloaded JSON, copy all of it,
   and set it on Render as the environment variable `FIREBASE_SERVICE_ACCOUNT`. Never commit this file or paste it in chat.
4. Redeploy the backend. The log should say `Push notifications enabled.`
5. Rebuild and install the app:
   ```bash
   cd mobile && npx cap sync android
   cd android && JAVA_HOME=/usr/lib/jvm/java-21-openjdk-amd64 ./gradlew assembleDebug
   adb install -r app/build/outputs/apk/debug/app-debug.apk
   ```
6. Open the app, allow notifications, then send that user a message from another account while the app is closed.

Notifications show who wrote and how many are unread, never the text, unless the user turns off
"Hide message text in push alerts" in Settings. `#confidential` is always hidden.
