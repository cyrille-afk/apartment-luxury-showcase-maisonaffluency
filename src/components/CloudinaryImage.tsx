import { useState, useRef, useEffect, ImgHTMLAttributes } from "react";
import { cloudinaryUrl, cloudinarySrcSet, cloudinaryBlurPlaceholder, type CloudinaryTransform } from "@/lib/cloudinary";
import { cn } from "@/lib/utils";

interface CloudinaryImageProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "srcSet"> {
  /** Cloudinary public ID (e.g. "maison/designers/achille-salvagni-bg") */
  publicId: string;
  /** Width hint for primary src */
  width?: number;
  /** Responsive widths for srcSet generation */
  widths?: number[];
  /** Additional Cloudinary transforms */
  transforms?: Omit<CloudinaryTransform, "width">;
  /** Show blur-up placeholder while loading */
  blurUp?: boolean;
  /** Sizes attribute for responsive images */
  sizes?: string;
}

const CloudinaryImage = ({
  publicId,
  width = 800,
  widths = [400, 800, 1200],
  transforms = {},
  blurUp = true,
  sizes = "100vw",
  className,
  alt = "",
  loading = "lazy",
  ...rest
}: CloudinaryImageProps) => {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Check if already cached / complete on mount
  useEffect(() => {
    if (imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      setLoaded(true);
    }
  }, []);

  const src = cloudinaryUrl(publicId, { ...transforms, width });
  const srcSet = cloudinarySrcSet(publicId, widths, transforms);
  const placeholder = blurUp ? cloudinaryBlurPlaceholder(publicId) : undefined;

  return (
    <div className={cn("relative overflow-hidden", className)}>
      {/* Blur placeholder */}
      {blurUp && !loaded && placeholder && (
        <img
          src={placeholder}
          alt=""
          aria-hidden
          className="absolute inset-0 w-full h-full object-cover scale-110 blur-sm"
        />
      )}
      {/* Main image */}
      <img
        ref={imgRef}
        src={src}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        loading={loading}
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "w-full h-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0"
        )}
        {...rest}
      />
    </div>
  );
};

export default CloudinaryImage;
