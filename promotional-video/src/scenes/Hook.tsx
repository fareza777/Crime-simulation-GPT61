import { useCurrentFrame } from "remotion";
import { SceneFrame } from "./SceneFrame";

export const Hook = () => {
  const frame = useCurrentFrame();
  return (
    <SceneFrame
      label="A SCORE. A CHOICE. A CONSEQUENCE."
      title={"One wrong move.\nEverything changes."}
      note="An $8,000–$18,000 opportunity. Preparation changes your odds. Every decision has a cost."
      screen={frame < 81 ? "decision" : "outcome"}
      background="vault"
      focus={
        frame < 81
          ? { x: 67, y: 1140, width: 945, height: 170, from: 46, to: 80 }
          : undefined
      }
    />
  );
};
