import { Composition, Folder, Still } from "remotion";
import { Trailer } from "./Trailer";
import { FeatureGraphic, StoreScreenshot, TrailerThumbnail } from "./Stills";
import { Hook } from "./scenes/Hook";
import { Choices } from "./scenes/Choices";
import { Crew } from "./scenes/Crew";
import { Territory } from "./scenes/Territory";
import { Businesses } from "./scenes/Businesses";
import { Rivals } from "./scenes/Rivals";
import { Heist } from "./scenes/Heist";
import { Closing } from "./scenes/Closing";

export const RemotionRoot = () => (
  <>
    <Composition
      id="BLACKLINE-PlayStore-Portrait"
      component={Trailer}
      durationInFrames={1080}
      fps={30}
      width={1080}
      height={1920}
    />
    <Composition
      id="BLACKLINE-Cinematic-Landscape"
      component={Trailer}
      durationInFrames={1080}
      fps={30}
      width={1920}
      height={1080}
    />
    <Folder name="Connected-scenes">
      <Composition
        id="Scene-01-Hook"
        component={Hook}
        durationInFrames={132}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene-02-Choices"
        component={Choices}
        durationInFrames={147}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene-03-Crew"
        component={Crew}
        durationInFrames={147}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene-04-Territory"
        component={Territory}
        durationInFrames={147}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene-05-Businesses"
        component={Businesses}
        durationInFrames={147}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene-06-Rivals"
        component={Rivals}
        durationInFrames={147}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene-07-Heist"
        component={Heist}
        durationInFrames={210}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="Scene-08-Closing"
        component={Closing}
        durationInFrames={87}
        fps={30}
        width={1080}
        height={1920}
      />
    </Folder>
    <Folder name="PlayStore-screenshots">
      <Still
        id="Screenshot-01-Rise"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Your rise.\nYour rules.",
          screen: "overview",
          number: "01",
          background: "city",
        }}
      />
      <Still
        id="Screenshot-02-Decisions"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Every choice\nleaves a mark.",
          screen: "decision",
          number: "02",
          background: "vault",
        }}
      />
      <Still
        id="Screenshot-03-Territory"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Take the city.\nZone by zone.",
          screen: "map",
          number: "03",
          background: "city",
        }}
      />
      <Still
        id="Screenshot-04-Crew"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Loyalty is never\nguaranteed.",
          screen: "crew",
          number: "04",
          background: "city",
        }}
      />
      <Still
        id="Screenshot-05-Businesses"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Build income.\nBalance power.",
          screen: "business",
          number: "05",
          background: "city",
        }}
      />
      <Still
        id="Screenshot-06-Rivals"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Outthink\nyour rivals.",
          screen: "battle",
          number: "06",
          background: "city",
        }}
      />
      <Still
        id="Screenshot-07-Heist"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Plan the score.\nOwn the escape.",
          screen: "heist-plan",
          number: "07",
          background: "vault",
        }}
      />
      <Still
        id="Screenshot-08-Story"
        component={StoreScreenshot}
        width={1080}
        height={1920}
        defaultProps={{
          headline: "Your story.\nYour legacy.",
          screen: "journal",
          number: "08",
          background: "city",
        }}
      />
    </Folder>
    <Folder name="Store-brand-assets">
      <Still
        id="Feature-Graphic"
        component={FeatureGraphic}
        width={1024}
        height={500}
      />
      <Still
        id="Trailer-Thumbnail"
        component={TrailerThumbnail}
        width={1920}
        height={1080}
      />
    </Folder>
  </>
);
