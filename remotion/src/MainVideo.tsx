import { AbsoluteFill, useCurrentFrame, interpolate, delayRender, continueRender, Img, Audio, Sequence, staticFile } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadJost } from "@remotion/google-fonts/Jost";
import { useCallback, useState } from "react";

const { fontFamily: displayFont } = loadCormorant("normal", { weights: ["300", "400", "600"], subsets: ["latin"] });
const { fontFamily: bodyFont } = loadJost("normal", { weights: ["300", "400"], subsets: ["latin"] });

const CLOUD_BASE = "https://res.cloudinary.com/dif1oamtj/image/upload";

// For portrait images: load tall, we'll pan vertically
const portrait = (id: string) => `${CLOUD_BASE}/w_1920,q_auto:best,c_fit/${id}`;
// For landscape images: fill 16:9
const landscape = (id: string) => `${CLOUD_BASE}/w_1920,h_1080,q_auto:best,c_fill,g_auto/${id}`;

type SceneData = {
  image: string;
  room: string;
  title: string;
  caption: string;
  orientation: "portrait" | "landscape";
};

const scenes: SceneData[] = [
  // ── A Sociable Environment ──
  { image: portrait("bespoke-sofa_gxidtx"), room: "A Sociable Environment", title: "An Inviting Lounge Area", caption: "Bespoke sofa · Hand-knotted artisan rug · Sculptural lighting", orientation: "portrait" },
  { image: landscape("living-room-hero_zxfcxl"), room: "", title: "A Sophisticated Living Room", caption: "Collectible furniture and panoramic cityscape views", orientation: "landscape" },
  { image: portrait("dining-room_ey0bu5"), room: "", title: "Panoramic Cityscape Views", caption: "Custom dining with a view of the city skyline", orientation: "portrait" },
  { image: portrait("IMG_2402_y3atdm"), room: "", title: "A Sun Lit Reading Corner", caption: "Quiet moments bathed in natural light", orientation: "portrait" },

  // ── An Intimate Setting ──
  { image: portrait("intimate-dining_ux4pee"), room: "An Intimate Setting", title: "A Dreamy Tuscan Landscape", caption: "Custom dining · Hand-blown glass pendants", orientation: "portrait" },
  { image: portrait("intimate-table-detail_aqxvvm"), room: "", title: "A Highly Customised Dining Room", caption: "Every detail meticulously considered", orientation: "portrait" },
  { image: portrait("intimate-lounge_tf4sm1"), room: "", title: "A Relaxed Setting", caption: "Sculptural seating and artisan accessories", orientation: "portrait" },
  { image: portrait("IMG_2133_wtxd62"), room: "", title: "A Colourful Nook", caption: "Bold colours in an intimate space", orientation: "portrait" },

  // ── A Personal Sanctuary ──
  { image: portrait("boudoir_ll5spn"), room: "A Personal Sanctuary", title: "A Sophisticated Boudoir", caption: "Bespoke marquetry desk · Hand-blown glass chandelier", orientation: "portrait" },
  { image: `${CLOUD_BASE}/w_1920,q_auto:best,c_fit,e_brightness:-15/v1772177400/70CFDC93-4CFC-4A13-804C-EE956BC3A159_aa1meq.jpg`, room: "", title: "A Jewelry Box Like Setting", caption: "Artisan suede lamp and bronze painting", orientation: "portrait" },
  { image: portrait("bedroom-second_cyfmdj"), room: "", title: "A Serene Decor", caption: "Soft tones and delicate textures", orientation: "portrait" },
  { image: portrait("art-master-bronze_hf6bad"), room: "", title: "A Design Treasure Trove", caption: "Curated collectibles and sculptural art", orientation: "portrait" },

  // ── A Calming and Dreamy Environment ──
  { image: portrait("master-suite_y6jaix"), room: "A Calming and Dreamy Environment", title: "A Masterful Suite", caption: "Hand-carved furniture · Hand-knotted silk rugs", orientation: "portrait" },
  { image: portrait("bedroom-third_ol56sx"), room: "", title: "Design Tableau", caption: "Layered textures and soft lighting", orientation: "portrait" },
  { image: portrait("bedroom-alt_yk0j0d"), room: "", title: "Unique By Design Vignette", caption: "A personal statement in every corner", orientation: "portrait" },

  // ── A Small Room with Massive Personality ──
  { image: portrait("small-room-bedroom_mp8mdd"), room: "A Small Room with Massive Personality", title: "An Artistic Statement", caption: "Bold statement pieces · Artisan craftsmanship", orientation: "portrait" },
  { image: portrait("small-room-personality_wvxz6y"), room: "", title: "Compact Elegance", caption: "Maximising character in a modest footprint", orientation: "portrait" },
  { image: portrait("small-room-vase_s3nz5o"), room: "", title: "Yellow Crystalline", caption: "Hand-crafted artisan glasswork", orientation: "portrait" },
  { image: portrait("small-room-chair_aobzyb"), room: "", title: "Golden Hour", caption: "Warm light and refined seating", orientation: "portrait" },

  // ── Home Office with a View ──
  { image: portrait("home-office-desk_g0ywv2"), room: "Home Office with a View", title: "A Workspace of Distinction", caption: "Sculptural desk · Refined lighting", orientation: "portrait" },
  { image: portrait("home-office-desk-2_gb1nlb"), room: "", title: "Refined Details", caption: "Precision in every material choice", orientation: "portrait" },
  { image: portrait("home-office-3_t39msw"), room: "", title: "Light & Focus", caption: "Natural light meets considered design", orientation: "portrait" },
  { image: portrait("AffluencySG_143_1_f9iihg"), room: "", title: "Design & Fine Art Books Corner", caption: "A curated library of inspiration", orientation: "portrait" },

  // ── The Details Make the Design ──
  { image: portrait("details-section_u6rwbu"), room: "The Details Make the Design", title: "Curated Vignette", caption: "Every object tells a story", orientation: "portrait" },
  { image: portrait("details-console_hk6uxt"), room: "", title: "Craftsmanship at Every Corner", caption: "The details are not the details — they make the design", orientation: "portrait" },
  { image: portrait("details-lamp_clzcrk"), room: "", title: "Light & Texture", caption: "Interplay of materials and illumination", orientation: "portrait" },
  { image: portrait("AffluencySG_204_1_qbbpqb"), room: "", title: "A Final Flourish", caption: "Sculptural objects as finishing touches", orientation: "portrait" },
];

const SCENE_DUR = 127;
const TRANS_DUR = 18;

function Scene({ image, room, title, caption, orientation }: SceneData) {
  const frame = useCurrentFrame();
  const progress = frame / SCENE_DUR;
  const [handle] = useState(() => delayRender("Loading image: " + title));

  const onLoad = useCallback(() => {
    continueRender(handle);
  }, [handle]);

  // Portrait: slow vertical pan (top → bottom). Landscape: gentle horizontal pan + zoom.
  const isPortrait = orientation === "portrait";

  // For portrait images: object-position pans from top to bottom
  const objPosY = isPortrait
    ? interpolate(progress, [0, 1], [15, 85], { extrapolateRight: "clamp" })
    : 50;
  const objPosX = !isPortrait
    ? interpolate(progress, [0, 1], [40, 60], { extrapolateRight: "clamp" })
    : 50;
  const scale = interpolate(progress, [0, 1],
    isPortrait ? [1.02, 1.06] : [1.08, 1.15],
    { extrapolateRight: "clamp" }
  );

  const textOpacity = interpolate(frame, [10, 25], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textY = interpolate(frame, [10, 25], [18, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const roomOpacity = interpolate(frame, [5, 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const roomY = interpolate(frame, [5, 18], [10, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const captionOpacity = interpolate(frame, [20, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const vignetteOpacity = interpolate(Math.sin(frame * 0.04), [-1, 1], [0.35, 0.55]);

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      <div style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
        <Img
          src={image}
          onLoad={onLoad}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: `${objPosX}% ${objPosY}%`,
            transform: `scale(${scale})`,
          }}
        />
      </div>

      {/* Vignette */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at center, transparent 50%, rgba(10,10,10,${vignetteOpacity}) 100%)`,
      }} />

      {/* Bottom gradient */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "40%",
        background: "linear-gradient(to top, rgba(10,10,10,0.75) 0%, rgba(10,10,10,0.3) 50%, transparent 100%)",
      }} />

      {/* Text overlay */}
      <div style={{ position: "absolute", bottom: 80, left: 80, right: 80 }}>
        {room && (
          <div style={{
            fontFamily: bodyFont, fontSize: 16, fontWeight: 300,
            letterSpacing: "0.25em", textTransform: "uppercase",
            color: "rgba(212,190,160,0.9)", opacity: roomOpacity,
            transform: `translateY(${roomY}px)`, marginBottom: 14,
          }}>
            {room}
          </div>
        )}
        <div style={{
          fontFamily: displayFont, fontSize: 48, fontWeight: 300,
          color: "#f5f0eb", opacity: textOpacity,
          transform: `translateY(${textY}px)`, lineHeight: 1.15, marginBottom: 14,
        }}>
          {title}
        </div>
        <div style={{
          fontFamily: bodyFont, fontSize: 17, fontWeight: 300,
          color: "rgba(212,190,160,0.7)", opacity: captionOpacity,
          letterSpacing: "0.08em",
        }}>
          {caption}
        </div>
      </div>

      {/* Accent line */}
      <div style={{
        position: "absolute", bottom: 60, left: 80,
        width: interpolate(frame, [0, 35], [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 1, background: "rgba(212,190,160,0.4)",
      }} />
    </AbsoluteFill>
  );
}

function IntroCard() {
  const frame = useCurrentFrame();
  const logoOpacity = interpolate(frame, [15, 40], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const logoY = interpolate(frame, [15, 40], [30, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const subtitleOpacity = interpolate(frame, [35, 55], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineWidth = interpolate(frame, [25, 55], [0, 200], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(135deg, #0d0c0a 0%, #1a1815 50%, #0d0c0a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center" }}>
        <div style={{
          fontFamily: displayFont, fontSize: 88, fontWeight: 300,
          color: "#f5f0eb", opacity: logoOpacity,
          transform: `translateY(${logoY}px)`, letterSpacing: "0.08em",
        }}>
          Maison Affluency
        </div>
        <div style={{
          width: lineWidth, height: 1, margin: "24px auto",
          background: "rgba(212,190,160,0.5)",
        }} />
        <div style={{
          fontFamily: bodyFont, fontSize: 28, fontWeight: 300,
          color: "rgba(212,190,160,0.8)", opacity: subtitleOpacity,
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          A Private Apartment Tour
        </div>
      </div>
    </AbsoluteFill>
  );
}

function OutroCard() {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [10, 35], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const lineWidth = interpolate(frame, [20, 50], [0, 160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: "linear-gradient(135deg, #0d0c0a 0%, #1a1815 50%, #0d0c0a 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ textAlign: "center", opacity }}>
        <div style={{
          fontFamily: displayFont, fontSize: 80, fontWeight: 300,
          color: "#f5f0eb", letterSpacing: "0.06em",
        }}>
          Maison Affluency
        </div>
        <div style={{
          width: lineWidth, height: 1, margin: "24px auto",
          background: "rgba(212,190,160,0.5)",
        }} />
        <div style={{
          fontFamily: bodyFont, fontSize: 28, fontWeight: 300,
          color: "rgba(212,190,160,0.8)", letterSpacing: "0.12em",
          textTransform: "uppercase",
        }}>
          at One Grange Garden Singapore
        </div>
      </div>
    </AbsoluteFill>
  );
}

// Total duration: intro(70) + 27 scenes × 127 + outro(80) - 28 transitions × 18
// = 70 + 3429 + 80 - 504 = 3075 frames ≈ 102.5s
const TOTAL_FRAMES = 70 + scenes.length * SCENE_DUR + 80 - (scenes.length + 1) * TRANS_DUR;
const AUDIO_DUR_FRAMES = 32 * 30; // 32s audio at 30fps = 960 frames

const VOICEOVER_START = 70; // Start after intro card
const VOICEOVER_DUR_FRAMES = Math.round(97.5 * 30); // ~97.5s at 30fps (ends ~5s before outro)

export const MainVideo = () => {
  // Layer audio copies to cover the full video duration
  const audioCopies = Math.ceil(TOTAL_FRAMES / AUDIO_DUR_FRAMES);

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      {/* Loop ambient music — lower volume when voiceover plays */}
      {Array.from({ length: audioCopies }).map((_, i) => (
        <Sequence key={i} from={i * AUDIO_DUR_FRAMES}>
          <Audio src={staticFile("audio/ambient-track.mp3")} volume={0.25} />
        </Sequence>
      ))}

      {/* Voiceover narration — starts after intro */}
      <Sequence from={VOICEOVER_START} durationInFrames={VOICEOVER_DUR_FRAMES}>
        <Audio src={staticFile("audio/voiceover.mp3")} volume={0.9} />
      </Sequence>

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={70}>
          <IntroCard />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS_DUR })}
        />
        {scenes.map((scene, i) => (
          <>
            <TransitionSeries.Sequence key={i} durationInFrames={SCENE_DUR}>
              <Scene {...scene} />
            </TransitionSeries.Sequence>
            <TransitionSeries.Transition
              presentation={fade()}
              timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS_DUR })}
            />
          </>
        ))}
        <TransitionSeries.Sequence durationInFrames={80}>
          <OutroCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
