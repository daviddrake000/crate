import { RATING_FILTERS, SORTS, ratingFilterLabel, type AlbumQuery } from '../albumQuery';

/** Search box, sort menu and rating filter, driven by useAlbumQuery(). */
export function AlbumControls({ q }: { q: AlbumQuery }) {
  // An exact rating picked from the chart isn't one of the presets; show it as an extra option
  const ratingOptions = RATING_FILTERS.some(([value]) => value === q.rating)
    ? RATING_FILTERS
    : [...RATING_FILTERS, [q.rating, ratingFilterLabel(q.rating)] as [string, string]];

  return (
    <div className="toolbar-controls">
      <input
        type="search"
        className="search"
        placeholder="Search title or artist"
        aria-label="Search title or artist"
        value={q.query}
        onChange={(e) => q.setQuery(e.target.value)}
      />
      <label className="control">
        <span>Sort</span>
        <select value={q.sort} onChange={(e) => q.setSort(e.target.value)}>
          {q.sortKeys.map((key) => (
            <option key={key} value={key}>
              {SORTS[key].label}
            </option>
          ))}
        </select>
      </label>
      <label className={`control${q.rating ? ' is-active' : ''}`}>
        <span>Rating</span>
        <select value={q.rating} onChange={(e) => q.setRating(e.target.value)}>
          {ratingOptions.map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Shown in place of the grid when filters hide every album. */
export function NoMatches({ q }: { q: AlbumQuery }) {
  return (
    <div className="no-matches">
      <p className="muted">No albums match these filters.</p>
      <button type="button" className="btn btn-small" onClick={q.clearFilters}>
        Clear filters
      </button>
    </div>
  );
}
