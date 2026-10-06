import { AbsoluteFill, Img, staticFile } from "remotion";
import "./fonts";

export type PosterProps = {
  readonly headline: string;
  readonly screen: string;
  readonly number: string;
  readonly background: string;
};

export const StoreScreenshot = ({
  headline,
  screen,
  number,
  background,
}: PosterProps) => (
  <AbsoluteFill
    style={{
      backgroundColor: "#0c0e10",
      color: "#f2e9da",
      fontFamily: "Outfit",
      overflow: "hidden",
    }}
  >
    <Img
      src={staticFile(`art/${background}.webp`)}
      style={{
        position: "absolute",
        width: "100%",
        height: "100%",
        objectFit: "cover",
        opacity: 0.14,
      }}
    />
    <AbsoluteFill
      style={{
        background: "linear-gradient(180deg,rgba(10,12,14,.18),#0c0e10 65%)",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 42,
        left: 82,
        right: 82,
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        color: "#cbb083",
        fontSize: 28,
        letterSpacing: 6,
        fontWeight: 500,
      }}
    >
      <span>BLACKLINE</span>
      <span style={{ fontSize: 25, letterSpacing: 3, color: "#968976" }}>
        {number} / 08
      </span>
    </div>
    <h1
      style={{
        position: "absolute",
        top: 88,
        left: 82,
        right: 62,
        margin: 0,
        fontFamily: "Oswald",
        fontWeight: 550,
        fontSize: 108,
        lineHeight: 1.055,
        letterSpacing: -2.5,
        whiteSpace: "pre-line",
      }}
    >
      {headline}
    </h1>
    <div
      style={{
        position: "absolute",
        left: 82,
        top: 322,
        height: 3,
        width: 134,
        backgroundColor: "#cbb083",
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 105,
        top: 342,
        width: 870,
        height: 1546.667,
        borderRadius: 20,
        overflow: "hidden",
        border: "1px solid rgba(203,176,131,.4)",
        boxShadow: "0 22px 70px rgba(0,0,0,.5)",
      }}
    >
      <Img
        src={staticFile(`game/${screen}.png`)}
        style={{ width: "100%", height: "100%", objectFit: "contain" }}
      />
    </div>
  </AbsoluteFill>
);

export const FeatureGraphic = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#0c0e10",
      color: "#f2e9da",
      fontFamily: "Outfit",
      overflow: "hidden",
    }}
  >
    <Img
      src={staticFile("art/city.webp")}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(90deg,rgba(8,10,12,.94) 0%,rgba(8,10,12,.86) 34%,rgba(8,10,12,.23) 70%,rgba(8,10,12,.02))",
      }}
    />
    <Img
      src={staticFile("art/icon.png")}
      style={{
        position: "absolute",
        top: 50,
        left: 56,
        width: 91,
        height: 91,
        borderRadius: 0,
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 62,
        left: 168,
        fontSize: 21,
        letterSpacing: 5,
        color: "#cbb083",
      }}
    >
      CRIME LIFE RPG
    </div>
    <div
      style={{
        position: "absolute",
        top: 111,
        left: 55,
        fontFamily: "Oswald",
        fontSize: 102,
        lineHeight: 1.18,
        fontWeight: 550,
        letterSpacing: 0,
      }}
    >
      BLACKLINE<span style={{ color: "#cbb083" }}>.</span>
    </div>
    <div
      style={{
        position: "absolute",
        top: 249,
        left: 59,
        width: 83,
        height: 2,
        backgroundColor: "#cbb083",
      }}
    />
    <div
      style={{
        position: "absolute",
        top: 276,
        left: 58,
        fontFamily: "Oswald",
        fontSize: 39,
        lineHeight: 1.2,
        fontWeight: 400,
      }}
    >
      Every choice
      <br />
      leaves a mark.
    </div>
    <div
      style={{
        position: "absolute",
        bottom: 52,
        left: 60,
        fontSize: 18,
        letterSpacing: 4,
        color: "#cbb083",
      }}
    >
      YOUR CHOICES. YOUR EMPIRE.
    </div>
  </AbsoluteFill>
);

export const TrailerThumbnail = () => (
  <AbsoluteFill
    style={{
      backgroundColor: "#0c0e10",
      color: "#f2e9da",
      fontFamily: "Outfit",
    }}
  >
    <Img
      src={staticFile("art/vault.webp")}
      style={{ width: "100%", height: "100%", objectFit: "cover" }}
    />
    <AbsoluteFill
      style={{
        background:
          "linear-gradient(90deg,#090b0d 5%,rgba(9,11,13,.8) 34%,rgba(9,11,13,0) 80%)",
      }}
    />
    <Img
      src={staticFile("art/icon.png")}
      style={{
        position: "absolute",
        left: 108,
        top: 91,
        width: 148,
        height: 148,
      }}
    />
    <div
      style={{
        position: "absolute",
        left: 110,
        top: 310,
        fontFamily: "Oswald",
        fontWeight: 550,
        fontSize: 132,
        lineHeight: 1.09,
      }}
    >
      ONE WRONG MOVE.
      <br />
      <span style={{ color: "#cbb083" }}>EVERYTHING CHANGES.</span>
    </div>
    <div
      style={{
        position: "absolute",
        left: 116,
        bottom: 129,
        fontFamily: "Oswald",
        fontSize: 55,
        letterSpacing: 6,
      }}
    >
      BLACKLINE.
    </div>
  </AbsoluteFill>
);
