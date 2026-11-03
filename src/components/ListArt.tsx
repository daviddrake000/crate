import type { Album, AlbumList } from '../db';
import { useCrate } from '../crate';
import { Cover } from './Cover';

/**
 * A list's artwork, playlist-style: a 2×2 mosaic of its first four albums, or the first
 * album's cover when it has fewer than four.
 */
export function ListArt({ list, className = '' }: { list: AlbumList; className?: string }) {
  const { albumById } = useCrate();
  const albums = list.albumIds.map((id) => albumById.get(id)).filter((a): a is Album => !!a);

  if (albums.length >= 4) {
    return (
      <div className={`list-art mosaic ${className}`}>
        {albums.slice(0, 4).map((album) => (
          <Cover key={album.id} album={album} />
        ))}
      </div>
    );
  }
  return (
    <div className={`list-art ${className}`}>
      {albums.length ? <Cover album={albums[0]} /> : <span className="list-art-empty" />}
    </div>
  );
}
