export interface CoverImages {
  /** ~600px square, shown on the album page. */
  cover: string;
  /** ~300px square, shown in grids. Small so the whole crate loads quickly on a phone. */
  thumb: string;
}

function renderJpeg(bitmap: ImageBitmap, maxWidth: number, quality: number): string {
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process image.');
  // White backdrop so transparent PNGs don't turn black as JPEG
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  return canvas.toDataURL('image/jpeg', quality);
}

/** Downscales an uploaded image into the two JPEG sizes the app stores. */
export async function makeCoverImages(file: Blob): Promise<CoverImages> {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.');
  const bitmap = await createImageBitmap(file);
  try {
    return { cover: renderJpeg(bitmap, 600, 0.85), thumb: renderJpeg(bitmap, 300, 0.8) };
  } finally {
    bitmap.close();
  }
}

/** Builds the grid thumbnail for a cover that is already stored as a data URL. */
export async function makeThumb(coverDataUrl: string): Promise<string> {
  const bitmap = await createImageBitmap(await (await fetch(coverDataUrl)).blob());
  try {
    return renderJpeg(bitmap, 300, 0.8);
  } finally {
    bitmap.close();
  }
}

/**
 * The cover's overall colour, for tinting the album page. Colourful pixels count for more
 * than grey ones so the result isn't always a muddy brown.
 */
export async function coverColor(src: string): Promise<string> {
  const bitmap = await createImageBitmap(await (await fetch(src)).blob());
  try {
    const size = 16;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not process image.');
    ctx.drawImage(bitmap, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    let r = 0;
    let g = 0;
    let b = 0;
    let total = 0;
    for (let i = 0; i < px.length; i += 4) {
      const max = Math.max(px[i], px[i + 1], px[i + 2]);
      const min = Math.min(px[i], px[i + 1], px[i + 2]);
      const weight = 0.15 + (max ? (max - min) / max : 0);
      r += px[i] * weight;
      g += px[i + 1] * weight;
      b += px[i + 2] * weight;
      total += weight;
    }
    return `rgb(${Math.round(r / total)} ${Math.round(g / total)} ${Math.round(b / total)})`;
  } finally {
    bitmap.close();
  }
}

/** Compact text rating, e.g. 3.5 → "3½", 0.5 → "½". */
export function ratingText(rating: number | undefined): string {
  if (!rating) return '';
  return `${Math.floor(rating) || ''}${rating % 1 ? '½' : ''}`;
}

/** January … December in the viewer's language */
export const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: 'long' }),
);

/** "2016-05-20" → "May 20, 2016"; "2016-05" → "May 2016"; "2016" → "2016" (in the viewer's format). */
export function formatRelease(released: string | undefined): string {
  if (!released) return '';
  const [y, m, d] = released.split('-').map(Number);
  if (!m) return String(y);
  return new Date(y, m - 1, d || 1).toLocaleDateString(
    undefined,
    d ? { day: 'numeric', month: 'long', year: 'numeric' } : { month: 'long', year: 'numeric' },
  );
}

export function releaseYear(released: string | undefined): number | undefined {
  return released ? Number(released.slice(0, 4)) : undefined;
}

export function todayISO(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Sleeve colours for albums without uploaded art; all dark enough for white type
const SLEEVES = [
  '#2a3fd6',
  '#b93a17',
  '#17695e',
  '#5f3470',
  '#8c6410',
  '#2c5535',
  '#33608f',
  '#9c3352',
  '#2b2926',
  '#8a3f2a',
];

/** Stable sleeve colour per title, for albums without uploaded art. */
export function placeholderColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return SLEEVES[h % SLEEVES.length];
}

export function plural(n: number, word: string): string {
  return `${n.toLocaleString()} ${word}${n === 1 ? '' : 's'}`;
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
