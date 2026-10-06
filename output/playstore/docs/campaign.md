# BLACKLINE — Play Store campaign

**Creative idea: “Every choice leaves a mark.”**

Blackwater is presented through charcoal, ivory and champagne gold: a non-human vault monogram, an original rainy port skyline and an open Art Deco vault. The eight screenshots show the current game UI. Characters use opaque masks, helmets and dark hoods; environmental figures are distant, dark or turned away. The icon contains no person, face, animal or skull. All copy is English.

## Delivered files

| File in `output/playstore/` | Format / purpose |
| --- | --- |
| `app-icon-512.png` | 512 × 512, sRGB RGBA PNG, full square, no pre-rounded corners |
| `app-icon-1024.png` | 1024 × 1024 icon master |
| `feature-graphic-1024x500.png` | 1024 × 500, sRGB RGB PNG, Play feature graphic |
| `screenshots/01-rise.png` through `08-story.png` | Eight 1080 × 1920 portrait RGB PNG screenshots, ordered for the listing |
| `BLACKLINE-PlayStore-Portrait-1080x1920.mp4` | 36-second 9:16 trailer, H.264 / stereo AAC, 30 fps |
| `BLACKLINE-Cinematic-Landscape-1920x1080.mp4` | 36-second 16:9 trailer, H.264 / stereo AAC, 30 fps |
| `trailer-thumbnail-1920x1080.png` | English vault hook artwork for the video thumbnail |
| `contact-sheet.jpg` | Overview of all eight screenshots |
| `gallery.html` | Offline gallery with both videos and full-resolution images |
| `alt-text.json` | English accessibility descriptions for the listing |
| `asset-validation.json` | Dimensions, formats, checksums and video/audio verification |
| `android-launcher/` | Vault icon resource pack, five Android densities and adaptive icon XML |
| `BLACKLINE-PlayStore-Kit.zip` | Upload assets, launcher resources, local gallery and handoff documents |

The Android resource pack is delivered separately from the game's already-built APK/AAB. It provides `ic_launcher`, an inset `ic_launcher_foreground`, an adaptive icon and a charcoal background. Test adaptive masks on a device before making a future signed release. The current game UI is reproduced faithfully in every screenshot.

## Screenshot sequence

| Order | English headline | Actual screen |
| --- | --- | --- |
| 01 | Your rise. Your rules. | Six statistics, district and warehouse opportunity |
| 02 | Every choice leaves a mark. | Warehouse cost, odds, Heat, energy and alternative decisions |
| 03 | Take the city. Zone by zone. | Five districts, 15 zones, connected territory and rival actions |
| 04 | Loyalty is never guaranteed. | Masked crew, loyalty, fatigue and payroll |
| 05 | Build income. Balance power. | Business income, salaries and upgrades |
| 06 | Outthink your rivals. | A genuine three-round tactical encounter |
| 07 | Plan the score. Own the escape. | Multi-stage operation, crew selection and required equipment |
| 08 | Your story. Your legacy. | Main story chapters and Meridian objective |

The marketing header occupies under 20% of each screenshot. The first three show the game's experience directly. No ranking claims, prices, install requests or Google Play badges are embedded in the screenshots or feature graphic.

## Trailer edit

| Time | Scene and purpose |
| --- | --- |
| 0.0–4.4 s | “One wrong move. Everything changes.” Actual warehouse choice, informant highlight and resulting reward/Heat |
| 4.0–8.9 s | “Money opens doors. Heat closes them.” The real player dashboard |
| 8.5–13.4 s | “Hire the talent. Earn the loyalty.” Crew and payroll |
| 13.0–17.9 s | “Take the city. Zone by zone.” Illustrated territory map |
| 17.5–22.4 s | “Build the income. Carry the costs.” Passive business income |
| 22.0–26.9 s | “Outthink the rivals. Protect the crew.” Tactical choices, morale and exposure |
| 26.5–33.5 s | “Plan every stage. Own the escape.” Selected crew followed by the actual first Harbor Ledger stage |
| 33.1–36.0 s | BLACKLINE vault monogram and “Every choice leaves a mark.” |

The 0.4-second overlaps are deliberate dissolves. UI appears immediately and occupies more than 90% of the timeline. Large on-screen English hooks make the trailer understandable with sound muted. Portrait and landscape are independently laid out, without letterboxing or stretching the game UI.

## Audio and image provenance

The audio is original, deterministic stereo broadband noise with physical-style filtering and irregular mechanical transients. Rain/wind, paper, keys, air, a latch and a vault door replace a musical soundtrack. There are no instruments, melodies, musical beats, voices or third-party recordings. Source details and waveform levels are in `audio-provenance.json`; the finished mix is checked for clipping.

Three original illustrations were made with the built-in image generator. Full prompts and source paths are recorded in [playstore-art-prompts.json](playstore-art-prompts.json). Generated source images are preserved in `output/playstore/source/`; derived files only change size, encoding or color space. Existing illustrations inside the UI retain their original provenance in [art-prompts.json](art-prompts.json) and [underworld-art-prompts.json](underworld-art-prompts.json).

Gameplay was captured from the current local game using a separate seeded demonstration profile on day 24. It illustrates developed progression and does not represent a new player's starting resources. The warehouse outcome was resolved by the real game rules. All 13 reviewed screens loaded their images with no JavaScript errors or horizontal overflow. See `game-review.json` and `scripts/capture-playstore-game.mjs`.

Oswald and Outfit are bundled locally under their SIL Open Font Licenses. Font licenses accompany the handoff. The editable video source and locked Remotion dependencies are in `promotional-video/`.

## Google Play handoff

1. Upload `app-icon-512.png` and `feature-graphic-1024x500.png` to the main English listing.
2. Upload the eight files in `screenshots/`, in numbered order, as phone screenshots.
3. Upload the portrait MP4 to the owner's YouTube channel as a public or unlisted video. Enable embedding, disable monetization/ads and avoid age restrictions. Use the thumbnail if appropriate.
4. Paste the YouTube video's URL into Play Console's preview-video field. Play Console uses a YouTube link, rather than accepting the MP4 directly. The landscape MP4 is an additional YouTube/social option.
5. Review the actual listing on a phone before publishing. This delivery does not publish a listing, upload a YouTube video or change app signing.

These dimensions and listing requirements follow Google's [preview asset guidance](https://support.google.com/googleplay/android-developer/answer/9866151?hl=en) and [high-resolution icon specification](https://developer.android.com/distribute/google-play/resources/icon-design-specifications). They were checked on 6 October 2026. Rendering uses the official [Remotion renderer](https://www.remotion.dev/docs/renderer/render-media) and [media Audio component](https://www.remotion.dev/docs/media/audio).

## Reproduce

```powershell
# Repository root, with the game available on port 5173 for fresh captures
node scripts/prepare-playstore-art.mjs
node scripts/capture-playstore-game.mjs
node scripts/prepare-playstore-audio.mjs
cd promotional-video
npm ci
npm run lint
npm run export
cd ..
node scripts/finish-playstore-kit.mjs
node scripts/verify-playstore-gallery.mjs
```

The final packaging script validates asset formats and the actual encoded videos, generates the gallery/accessibility metadata and builds a ZIP. The renderer uses local art, UI, fonts and audio; no remote assets or API calls are needed for rendering after dependency installation.
