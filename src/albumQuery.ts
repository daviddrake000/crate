import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import type { Album } from './db';
import { ratingText } from './utils';

type Compare = (a: Album, b: Album) => number;
type Value = string | number | undefined;

const byText = (a = '', b = '') => a.localeCompare(b, undefined, { sensitivity: 'base' });

// Albums missing the value always sort last, whichever direction is chosen
function by(get: (a: Album) => Value, dir: 'asc' | 'desc'): Compare {
  return (a, b) => {
    const x = get(a);
    const y = get(b);
    if (x === undefined || y === undefined) return x === y ? 0 : x === undefined ? 1 : -1;
    const order = x < y ? -1 : x > y ? 1 : 0;
    return dir === 'asc' ? order : -order;
  };
}

// Release dates compare as text, so "2016" (no day or month) counts as the start of 2016
const byReleased = by((a) => a.released, 'asc');
const byAdded = by((a) => a.createdAt, 'desc');

// The first sort a page offers is its default: newest releases for all albums, the
// list's own order inside a list. Albums released the same day show the latest logged first.
export const SORTS = {
  list: { label: 'List order' },
  'released-desc': {
    label: 'Released: newest',
    compare: (a: Album, b: Album) => by((x) => x.released, 'desc')(a, b) || byAdded(a, b),
  },
  'released-asc': { label: 'Released: oldest', compare: (a: Album, b: Album) => byReleased(a, b) || byAdded(a, b) },
  added: { label: 'Recently logged', compare: byAdded },
  'rating-desc': { label: 'Rating: highest', compare: by((a) => a.rating, 'desc') },
  'rating-asc': { label: 'Rating: lowest', compare: by((a) => a.rating, 'asc') },
  title: { label: 'Title (A–Z)', compare: (a: Album, b: Album) => byText(a.title, b.title) },
  // Each artist's albums in release order, like a discography
  artist: {
    label: 'Artist (A–Z)',
    compare: (a: Album, b: Album) => byText(a.artist, b.artist) || byReleased(a, b) || byText(a.title, b.title),
  },
} satisfies Record<string, { label: string; compare?: Compare }>;

export type SortKey = keyof typeof SORTS;

export const LIBRARY_SORTS = (Object.keys(SORTS) as SortKey[]).filter((k) => k !== 'list');
export const LIST_SORTS = Object.keys(SORTS) as SortKey[];

/**
 * Rating filter values: '' = any, '4+' = at least 4, '3.5' = exactly 3½ (set by clicking a
 * bar in the ratings chart), 'unrated'.
 */
export const RATING_FILTERS: [string, string][] = [
  ['', 'Any rating'],
  ['5', '5 only'],
  ['4+', '4 & up'],
  ['3+', '3 & up'],
  ['2+', '2 & up'],
  ['1+', '1 & up'],
  ['unrated', 'Unrated'],
];

export function ratingFilterLabel(filter: string): string {
  const preset = RATING_FILTERS.find(([value]) => value === filter);
  if (preset) return preset[1];
  return `${ratingText(Number(filter))} only`;
}

function matchesRating(album: Album, filter: string): boolean {
  if (!filter) return true;
  if (filter === 'unrated') return album.rating === undefined;
  if (filter.endsWith('+')) return (album.rating ?? 0) >= Number(filter.slice(0, -1));
  return album.rating === Number(filter);
}

function matchesText(album: Album, q: string): boolean {
  return !q || album.title.toLowerCase().includes(q) || album.artist.toLowerCase().includes(q);
}

/** Search, sort and rating filter for a set of albums, kept in the URL so Back restores them. */
export function useAlbumQuery(albums: Album[] | undefined, sortKeys: SortKey[]) {
  const [params, setParams] = useSearchParams();
  const defaultSort = sortKeys[0];
  const query = params.get('q') ?? '';
  const sortParam = params.get('sort') as SortKey | null;
  const sort = sortParam && sortKeys.includes(sortParam) ? sortParam : defaultSort;
  const rating = params.get('rating') ?? '';

  const setParam = (key: string, value: string, fallback: string) => {
    const next = new URLSearchParams(params);
    if (value && value !== fallback) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const shown = useMemo(() => {
    if (!albums) return [];
    const q = query.trim().toLowerCase();
    const filtered = albums.filter((a) => matchesText(a, q) && matchesRating(a, rating));
    const { compare } = SORTS[sort] as { compare?: Compare };
    return compare ? [...filtered].sort(compare) : filtered;
  }, [albums, query, sort, rating]);

  return {
    shown,
    query,
    sort,
    rating,
    sortKeys,
    isFiltered: query.trim() !== '' || rating !== '',
    setQuery: (v: string) => setParam('q', v, ''),
    setSort: (v: string) => setParam('sort', v, defaultSort),
    setRating: (v: string) => setParam('rating', v, ''),
    clearFilters: () => {
      const next = new URLSearchParams(params);
      next.delete('q');
      next.delete('rating');
      setParams(next, { replace: true });
    },
    /** Back to the default sort with no search or filter. */
    reset: () => {
      const next = new URLSearchParams(params);
      ['q', 'rating', 'sort'].forEach((key) => next.delete(key));
      setParams(next, { replace: true });
    },
  };
}

export type AlbumQuery = ReturnType<typeof useAlbumQuery>;
