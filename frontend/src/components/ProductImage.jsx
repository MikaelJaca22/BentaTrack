import { useEffect, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { assetUrl } from '../config.js';

// Product photo with a neutral fallback. Generated photos are square white
// canvases, so object-contain keeps the whole pack visible at any tile size.
export default function ProductImage({
  src,
  alt = 'Product photo',
  className = '',
  iconSize = 18,
}) {
  const [failed, setFailed] = useState(false);
  const url = assetUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <div
      className={`overflow-hidden bg-white border border-gray200 rounded-xl flex items-center justify-center ${className}`}
    >
      {url && !failed ? (
        <img
          src={url}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-contain"
        />
      ) : (
        <ImageOff size={iconSize} className="text-gray400" aria-hidden="true" />
      )}
    </div>
  );
}
