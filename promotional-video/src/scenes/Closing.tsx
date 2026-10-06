import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import "../fonts";

export const Closing = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#090b0d",
        color: "#f2e9da",
        fontFamily: "Outfit",
        overflow: "hidden",
      }}
    >
      <Img
        src={staticFile("art/city.webp")}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.45,
          scale: interpolate(frame, [0, 87], [1.05, 1], {
            extrapolateRight: "clamp",
          }),
        }}
      />
      <AbsoluteFill
        style={{
          background:
            "linear-gradient(180deg,rgba(9,11,13,.1),rgba(9,11,13,.8) 80%)",
        }}
      />
      <Img
        src={staticFile("art/icon.png")}
        style={{
          position: "absolute",
          top: portrait ? 370 : 154,
          left: portrait ? 355 : 840,
          width: portrait ? 370 : 240,
          height: portrait ? 370 : 240,
          scale: interpolate(frame, [0, 32], [0.94, 1], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      />
      <Interactive.Div
        name="BLACKLINE title"
        style={{
          position: "absolute",
          top: portrait ? 807 : 415,
          left: 0,
          right: 0,
          textAlign: "center",
          fontFamily: "Oswald",
          fontWeight: 550,
          fontSize: portrait ? 162 : 166,
          letterSpacing: portrait ? 3 : 7,
          opacity: interpolate(frame, [3, 22], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        BLACKLINE<span style={{ color: "#cbb083" }}>.</span>
      </Interactive.Div>
      <Interactive.Div
        name="Closing hook"
        style={{
          position: "absolute",
          top: portrait ? 1050 : 641,
          left: 80,
          right: 80,
          textAlign: "center",
          fontSize: portrait ? 55 : 54,
          lineHeight: 1.3,
          color: "#e0c398",
          opacity: interpolate(frame, [8, 27], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        Every choice leaves a mark.
      </Interactive.Div>
      <Interactive.Div
        name="Offline genre"
        style={{
          position: "absolute",
          top: portrait ? 1180 : 744,
          left: 80,
          right: 80,
          textAlign: "center",
          fontSize: portrait ? 31 : 29,
          fontWeight: 500,
          letterSpacing: 6,
          color: "#b3a48f",
        }}
      >
        OFFLINE CRIME LIFE RPG
      </Interactive.Div>
    </AbsoluteFill>
  );
};
