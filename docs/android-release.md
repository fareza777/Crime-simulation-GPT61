# Android build and release

## Delivered builds

`output/android/BLACKLINE-1.0.0-debug.apk` is installable and development signed. `output/android/BLACKLINE-1.0.0-release-unsigned.aab` is the release bundle without an upload signature. The build report in the same folder records file sizes and SHA-256 hashes.

The native project uses package `com.blackline.crimelife`, version name `1.0.0`, version code `1`, minimum SDK 24 and compile/target SDK 36. Portrait orientation is fixed. The adaptive launcher icon, splash, Android Back, haptics, local Preferences and native share are included. No server URL, remote fonts, model service or API credentials are needed.

## Rebuild

Use Java 21, Node 22.12+ and an Android SDK installation containing platform 36. Configure `JAVA_HOME` and your local SDK path. `android/local.properties` is intentionally machine specific and ignored. Then:

```powershell
npm ci
npm run android:debug
npm run android:bundle
```

The commands build the web game, sync the plugins/assets and run Gradle. Outputs are `android/app/build/outputs/apk/debug/app-debug.apk` and `android/app/build/outputs/bundle/release/app-release.aab`. To install a test build on a connected device use `adb install -r` with the APK path.

## Prepare the owner's store release

1. Confirm the final package identity and create the Google Play listing in the owner's developer account. Set version code/name for each later upload.
2. Create or use the owner's upload key. Keep keys/passwords outside this repository. Sign a release App Bundle through Android Studio's **Generate Signed App Bundle** flow and use Play App Signing.
3. Add the listing URL to `appInfo.playUrl` in `src/services/platform.ts`; the Rate button currently explains that release is pending. Shared text will then include the live listing.
4. Prepare the store description, icon, screenshots, content rating, privacy policy and accurate Data safety declarations for the actual release. Current game progress remains local and there are no ads, analytics, accounts or purchases.
5. Install the signed build on real phones, check offline first launch, save recovery, cutouts, system font settings, sound/haptics and native save export/import. Upload to an internal test track before publishing.

The account setup, owner signing key and publication are not included in this local build. Never distribute the development signing key as a production identity. The included release bundle is intentionally labelled unsigned.

## Optional AdMob integration

`src/services/ads.ts` defines `AdsService`, a disabled implementation and `setAdsService`. Rewarded placements are `energy` and `cash`; the interstitial placement is `day-end`. The shipped app does not show ads and does not award fake ad rewards.

To integrate later, implement the contract using a Capacitor Android ad SDK, configure the owner's app/ad-unit IDs, initialize consent where required, and call `setAdsService` at startup. A rewarded method may resolve `true` only on the verified reward-completion callback, with cancellation/errors returning `false`. Add an explicit opt-in UI and a guarded engine action for any resulting reward. Interstitials belong at a completed day boundary, outside decisions and heist stages. Keep all game progression and saving usable when offline or when ads are unavailable.

Review SDK, consent, privacy declarations and store requirements against the actual release configuration. The current boundary is ready for integration; no AdMob SDK is shipped or activated.
