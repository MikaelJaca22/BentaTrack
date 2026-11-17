import React, { useEffect, useState } from 'react';
import { View, Image } from 'react-native';
import { ImageOff } from 'lucide-react-native';
import { assetUrl } from '../config.js';

// Product photo with a neutral fallback. Photos are square white canvases, so
// contain keeps the whole pack visible at any thumbnail size.
export default function ProductImage({
  src,
  alt = 'Product photo',
  size = 48,
  className = '',
  iconSize,
}) {
  const [failed, setFailed] = useState(false);
  const uri = assetUrl(src);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  return (
    <View
      className={`bg-white border border-gray200 rounded-lg overflow-hidden items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {uri && !failed ? (
        <Image
          source={{ uri }}
          accessibilityLabel={alt}
          resizeMode="contain"
          onError={() => setFailed(true)}
          style={{ width: '100%', height: '100%' }}
        />
      ) : (
        <ImageOff size={iconSize || Math.max(14, Math.round(size / 3))} color="#A3A3A3" />
      )}
    </View>
  );
}
