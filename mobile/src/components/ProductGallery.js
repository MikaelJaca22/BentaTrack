import React from 'react';
import { View, Text, useWindowDimensions } from 'react-native';
import { Images } from 'lucide-react-native';
import ProductImage from './ProductImage.js';

// Grid of every product photo visible to the signed-in user. Used on both the
// store-owner and supplier dashboards.
export default function ProductGallery({
  images = [],
  title = 'Product Images',
  hint = 'Product photos will appear here once products have images.',
}) {
  const { width } = useWindowDimensions();
  const columns = width >= 700 ? 5 : 3;
  const gap = 8;
  // ScrollView content is padded 16 on each side; subtract the gaps between
  // columns so the grid always fills the available width exactly.
  const tileWidth = (width - 32 - gap * (columns - 1)) / columns;
  const imageSize = Math.max(48, Math.round(tileWidth - 16));

  return (
    <View className="mb-5">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-semibold text-ink">{title}</Text>
        <Text className="text-xs font-medium text-gray500">
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </Text>
      </View>

      {images.length === 0 ? (
        <View className="items-center justify-center py-10 px-6 border border-dashed border-gray300 rounded-xl bg-white">
          <Images size={30} color="#A3A3A3" />
          <Text className="mt-3 text-sm font-semibold text-ink">No product images yet</Text>
          <Text className="mt-1 text-xs text-gray500 text-center">{hint}</Text>
        </View>
      ) : (
        <View className="flex-row flex-wrap" style={{ gap }}>
          {images.map((image) => (
            <View
              key={String(image.id)}
              className="bg-white border border-gray200 rounded-xl p-2"
              style={{ width: tileWidth }}
            >
              <ProductImage
                src={image.imageUrl}
                alt={image.name}
                size={imageSize}
                className="rounded-lg"
                iconSize={22}
              />
              <Text className="mt-2 text-[11px] leading-tight text-gray600" numberOfLines={2}>
                {image.name}
              </Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}
