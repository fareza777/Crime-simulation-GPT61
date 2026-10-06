import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import {
  getCompositions,
  openBrowser,
  renderMedia,
  renderStill,
} from "@remotion/renderer";
import { chromium } from "playwright";
import sharp from "sharp";

const project = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const destination = path.resolve(project, "..", "output", "playstore");
const mode = process.argv[2] ?? "all";
if (!["all", "stills", "videos"].includes(mode))
  throw new Error("Use all, stills or videos.");
await mkdir(path.join(destination, "screenshots"), { recursive: true });
await mkdir(path.join(destination, "review"), { recursive: true });
const serveUrl = await bundle({
  entryPoint: path.join(project, "src/index.ts"),
  rootDir: project,
  publicDir: path.join(project, "public"),
  outDir: path.join(project, ".cache/render-bundle"),
  rspack: true,
});
const executable = chromium.executablePath();
const browser = await openBrowser("chrome", {
  browserExecutable: existsSync(executable) ? executable : undefined,
  logLevel: "warn",
});
const errors = [];
const onBrowserLog = (log) => {
  if (log.type === "error") errors.push(log.text);
};
try {
  const compositions = await getCompositions(serveUrl, {
    puppeteerInstance: browser,
    onBrowserLog,
  });
  const find = (id) => {
    const composition = compositions.find((c) => c.id === id);
    if (!composition) throw new Error(`Missing composition ${id}`);
    return composition;
  };
  await writeFile(
    path.join(destination, "review/compositions.json"),
    JSON.stringify(
      compositions.map(
        ({ id, width, height, fps, durationInFrames, defaultProps }) => ({
          id,
          width,
          height,
          fps,
          durationInFrames,
          defaultProps,
        }),
      ),
      null,
      2,
    ),
  );

  if (mode !== "videos") {
    for (const composition of compositions.filter(
      (c) =>
        c.id.startsWith("Screenshot-") ||
        ["Feature-Graphic", "Trailer-Thumbnail"].includes(c.id),
    )) {
      const { buffer } = await renderStill({
        serveUrl,
        composition,
        puppeteerInstance: browser,
        imageFormat: "png",
        frame: 0,
        onBrowserLog,
      });
      const filename = composition.id.startsWith("Screenshot-")
        ? `screenshots/${composition.id.replace("Screenshot-", "").toLowerCase()}.png`
        : composition.id === "Feature-Graphic"
          ? "feature-graphic-1024x500.png"
          : "trailer-thumbnail-1920x1080.png";
      await sharp(buffer)
        .flatten({ background: "#0c0e10" })
        .removeAlpha()
        .withIccProfile("srgb")
        .png({ compressionLevel: 9 })
        .toFile(path.join(destination, filename));
      process.stdout.write(`Exported ${filename}\n`);
    }
    const frames = [60, 101, 178, 310, 445, 580, 715, 838, 912, 1045];
    for (const id of [
      "BLACKLINE-PlayStore-Portrait",
      "BLACKLINE-Cinematic-Landscape",
    ]) {
      for (const frame of frames) {
        const composition = find(id);
        const filename = `review/${composition.width < composition.height ? "portrait" : "landscape"}-${String(frame).padStart(4, "0")}.jpg`;
        await renderStill({
          serveUrl,
          composition,
          puppeteerInstance: browser,
          imageFormat: "jpeg",
          jpegQuality: 91,
          frame,
          output: path.join(destination, filename),
          onBrowserLog,
        });
      }
      process.stdout.write(`Reviewed ${id}: ten key frames exported.\n`);
    }
    const posterPaths = compositions
      .filter((c) => c.id.startsWith("Screenshot-"))
      .map((c) =>
        path.join(
          destination,
          "screenshots",
          `${c.id.replace("Screenshot-", "").toLowerCase()}.png`,
        ),
      );
    const thumbs = await Promise.all(
      posterPaths.map((f) => sharp(f).resize(252, 448).toBuffer()),
    );
    const contactSheet = await sharp({
      create: { width: 1136, height: 1084, channels: 3, background: "#0c0e10" },
    })
      .composite([
        {
          input: Buffer.from(
            '<svg width="1136" height="1084"><text x="40" y="56" fill="#e0c398" font-family="Arial" font-size="29" letter-spacing="5">BLACKLINE / PLAY STORE COLLECTION</text><text x="40" y="92" fill="#a39988" font-family="Arial" font-size="17">Eight genuine gameplay screens · English · 1080 × 1920</text></svg>',
          ),
          left: 0,
          top: 0,
        },
        ...thumbs.map((input, index) => ({
          input,
          left: 40 + (index % 4) * 268,
          top: 128 + Math.floor(index / 4) * 472,
        })),
      ])
      .jpeg({ quality: 94 })
      .toBuffer();
    await writeFile(path.join(destination, "contact-sheet.jpg"), contactSheet);
  }

  if (mode !== "stills") {
    for (const [id, filename] of [
      [
        "BLACKLINE-PlayStore-Portrait",
        "BLACKLINE-PlayStore-Portrait-1080x1920.mp4",
      ],
      [
        "BLACKLINE-Cinematic-Landscape",
        "BLACKLINE-Cinematic-Landscape-1920x1080.mp4",
      ],
    ]) {
      let previousStep = -1;
      await renderMedia({
        serveUrl,
        composition: find(id),
        puppeteerInstance: browser,
        codec: "h264",
        audioCodec: "aac",
        audioBitrate: "192k",
        sampleRate: 48000,
        crf: 17,
        pixelFormat: "yuv420p",
        imageFormat: "jpeg",
        jpegQuality: 95,
        concurrency: 2,
        outputLocation: path.join(destination, filename),
        overwrite: true,
        onBrowserLog,
        metadata: {
          title: "BLACKLINE — Every choice leaves a mark.",
          comment:
            "Real BLACKLINE gameplay. Original rain and mechanical SFX. No music, instruments or voices.",
        },
        onProgress: ({ progress }) => {
          const step = Math.floor(progress * 10);
          if (step !== previousStep) {
            previousStep = step;
            process.stdout.write(`${id}: ${step * 10}%\n`);
          }
        },
      });
      process.stdout.write(`Exported ${filename}\n`);
    }
  }
  if (errors.length)
    throw new Error(`Browser render errors: ${errors.join("\n")}`);
  process.stdout.write(
    `BLACKLINE ${mode} export complete. No browser render errors.\n`,
  );
} finally {
  await browser.close({ silent: true });
}
