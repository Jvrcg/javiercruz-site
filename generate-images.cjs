const sharp = require('sharp');
const path = require('path');

const publicDir = path.join(__dirname, 'public');

// Logo: black square, J with right stem merged into right frame border,
// hook curves at bottom extending to/past the bottom frame edge.
// White = interior negative space of J (main void + inner hook arc).
// center of arcs: (63, 63), inner r=21, outer hook reaches ~y=98.
const logoSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#000"/>
  <path d="M 3 3 L 84 3 L 84 63 A 21 21 0 0 1 42 63 L 3 63 Z" fill="#fff"/>
</svg>`;

async function generate() {
  const svgBuffer = Buffer.from(logoSvg);

  // Favicon sizes
  const sizes = [
    { size: 16,  name: 'favicon-16x16.png' },
    { size: 32,  name: 'favicon-32x32.png' },
    { size: 32,  name: 'favicon.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 192, name: 'icon-192.png' },
    { size: 512, name: 'icon-512.png' },
  ];

  for (const { size, name } of sizes) {
    await sharp(svgBuffer).resize(size, size).png().toFile(path.join(publicDir, name));
    console.log(`Generated ${name} (${size}x${size})`);
  }

  // OG image: 1200x630, logo square (630px) centered horizontally on black background
  const logoSize = 630;
  const logoBuffer = await sharp(svgBuffer).resize(logoSize, logoSize).png().toBuffer();

  await sharp({
    create: { width: 1200, height: 630, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .composite([{ input: logoBuffer, left: Math.round((1200 - logoSize) / 2), top: 0 }])
    .png()
    .toFile(path.join(publicDir, 'og-image.png'));
  console.log('Generated og-image.png (1200x630)');
}

generate().catch(err => { console.error(err); process.exit(1); });
