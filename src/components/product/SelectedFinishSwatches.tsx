export interface SelectedFinishSwatch {
  name: string;
  image_url: string;
}

export default function SelectedFinishSwatches({ finishes }: { finishes?: SelectedFinishSwatch[] }) {
  const pictured = finishes?.filter((finish) => finish.image_url);
  if (!pictured?.length) return null;
  return (
    <div className="flex flex-wrap gap-2" aria-label="Selected finish swatches">
      {pictured.map((finish) => (
        <img key={`${finish.name}:${finish.image_url}`} src={finish.image_url} alt={finish.name} title={finish.name}
          className="h-9 w-9 rounded object-cover ring-1 ring-border" loading="lazy" />
      ))}
    </div>
  );
}