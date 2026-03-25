import { AbsoluteFill, Sequence, useCurrentFrame, interpolate } from "remotion";
import { TransitionSeries, springTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { loadFont as loadCormorant } from "@remotion/google-fonts/CormorantGaramond";
import { loadFont as loadJost } from "@remotion/google-fonts/Jost";

const { fontFamily: displayFont } = loadCormorant("normal", { weights: ["300", "400", "600"], subsets: ["latin"] });
const { fontFamily: bodyFont } = loadJost("normal", { weights: ["300", "400"], subsets: ["latin"] });

const CLOUD_BASE = "https://res.cloudinary.com/dif1oamtj/image/upload";
const cld = (id: string) => `${CLOUD_BASE}/w_1920,h_1080,q_auto:best,c_fill,g_auto/${id}`;

const scenes = [
  {
    image: cld("bespoke-sofa_gxidtx"),
    room: "A Sociable Environment",
    title: "An Inviting Lounge Area",
    caption: "Bespoke sofa · Hand-knotted artisan rug · Sculptural lighting",
    panX: [-3, 3], panY: [0, -2], scale: [1.08, 1.15],
  },
  {
    image: cld("living-room-hero_zxfcxl"),
    room: "",
    title: "A Sophisticated Living Room",
    caption: "Collectible furniture and panoramic cityscape views",
    panX: [2, -2], panY: [-1, 1], scale: [1.12, 1.05],
  },
  {
    image: cld("intimate-dining_ux4pee"),
    room: "An Intimate Setting",
    title: "A Dreamy Tuscan Landscape",
    caption: "Custom dining · Hand-blown glass pendants",
    panX: [-2, 3], panY: [1, -1], scale: [1.05, 1.12],
  },
  {
    image: cld("boudoir_ll5spn"),
    room: "A Personal Sanctuary",
    title: "A Sophisticated Boudoir",
    caption: "Bespoke marquetry desk · Hand-blown glass chandelier",
    panX: [0, -3], panY: [-2, 0], scale: [1.1, 1.18],
  },
  {
    image: cld("master-suite_y6jaix"),
    room: "A Calming and Dreamy Environment",
    title: "A Masterful Suite",
    caption: "Hand-carved furniture · Hand-knotted silk rugs",
    panX: [3, -1], panY: [0, -2], scale: [1.06, 1.14],
  },
  {
    image: cld("small-room-bedroom_mp8mdd"),
    room: "A Small Room with Massive Personality",
    title: "An Artistic Statement",
    caption: "Bold statement pieces · Artisan craftsmanship",
    panX: [-1, 2], panY: [1, -1], scale: [1.1, 1.05],
  },
  {
    image: cld("home-office-desk_g0ywv2"),
    room: "Home Office with a View",
    title: "A Workspace of Distinction",
    caption: "Sculptural desk · Refined lighting",
    panX: [2, -2], panY: [-1, 1], scale: [1.05, 1.12],
  },
  {
    image: cld("details-console_hk6uxt"),
    room: "The Details Make the Design",
    title: "Craftsmanship at Every Corner",
    caption: "The details are not the details — they make the design",
    panX: [-2, 1], panY: [0, -2], scale: [1.08, 1.15],
  },
];

const SCENE_DUR = 120; // 4 seconds per scene
const TRANS_DUR = 24;  // 0.8s transition

function Scene({ image, room, title, caption, panX, panY, scale }: typeof scenes[0]) {
  const frame = useCurrentFrame();
  const progress = frame / SCENE_DUR;

  const sx = interpolate(progress, [0, 1], scale, { extrapolateRight: "clamp" });
  const px = interpolate(progress, [0, 1], panX, { extrapolateRight: "clamp" });
  const py = interpolate(progress, [0, 1], panY, { extrapolateRight: "clamp" });

  // Text fade in
  const textOpacity = interpolate(frame, [12, 30], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const textY = interpolate(frame, [12, 30], [20, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Room label (smaller, appears first)
  const roomOpacity = interpolate(frame, [6, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const roomY = interpolate(frame, [6, 20], [12, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Caption
  const captionOpacity = interpolate(frame, [24, 42], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Subtle vignette pulse
  const vignetteOpacity = interpolate(Math.sin(frame * 0.04), [-1, 1], [0.5, 0.7]);

  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      {/* Ken Burns image */}
      <div style={{
        position: "absolute", inset: 0, overflow: "hidden",
      }}>
        <img
          src={image}
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            transform: `scale(${sx}) translate(${px}%, ${py}%)`,
            willChange: "transform",
          }}
        />
      </div>

      {/* Vignette overlay */}
      <div style={{
        position: "absolute", inset: 0,
        background: `radial-gradient(ellipse at center, transparent 40%, rgba(10,10,10,${vignetteOpacity}) 100%)`,
      }} />

      {/* Bottom gradient for text */}
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "45%",
        background: "linear-gradient(to top, rgba(10,10,10,0.85) 0%, rgba(10,10,10,0.4) 50%, transparent 100%)",
      }} />

      {/* Text block */}
      <div style={{
        position: "absolute", bottom: 80, left: 80, right: 80,
      }}>
        {room && (
          <div style={{
            fontFamily: bodyFont, fontSize: 16, fontWeight: 300,
            letterSpacing: "0.25em", textTransform: "uppercase",
            color: "rgba(212,190,160,0.9)",
            opacity: roomOpacity,
            transform: `translateY(${roomY}px)`,
            marginBottom: 14,
          }}>
            {room}
          </div>
        )}

        <div style={{
          fontFamily: displayFont, fontSize: 52, fontWeight: 300,
          color: "#f5f0eb",
          opacity: textOpacity,
          transform: `translateY(${textY}px)`,
          lineHeight: 1.15,
          marginBottom: 16,
        }}>
          {title}
        </div>

        <div style={{
          fontFamily: bodyFont, fontSize: 18, fontWeight: 300,
          color: "rgba(212,190,160,0.7)",
          opacity: captionOpacity,
          letterSpacing: "0.08em",
        }}>
          {caption}
        </div>
      </div>

      {/* Thin gold line accent */}
      <div style={{
        position: "absolute", bottom: 60, left: 80,
        width: interpolate(frame, [0, 40], [0, 120], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        height: 1,
        background: "rgba(212,190,160,0.4)",
      }} />
    </AbsoluteFill>
  );
}

// Intro title card
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
          fontFamily: displayFont, fontSize: 64, fontWeight: 300,
          color: "#f5f0eb", opacity: logoOpacity,
          transform: `translateY(${logoY}px)`,
          letterSpacing: "0.08em",
        }}>
          Maison Affluency
        </div>
        <div style={{
          width: lineWidth, height: 1, margin: "24px auto",
          background: "rgba(212,190,160,0.5)",
        }} />
        <div style={{
          fontFamily: bodyFont, fontSize: 20, fontWeight: 300,
          color: "rgba(212,190,160,0.8)", opacity: subtitleOpacity,
          letterSpacing: "0.2em", textTransform: "uppercase",
        }}>
          A Private Apartment Tour
        </div>
      </div>
    </AbsoluteFill>
  );
}

// Outro
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
          fontFamily: bodyFont, fontSize: 16, fontWeight: 300,
          color: "rgba(212,190,160,0.7)", letterSpacing: "0.25em",
          textTransform: "uppercase", marginBottom: 20,
        }}>
          Curated By
        </div>
        <div style={{
          fontFamily: displayFont, fontSize: 56, fontWeight: 300,
          color: "#f5f0eb", letterSpacing: "0.06em",
        }}>
          Maison Affluency
        </div>
        <div style={{
          width: lineWidth, height: 1, margin: "24px auto",
          background: "rgba(212,190,160,0.5)",
        }} />
        <div style={{
          fontFamily: bodyFont, fontSize: 18, fontWeight: 300,
          color: "rgba(212,190,160,0.6)", letterSpacing: "0.15em",
          textTransform: "uppercase",
        }}>
          Singapore
        </div>
      </div>
    </AbsoluteFill>
  );
}

export const MainVideo = () => {
  return (
    <AbsoluteFill style={{ background: "#0a0a0a" }}>
      <TransitionSeries>
        {/* Intro */}
        <TransitionSeries.Sequence durationInFrames={75}>
          <IntroCard />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={springTiming({ config: { damping: 200 }, durationInFrames: TRANS_DUR })}
        />

        {/* Scenes */}
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

        {/* Outro */}
        <TransitionSeries.Sequence durationInFrames={90}>
          <OutroCard />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};
