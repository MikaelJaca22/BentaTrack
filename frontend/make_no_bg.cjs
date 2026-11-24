const sharp = require('sharp');

async function main() {
  const img = sharp('C:/Users/Kael Jaca/Downloads/BentaTrack/frontend/public/logo.jpg');
  const { data, info } = await img.raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const H = info.height;
  const out = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) {
    const r = data[i * 3];
    const g = data[i * 3 + 1];
    const b = data[i * 3 + 2];
    const a = (r > 245 && g > 245 && b > 245) ? 0 : 255;
    out[i * 4] = a;
    out[i * 4 + 1] = r;
    out[i * 4 + 2] = g;
    out[i * 4 + 3] = b;
  }
  await sharp(out, { raw: { width: W, height: H, channels: 4 } }).png().toFile(
    'C:/Users/Kael Jaca/Downloads/BentaTrack/frontend/public/che-che-variety-store-no-bg.png'
  );
  console.log('SAVED-OK');
}

main().catch((e) => { console.error(e); process.exit(1); });
