import type { ReactNode } from "react";
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

type Props = {
  readonly label: string;
  readonly title: string;
  readonly note: string;
  readonly screen: string;
  readonly background?: string;
  readonly children?: ReactNode;
  readonly focus?: {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
    readonly from: number;
    readonly to: number;
  };
};

export const SceneFrame = ({
  label,
  title,
  note,
  screen,
  background = "city",
  children,
  focus,
}: Props) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const portrait = height > width;
  return (
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
          opacity: portrait ? 0.19 : 0.34,
          scale: interpolate(frame, [0, 210], [1.07, 1.01], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      />
      <AbsoluteFill
        style={{
          background: portrait
            ? "linear-gradient(180deg,rgba(9,11,13,.64),rgba(9,11,13,.86) 55%,#0c0e10)"
            : "linear-gradient(90deg,rgba(9,11,13,.92),rgba(9,11,13,.74) 47%,rgba(9,11,13,.58))",
        }}
      />
      <Interactive.Div
        name="Scene label"
        style={{
          position: "absolute",
          top: portrait ? 58 : 85,
          left: portrait ? 82 : 118,
          fontSize: portrait ? 29 : 28,
          fontWeight: 500,
          letterSpacing: 6,
          color: "#cbb083",
          opacity: interpolate(frame, [0, 14], [0, 1], {
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 18], ["0px 18px", "0px 0px"], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {label}
      </Interactive.Div>
      <Interactive.Div
        name="Scene headline"
        style={{
          position: "absolute",
          left: portrait ? 82 : 115,
          top: portrait ? 111 : 244,
          width: portrait ? 930 : 1100,
          fontFamily: "Oswald",
          fontWeight: 550,
          fontSize: portrait ? 105 : 131,
          lineHeight: 1.06,
          letterSpacing: portrait ? -2 : -3,
          whiteSpace: "pre-line",
          opacity: interpolate(frame, [0, 16], [0, 1], {
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 23], ["0px 44px", "0px 0px"], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        {title}
      </Interactive.Div>
      <Interactive.Div
        name="Gameplay surface"
        style={{
          position: "absolute",
          left: portrait ? 135 : 1270,
          top: portrait ? 365 : 75,
          width: portrait ? 810 : 505,
          height: portrait ? 1440 : 897.778,
          overflow: "hidden",
          border: "1px solid rgba(203,176,131,.48)",
          borderRadius: 18,
          boxShadow: "0 24px 70px rgba(0,0,0,.5)",
          opacity: interpolate(frame, [0, 13], [0.4, 1], {
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 25], ["0px 32px", "0px 0px"], {
            extrapolateRight: "clamp",
            easing: Easing.bezier(0.22, 1, 0.36, 1),
          }),
        }}
      >
        <Img
          src={staticFile(`game/${screen}.png`)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
        {focus && (
          <Interactive.Div
            name="Actual choice highlight"
            style={{
              position: "absolute",
              left: `${(focus.x / 1080) * 100}%`,
              top: `${(focus.y / 1920) * 100}%`,
              width: `${(focus.width / 1080) * 100}%`,
              height: `${(focus.height / 1920) * 100}%`,
              borderRadius: 15,
              border: "3px solid #e0c398",
              boxShadow: "0 0 24px rgba(203,176,131,.22)",
              boxSizing: "border-box",
              opacity: interpolate(
                frame,
                [focus.from, focus.from + 8, focus.to - 6, focus.to],
                [0, 0.9, 0.9, 0],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
            }}
          />
        )}
      </Interactive.Div>
      {!portrait && (
        <Interactive.Div
          name="Scene explanation"
          style={{
            position: "absolute",
            left: 119,
            top: 620,
            width: 920,
            fontSize: 44,
            lineHeight: 1.45,
            color: "#b6ae9f",
            opacity: interpolate(frame, [12, 28], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          {note}
        </Interactive.Div>
      )}
      {!portrait && (
        <Interactive.Div
          name="Brand footer"
          style={{
            position: "absolute",
            left: 119,
            bottom: 98,
            fontFamily: "Oswald",
            fontSize: 35,
            letterSpacing: 7,
            color: "#cbb083",
          }}
        >
          BLACKLINE.
        </Interactive.Div>
      )}
      {children}
    </AbsoluteFill>
  );
};
