# BLACKLINE — Every choice leaves a mark.

An editable Remotion campaign for the portrait crime RPG. The trailer opens on an actual warehouse decision, shows its actual result, then introduces statistics, crew, territory, businesses, tactical encounters and a multi-stage operation. Both trailers are 36 seconds at 30 fps. Every marketing line is English.

## Preview and export

Install the root game's dependencies first. The export helper uses the root's Sharp and Playwright installations; Remotion is isolated in this directory so the game's React version is unaffected.

```powershell
# At the repository root
npm ci
npx playwright install chromium
cd promotional-video
npm ci
npm run dev
```

Open the exact local URL printed by Studio. The composition picker contains both complete trailers, eight connected scene clips, eight store screenshots, the feature graphic and the trailer thumbnail. Text and image surfaces have named Studio controls.

```powershell
npm run lint
npm run stills
npm run videos
# Or render the entire collection
npm run export
```

Exports are written to `../output/playstore/`. Both videos use H.264 with 8-bit 4:2:0 color and stereo 48 kHz AAC. Stills are converted to sRGB RGB PNG for Play Console; the app icon is RGBA PNG. All fonts, illustrations, UI captures and audio are local.

## Edit the campaign

- `src/Root.tsx`: explicit Studio registrations and screenshot headlines.
- `src/Trailer.tsx`: eight scenes, seven 12-frame dissolves and named SFX clips.
- `src/scenes/`: one component per scene; `SceneFrame.tsx` adapts the layout to portrait or landscape.
- `src/Stills.tsx`: the screenshot collection, feature graphic and thumbnail.
- `public/game/`: real screenshots captured from an isolated demonstration save.
- `public/art/`: original generated city, vault and non-human vault monogram, plus existing game illustrations.
- `public/audio/`: original rain/air, paper, keys, latch and vault mechanisms. No instruments, music, melodies or voices.

The eight scene lengths are 132, 147, 147, 147, 147, 147, 210 and 87 frames. Subtract seven 12-frame overlaps: 1080 frames, exactly 36 seconds. Gameplay remains visible through approximately the first 33.1 seconds. The opening highlights the game's existing informant choice; it does not replace any game statistics or decisions.

For refreshed game captures, run the game's development server, then `node scripts/capture-playstore-game.mjs` from the repository root. This creates its own browser context and never imports or changes a player's save. `prepare-playstore-art.mjs` and `prepare-playstore-audio.mjs` reproduce the derived art and original non-musical audio.

See [the campaign handoff](../docs/playstore-campaign.md) for file specifications, image provenance and Play Console upload instructions. Remotion's [license terms](https://www.remotion.dev/license) apply to future use of its renderer.
