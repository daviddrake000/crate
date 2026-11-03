import { Link } from 'react-router';
import type { Album } from '../db';
import { useCrate } from '../crate';
import { LIBRARY_SORTS, useAlbumQuery, type AlbumQuery } from '../albumQuery';
import { AlbumGrid } from '../components/AlbumGrid';
import { AlbumControls, NoMatches } from '../components/AlbumControls';
import { Vinyl } from '../components/Cover';
import { Discs } from '../components/Rating';
import { plural, ratingText, releaseYear } from '../utils';

export function Library() {
  const { albums } = useCrate();
  const q = useAlbumQuery(albums, LIBRARY_SORTS);

  if (albums.length === 0) {
    return (
      <div className="empty-state">
        <Vinyl className="empty-vinyl" />
        <h1>Your crate is empty</h1>
        <p>Log the albums you listen to, rate them, and gather them into lists.</p>
        <Link to="/new" className="btn btn-primary btn-large">
          Log your first album
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <section className="profile-header">
        <Stats albums={albums} />
        <RatingHistogram albums={albums} q={q} />
      </section>

      <div className="toolbar ruled">
        <h2 className="section-heading">
          Albums
          {q.isFiltered && <span className="muted">{`${q.shown.length} of ${albums.length}`}</span>}
        </h2>
        <AlbumControls q={q} />
      </div>

      {q.shown.length ? <AlbumGrid albums={q.shown} /> : <NoMatches q={q} />}
    </div>
  );
}

function Stats({ albums }: { albums: Album[] }) {
  // Albums released this year, whenever they were logged
  const thisYear = new Date().getFullYear();
  const releasedThisYear = albums.filter((a) => releaseYear(a.released) === thisYear).length;

  return (
    <dl className="stats">
      <div>
        <dt>Albums</dt>
        <dd>{albums.length.toLocaleString()}</dd>
      </div>
      <div>
        <dt>This year</dt>
        <dd>{releasedThisYear.toLocaleString()}</dd>
      </div>
    </dl>
  );
}

/** Ratings spread; clicking a bar shows only albums with that rating. */
function RatingHistogram({ albums, q }: { albums: Album[]; q: AlbumQuery }) {
  const counts = Array.from({ length: 10 }, (_, i) => albums.filter((a) => a.rating === (i + 1) / 2).length);
  const rated = counts.reduce((a, b) => a + b, 0);
  const max = Math.max(1, ...counts);
  const average = rated ? albums.reduce((s, a) => s + (a.rating ?? 0), 0) / rated : 0;

  return (
    <div className="histogram">
      <h2 className="section-heading">
        Ratings <span className="muted">{rated ? `avg ${average.toFixed(1)}` : 'none yet'}</span>
      </h2>
      <div className="histogram-body">
        <Discs rating={0.5} size={9} className="histogram-end" />
        <div className="histogram-bars">
          {counts.map((count, i) => {
            const value = String((i + 1) / 2);
            const active = q.rating === value;
            return (
              <button
                type="button"
                key={i}
                className={`histogram-bar${active ? ' active' : ''}`}
                style={{ height: `${Math.max(3, (count / max) * 100)}%` }}
                title={`${plural(count, 'album')} rated ${ratingText((i + 1) / 2)}`}
                aria-label={`${active ? 'Stop showing only' : 'Show only'} albums rated ${(i + 1) / 2} (${count})`}
                aria-pressed={active}
                onClick={() => q.setRating(active ? '' : value)}
              />
            );
          })}
        </div>
        <Discs rating={5} size={9} className="histogram-end" />
      </div>
    </div>
  );
}
