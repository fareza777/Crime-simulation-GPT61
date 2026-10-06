import { useCurrentFrame } from "remotion";
import { SceneFrame } from "./SceneFrame";

export const Heist = () => {
  const frame = useCurrentFrame();
  return (
    <SceneFrame
      label="THE BIGGER SCORE."
      title={"Plan every stage.\nOwn the escape."}
      note="Select the crew. Check the equipment. Control suspicion through multi-stage operations and the Meridian heist."
      screen={frame < 70 ? "heist-plan" : "heist"}
      background="vault"
    />
  );
};
