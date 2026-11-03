import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useParams } from 'react-router';
import { setAlbumInList, setRating } from '../db';
import { useCover, useCrate } from '../crate';
import { Cover, Vinyl } from '../components/Cover';
import { DiscInput } from '../components/Rating';
import { ListPicker } from '../components/ListPicker';
import { coverColor, formatRelease, placeholderColor } from '../utils';

export function AlbumDetail() {
  const { id = '' } = useParams();
  const { albumById, lists } = useCrate();
  const album = albumById.get(id);
  const fullCover = useCover(album ? id : undefined);
  // Show the thumbnail until the full-size cover arrives
  const cover = fullCover ?? album?.thumb;
  // The page is tinted with the cover's colour (or the generated sleeve's when there's no art)
  const color = useCoverColor(album?.thumb);
  const tint = album?.thumb ? color : placeholderColor(album?.title || '?');

  if (!album) {
    return (
      <div className="empty-state">
        <h1>Album not found</h1>
        <Link to="/" className="btn">
          Back to your albums
        </Link>
      </div>
    );
  }

  const inLists = lists.filter((l) => l.albumIds.includes(id)).map((l) => l.id);

  return (
    <div className="album-detail" style={tint ? ({ '--tint': tint } as CSSProperties) : undefined}>
      <div className="detail-band" aria-hidden="true" />

      <div className="page detail-layout">
        <div className="detail-art">
          <Vinyl label={tint} />
          <Cover album={album} src={cover} />
        </div>

        <div className="detail-main">
          <h1 className="detail-title">{album.title}</h1>
          {album.artist && (
            <p className="detail-artist">
              {/* Searches by artist and keeps the default sort, newest release first */}
              <Link to={`/?q=${encodeURIComponent(album.artist)}`} className="artist-link">
                {album.artist}
              </Link>
            </p>
          )}
          {album.released && <p className="detail-meta">Released {formatRelease(album.released)}</p>}

          <section className="detail-section">
            <h2 className="section-heading">Your rating</h2>
            <DiscInput value={album.rating} onChange={(rating) => setRating(id, rating)} size={34} />
          </section>

          {album.review && (
            <section className="detail-section">
              <h2 className="section-heading">Review</h2>
              <div className="review">
                {album.review.split(/\n{2,}/).map((para, i) => (
                  <p key={i}>{para}</p>
                ))}
              </div>
            </section>
          )}

          <section className="detail-section">
            <h2 className="section-heading">Lists</h2>
            <ListPicker
              selected={inLists}
              onToggle={(listId) => setAlbumInList(listId, id, !inLists.includes(listId))}
            />
          </section>

          <div className="detail-actions">
            <Link to={`/album/${id}/edit`} className="btn">
              Edit details
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

/** The cover's overall colour, or undefined while it's worked out (or if there's no cover). */
function useCoverColor(src: string | undefined): string | undefined {
  const [color, setColor] = useState<{ src: string; value: string }>();

  useEffect(() => {
    if (!src) return;
    let current = true;
    coverColor(src).then(
      (value) => current && setColor({ src, value }),
      () => {},
    );
    return () => {
      current = false;
    };
  }, [src]);

  return color && color.src === src ? color.value : undefined;
}
