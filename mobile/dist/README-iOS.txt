Taskis iPhone app

This zip is the Xcode project. A signed .ipa cannot be produced on Linux —
Apple requires Xcode + an Apple ID / Developer account on a Mac.

On a Mac:
1. Unzip Taskis-iOS.zip
2. Open ios/App/App.xcworkspace (or App.xcodeproj)
3. Select your Team under Signing & Capabilities
4. Product → Archive, then Distribute App → Ad Hoc or App Store
5. That produces Taskis.ipa

Until then, on iPhone: open https://tasikisi.salynelson.rw in Safari,
tap Share → Add to Home Screen. That installs Taskis like an app.
