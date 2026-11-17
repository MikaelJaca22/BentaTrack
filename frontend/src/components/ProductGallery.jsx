import { Images } from 'lucide-react';
import ProductImage from './ProductImage.jsx';

// Grid of every product photo visible to the signed-in user. Used on both the
// store-owner and supplier dashboards.
export default function ProductGallery({
  images = [],
  title = 'Product Images',
  hint = 'Product photos will appear here once products have images.',
}) {
  return (
    <section>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
        <span className="text-xs font-medium text-gray500">
          {images.length} {images.length === 1 ? 'image' : 'images'}
        </span>
      </div>

      {images.length === 0 ? (
        <div className="border border-dashed border-gray300 rounded-xl bg-white py-10 px-6 text-center">
          <Images size={30} strokeWidth={1.5} className="text-gray400 mx-auto mb-3" />
          <p className="text-sm font-semibold text-ink">No product images yet</p>
          <p className="mt-1 text-xs text-gray500 max-w-sm mx-auto">{hint}</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {images.map((image) => (
            <figure
              key={image.id}
              className="bg-white border border-gray200 rounded-xl p-2 min-w-0"
            >
              <ProductImage
                src={image.imageUrl}
                alt={image.name}
                className="aspect-square"
                iconSize={22}
              />
              <figcaption
                className="mt-2 text-[11px] leading-tight text-gray600 truncate"
                title={image.name}
              >
                {image.name}
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
