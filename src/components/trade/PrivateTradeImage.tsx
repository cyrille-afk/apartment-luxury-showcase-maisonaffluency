import { useEffect, useState } from "react";
import { isPrivateTradeUrl, resignPrivateTradeUrl } from "@/lib/privateTradeUpload";

type PrivateTradeImageProps = React.ImgHTMLAttributes<HTMLImageElement> & {
  src?: string | null;
};

/**
 * Renders an image that may live in the private `trade-private` bucket.
 * If the stored signed URL has expired (403/400), it silently re-signs once
 * and retries, so private trade uploads keep rendering for authorised users.
 */
const PrivateTradeImage = ({ src, onError, ...rest }: PrivateTradeImageProps) => {
  const [resolved, setResolved] = useState<string | undefined>(src || undefined);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    setResolved(src || undefined);
    setRetried(false);
  }, [src]);

  const handleError: React.ReactEventHandler<HTMLImageElement> = async (event) => {
    if (!retried && src && isPrivateTradeUrl(src)) {
      setRetried(true);
      const fresh = await resignPrivateTradeUrl(src);
      if (fresh && fresh !== src) {
        setResolved(fresh);
        return;
      }
    }
    onError?.(event);
  };

  return <img {...rest} src={resolved} onError={handleError} />;
};

export default PrivateTradeImage;
