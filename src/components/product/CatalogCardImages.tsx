import { memo, useEffect, useRef, useState } from "react";
import { cldResponsiveImg } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

interface Props { primary: string; alternate?: string; alt: string; sizes: string; room: boolean; }

/** Fetch the hidden responsive alternate when its batch mounts. Keep the cutout
 * visible until the actual candidate has decoded, including on network errors. */
function CatalogCardImages({ primary, alternate, alt, sizes, room }: Props) {
  const alternateRef = useRef<HTMLImageElement>(null);
  const [decodedSource, setDecodedSource] = useState("");
  const ready = Boolean(alternate && decodedSource === alternate);
  const imageClass = cn("absolute inset-0 m-auto object-contain object-center mix-blend-multiply transition-opacity duration-150 ease-out motion-reduce:transition-none",
    room ? "h-full w-full p-6" : "max-h-[80%] max-w-[80%]");
  useEffect(() => {
    const image = alternateRef.current;
    if (!image || !alternate) return;
    let cancelled = false;
    const decode = async () => {
      try {
        await image.decode();
        if (!cancelled && image.naturalWidth > 0) setDecodedSource(alternate);
      } catch { /* Preserve the primary on failure. */ }
    };
    image.addEventListener("load", decode);
    if (image.complete && image.naturalWidth > 0) void decode();
    return () => { cancelled = true; image.removeEventListener("load", decode); };
  }, [alternate, sizes]);
  return <>
    <img {...cldResponsiveImg(primary, { widths: [300, 400, 600, 800], sizes })}
      alt={alt} className={cn(imageClass, ready && "group-hover:opacity-0 group-focus-visible:opacity-0")}
      loading="lazy" decoding="async" />
    {alternate && <img ref={alternateRef}
      {...cldResponsiveImg(alternate, { widths: [300, 400, 600, 800], sizes })}
      alt={`${alt} — alternate view`} aria-hidden="true" data-alternate-ready={ready}
      className={cn(imageClass, "pointer-events-none opacity-0", ready && "group-hover:opacity-100 group-focus-visible:opacity-100")}
      loading="eager" fetchPriority="low" decoding="async" />}
  </>;
}
export default memo(CatalogCardImages);