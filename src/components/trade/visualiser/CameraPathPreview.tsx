import type { CinematicPath } from "@/hooks/useCinematicPath";
import type { AICuratedSceneSchema } from "@/types/aiCuratedScene";

/** Top-down route diagram generated from the same samples used by playback. */
export default function CameraPathPreview({ scene, path, name }: {
  scene: AICuratedSceneSchema;
  path: CinematicPath | null;
  name: string;
}) {
  const { width, length } = scene.roomDimensions;
  const unit = Math.min(82 / width, 58 / length);
  const project = (x: number, z: number) => [48 + x * unit, 36 + z * unit];
  const first = path?.samples[0];
  const last = path?.samples[path.samples.length - 1];
  return (
    <svg role="img" aria-label={`${name} route preview`} viewBox="0 0 96 72"
      className="h-[72px] w-24 shrink-0 rounded-sm border border-border bg-muted/30">
      <rect x={48 - width * unit / 2} y={36 - length * unit / 2} width={width * unit} height={length * unit}
        className="fill-background stroke-border" />
      {scene.curatedAssets.map((asset, i) => {
        const [x, y] = project(asset.position[0], asset.position[2]);
        const w = 1.4 * asset.scale[0] * unit;
        const h = 1.4 * asset.scale[2] * unit;
        return <rect key={`${asset.componentId}-${i}`} x={x - w / 2} y={y - h / 2} width={w} height={h}
          transform={`rotate(${-asset.rotation[1] * 180 / Math.PI} ${x} ${y})`}
          className="fill-muted stroke-border" />;
      })}
      {path && <polyline points={path.samples.map(([x, , z]) => project(x, z).join(",")).join(" ")}
        fill="none" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="stroke-primary" />}
      {first && <circle cx={project(first[0], first[2])[0]} cy={project(first[0], first[2])[1]} r={2.8} className="fill-primary" />}
      {last && <circle cx={project(last[0], last[2])[0]} cy={project(last[0], last[2])[1]} r={2.8} strokeWidth={1.5} className="fill-background stroke-primary" />}
    </svg>
  );
}