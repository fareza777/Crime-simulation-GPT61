# Android build and release — BLACKLINE 1.1

## Delivered builds

`output/android/BLACKLINE-1.1.0-debug.apk` is installable and development signed. `output/android/BLACKLINE-1.1.0-release-unsigned.aab` is the release bundle without an upload signature. The build report records file sizes, SHA-256 hashes and verification results. Earlier 1.0 artifacts remain available for comparison.

The native project uses package `com.blackline.crimelife`, version name `1.1.0`, version code `2`, minimum SDK 24 and compile/target SDK 36. Portrait orientation is fixed. The icon, splash, Android Back, haptics, local Preferences and native share are included. The complete game and fonts are bundled. No backend or model credentials are needed; optional Google ads, consent and purchases use network services.

## Rebuild

Use Java 21, Node 22.12+ and an Android SDK installation containing platform 36. Configure `JAVA_HOME` and your local SDK path. `android/local.properties` is intentionally machine specific and ignored. Then:

```powershell
npm ci
npm run android:debug
npm run android:bundle
```

The commands build the web game, sync plugins/assets and run Gradle. Run sync before Gradle; do not regenerate the Capacitor/Cordova project during an active build. Outputs are `android/app/build/outputs/apk/debug/app-debug.apk` and `android/app/build/outputs/bundle/release/app-release.aab`. Install with `adb install -r` on the intended device. Reusing the original development key allows an upgrade that preserves local saves.

## Prepare the owner's store release

1. Confirm the final package identity and create the Google Play listing in the owner's developer account. Set version code/name for each later upload.
2. Create or use the owner's upload key. Keep keys/passwords outside this repository. Sign a release App Bundle through Android Studio's **Generate Signed App Bundle** flow and use Play App Signing.
3. Add the listing URL to `appInfo.playUrl` in `src/services/platform.ts`; the Rate button currently explains that release is pending. Shared text will then include the live listing.
4. Prepare the store description, icon, screenshots, content rating, privacy policy, Ads and accurate Data safety declarations for the actual release. Game progress remains local; optional Google ad/consent and billing SDKs can process device, network and transaction information.
5. Install the signed build on real phones, check offline first launch, save recovery, cutouts, system font settings, sound/haptics and native save export/import. Upload to an internal test track before publishing.

The account setup, owner signing key and publication are not included in this local build. Never distribute the development signing key as a production identity. The included release bundle is intentionally labelled unsigned.

## Ads and Remove Ads

Both delivered variants use official Google demo App/banner/interstitial/rewarded IDs in `android/app/monetization.properties`. Native adaptive banners sit below a resized WebView. Interstitials use eligible clean day boundaries, and optional rewarded supplies require earned completion plus dismissal. Network failures never block offline play or create a reward. SDK ad audio is requested muted.

`remove_ads` is a permanent INAPP one-time product. The requested US base price is **US$4.99**, active in Play Console, with the local price fetched from Google Play. The public RSA licensing key is configured in the Android properties; browser previews cannot purchase or create an entitlement. See [monetization and license testing](monetization.md) for exact dependencies, callbacks, consent and payment setup.

Exercise approved, cancelled, pending, restored and refunded orders with authorized license testers. Keep demo IDs during closed testing. Before a production release, replace all four IDs with the prepared owner units, configure AdMob Privacy & messaging and verify consent, no-fill behavior, ads declaration and privacy options.
