import { Link } from "react-router-dom";
import type { Designer } from "@/hooks/useDesigner";

interface Props {
  parent: Designer;
  children: Designer[];
}

const navigate = () => {
  sessionStorage.removeItem("__scroll_y");
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
};

const AtelierGroupCard = ({ parent, children }: Props) => {
  // Show up to 6 sub-designer thumbnails
  const visible = children.slice(0, 6);
  const overflow = children.length - visible.length;

  return (
    <div className="col-span-2 rounded-xl border border-border bg-background overflow-hidden hover:border-foreground/30 transition-all hover:shadow-xl group">
      {/* Top: parent hero */}
      <Link
        to={`/designers/${parent.slug}`}
        onClick={navigate}
        className="block relative aspect-[3/2] overflow-hidden"
      >
        {parent.image_url ? (
          <img
            src={parent.image_url}
            alt={parent.name}
            className="w-full h-full object-cover transition-all duration-700 group-hover:scale-105 group-hover:brightness-[0.7]"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-muted/10 flex items-center justify-center">
            <span className="font-display text-4xl text-muted-foreground/20">
              {parent.name.charAt(0)}
            </span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />

        {/* Atelier badge */}
        <div className="absolute top-3 right-3 w-16 h-16 md:w-20 md:h-20 bg-foreground flex items-center justify-center p-1.5 overflow-hidden">
          <span className="font-display text-[7px] md:text-[9px] text-background text-center leading-tight uppercase tracking-[0.12em]">
            {parent.name}
          </span>
        </div>

        {/* Name + count */}
        <div className="absolute bottom-4 left-4 right-4">
          <h3 className="font-display text-lg md:text-xl text-white tracking-wide drop-shadow-md">
            {parent.display_name || parent.name}
          </h3>
          <p className="font-body text-[11px] text-white/70 mt-0.5">
            {children.length} designer{children.length !== 1 ? "s" : ""}
          </p>
        </div>
      </Link>

      {/* Bottom: sub-designer thumbnails */}
      <div className="p-3 md:p-4">
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
          {visible.map((d) => (
            <Link
              key={d.slug}
              to={`/designers/${d.slug}`}
              onClick={navigate}
              className="group/sub block rounded-lg overflow-hidden border border-border hover:border-foreground/40 transition-all"
              title={d.name}
            >
              <div className="aspect-[3/4] relative overflow-hidden bg-muted/10">
                {d.image_url ? (
                  <img
                    src={d.image_url}
                    alt={d.name}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover/sub:scale-110"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="font-display text-lg text-muted-foreground/20">
                      {d.name.charAt(0)}
                    </span>
                  </div>
                )}
                {/* Name overlay */}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-6">
                  <p className="font-body text-[9px] md:text-[10px] text-white leading-tight line-clamp-2">
                    {d.name}
                  </p>
                </div>
              </div>
            </Link>
          ))}

          {overflow > 0 && (
            <Link
              to={`/designers/${parent.slug}`}
              onClick={navigate}
              className="rounded-lg border border-border bg-muted/5 flex items-center justify-center aspect-[3/4] hover:bg-muted/10 transition-colors"
            >
              <span className="font-body text-xs text-muted-foreground">
                +{overflow} more
              </span>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
};

export default AtelierGroupCard;
