import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { Sequence, staticFile } from "remotion";
import { Hook } from "./scenes/Hook";
import { Choices } from "./scenes/Choices";
import { Crew } from "./scenes/Crew";
import { Territory } from "./scenes/Territory";
import { Businesses } from "./scenes/Businesses";
import { Rivals } from "./scenes/Rivals";
import { Heist } from "./scenes/Heist";
import { Closing } from "./scenes/Closing";

export const Trailer = () => (
  <>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={132}>
        <Hook />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={147}>
        <Choices />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={147}>
        <Crew />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={147}>
        <Territory />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={147}>
        <Businesses />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={147}>
        <Rivals />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={210}>
        <Heist />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition
        presentation={fade()}
        timing={linearTiming({ durationInFrames: 12 })}
      />
      <TransitionSeries.Sequence durationInFrames={87}>
        <Closing />
      </TransitionSeries.Sequence>
    </TransitionSeries>
    <Audio src={staticFile("audio/rain-city.wav")} volume={0.78} />
    <Sequence
      name="Informant choice: keys"
      from={68}
      durationInFrames={21}
      layout="none"
    >
      <Audio src={staticFile("audio/keys.wav")} volume={0.7} />
    </Sequence>
    <Sequence
      name="Decision: latch"
      from={80}
      durationInFrames={10}
      layout="none"
    >
      <Audio src={staticFile("audio/latch.wav")} volume={0.6} />
    </Sequence>
    <Sequence
      name="Statistics: paper"
      from={122}
      durationInFrames={15}
      layout="none"
    >
      <Audio src={staticFile("audio/paper.wav")} volume={0.46} />
    </Sequence>
    <Sequence name="Crew: air" from={257} durationInFrames={24} layout="none">
      <Audio src={staticFile("audio/air.wav")} volume={0.42} />
    </Sequence>
    <Sequence
      name="Territory: latch"
      from={399}
      durationInFrames={10}
      layout="none"
    >
      <Audio src={staticFile("audio/latch.wav")} volume={0.45} />
    </Sequence>
    <Sequence
      name="Businesses: paper"
      from={531}
      durationInFrames={15}
      layout="none"
    >
      <Audio src={staticFile("audio/paper.wav")} volume={0.46} />
    </Sequence>
    <Sequence name="Rivals: air" from={666} durationInFrames={24} layout="none">
      <Audio src={staticFile("audio/air.wav")} volume={0.48} />
    </Sequence>
    <Sequence
      name="Heist plan: keys"
      from={832}
      durationInFrames={21}
      layout="none"
    >
      <Audio src={staticFile("audio/keys.wav")} volume={0.62} />
    </Sequence>
    <Sequence
      name="Heist entry: vault door"
      from={865}
      durationInFrames={72}
      layout="none"
    >
      <Audio src={staticFile("audio/vault-door.wav")} volume={0.68} />
    </Sequence>
    <Sequence
      name="Brand: final latch"
      from={1007}
      durationInFrames={10}
      layout="none"
    >
      <Audio src={staticFile("audio/latch.wav")} volume={0.4} />
    </Sequence>
  </>
);
