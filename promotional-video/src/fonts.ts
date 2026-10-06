import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

await Promise.all([
  loadFont({
    family: "Oswald",
    url: staticFile("fonts/Oswald.woff2"),
    weight: "100 900",
  }),
  loadFont({
    family: "Outfit",
    url: staticFile("fonts/Outfit.woff2"),
    weight: "100 900",
  }),
]);
