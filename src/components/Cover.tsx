import type { CSSProperties } from 'react';
import type { Album } from '../db';
import { placeholderColor } from '../utils';

interface CoverProps {
  album: Pick<Album, 'title' | 'artist' | 'thumb'>;
  /** A specific image to show instead of the album's grid thumbnail (e.g. the full-size cover). */
  src?: string | null;
  className?: string;
}

/** Square album art; falls back to a generated sleeve when no image was uploaded. */
export function Cover({ album, src, className = '' }: CoverProps) {
  const image = src ?? album.thumb;
  if (image) {
    return <img className={`cover ${className}`} src={image} alt={`Cover of ${album.title}`} loading="lazy" />;
  }
  return (
    <div
      className={`cover cover-placeholder ${className}`}
      style={{ backgroundColor: placeholderColor(album.title || '?') }}
      role="img"
      aria-label={`${album.title}${album.artist ? ` by ${album.artist}` : ''}`}
    >
      {album.artist && <span className="ph-artist">{album.artist}</span>}
      <span className="ph-title">{album.title || 'Untitled'}</span>
    </div>
  );
}

/** A vinyl record. Add the "spinning" class to turn it. */
export function Vinyl({ label = 'var(--accent)', className = '' }: { label?: string; className?: string }) {
  return (
    <span className={`vinyl ${className}`} style={{ '--label': label } as CSSProperties} aria-hidden="true">
      <span className="vinyl-disc" />
    </span>
  );
}
