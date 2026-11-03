import { Link } from 'react-router';
import type { Album } from '../db';
import { Cover } from './Cover';
import { Discs } from './Rating';
import { releaseYear } from '../utils';

interface AlbumGridProps {
  albums: Album[];
  /** In a ranked list, each album's place in the ranking (shown even when sorted another way). */
  rankOf?: (album: Album) => number | undefined;
  /** When provided, each card gets a remove button (used inside lists). */
  onRemove?: (album: Album) => void;
  removeLabel?: string;
}

export function AlbumGrid({ albums, rankOf, onRemove, removeLabel = 'Remove' }: AlbumGridProps) {
  return (
    <ul className={`album-grid${rankOf ? ' ranked' : ''}`}>
      {albums.map((album) => {
        const rank = rankOf?.(album);
        return (
          <li key={album.id} className="album-card">
            <Link to={`/album/${album.id}`} className="card-link">
              {rank !== undefined && (
                <span className="card-rank">
                  <span className="visually-hidden">Number </span>
                  {rank}
                </span>
              )}
              <span className="cover-frame">
                <Cover album={album} />
              </span>
              <span className="card-title" title={album.title}>
                {album.title}
              </span>
              {album.artist && (
                <span className="card-artist" title={album.artist}>
                  {album.artist}
                </span>
              )}
              <span className="card-meta">
                <Discs rating={album.rating} />
                {album.released && <span className="card-year">{releaseYear(album.released)}</span>}
              </span>
            </Link>
            {onRemove && (
              <button
                type="button"
                className="card-remove"
                onClick={() => onRemove(album)}
                aria-label={`${removeLabel}: ${album.title}`}
                title={removeLabel}
              >
                ×
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
