import { doc, writeBatch, type WriteBatch } from 'firebase/firestore';
import { firestore } from './firebase';
import { firebaseConfig } from './firebaseConfig';
import { feedMetaDoc, isRanked, reportError, type Album, type AlbumList } from './db';
import { releaseYear } from './utils';

// The listening feed: a read-only JSON copy of the crate for AI assistants.
//
// Crate has no server, so there is no /api route to check a token. Instead the app writes
// the feed into Firestore at feeds/{token}, and the security rules let anyone *get* that
// exact document but never list or search the collection. The token is the secret; making
// a new one deletes the old documents, so the old link stops working at once.
//
// The feed is rewritten whenever the crate's content changes (compared by hash), from
// whichever signed-in device made the change.

export interface FeedMeta {
  token: string;
  /** SHA-256 of the items last written, to skip rewriting an unchanged feed. */
  hash: string | null;
  /** Number of feed documents (pages) last written. */
  pages: number;
  updatedAt: number | null;
}

interface FeedData {
  albums: Album[];
  /** In the order chosen on the Lists page. */
  lists: AlbumList[];
}

const feedDoc = (id: string) => doc(firestore, 'feeds', id);
const pageId = (token: string, page: number) => (page === 1 ? token : `${token}_p${page}`);

/** The URL an assistant fetches; `mask` limits the response to the feed itself. */
export function feedUrl(token: string, page = 1): string {
  return (
    `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/(default)/documents/` +
    `feeds/${pageId(token, page)}?mask.fieldPaths=json`
  );
}

const iso = (ms: number | undefined) => (ms ? new Date(ms).toISOString() : null);

export function buildFeedItems({ albums, lists }: FeedData) {
  // Which lists each album is on, and its place in the ranked ones
  const inLists = new Map<string, { name: string; rank: number | null }[]>();
  const exists = new Set(albums.map((a) => a.id));
  for (const list of lists) {
    const ranked = isRanked(list);
    list.albumIds
      .filter((id) => exists.has(id))
      .forEach((id, i) => {
        inLists.set(id, [...(inLists.get(id) ?? []), { name: list.name, rank: ranked ? i + 1 : null }]);
      });
  }

  return [...albums]
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id))
    .map((a) => ({
      id: a.id,
      album: {
        title: a.title,
        // One string exactly as typed; "Simon & Garfunkel" is one act, so it isn't split
        artist: a.artist || null,
        year: releaseYear(a.released) ?? null,
        released: a.released ?? null,
      },
      rating: a.rating ?? null,
      // Crate doesn't record when an album was listened to
      date_listened: null,
      date_logged: iso(a.createdAt),
      review: a.review ?? null,
      lists: inLists.get(a.id) ?? [],
    }));
}

type FeedItem = ReturnType<typeof buildFeedItems>[number];

// A Firestore string field holds up to ~1 MiB; stay well under it per page
const PAGE_BYTES = 800_000;

function paginate(items: FeedItem[]): FeedItem[][] {
  const encoder = new TextEncoder();
  const pages: FeedItem[][] = [[]];
  let size = 0;
  for (const item of items) {
    const bytes = encoder.encode(JSON.stringify(item)).length + 1;
    if (size + bytes > PAGE_BYTES && pages[pages.length - 1].length) {
      pages.push([]);
      size = 0;
    }
    pages[pages.length - 1].push(item);
    size += bytes;
  }
  return pages;
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function newToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const base64url = btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
  return `crate-${base64url}`;
}

function deletePages(batch: WriteBatch, token: string, from: number, to: number) {
  for (let page = from; page <= to; page++) batch.delete(feedDoc(pageId(token, page)));
}

/** Writes the feed pages and its meta into `batch`. */
async function writeFeed(batch: WriteBatch, uid: string, token: string, previousPages: number, data: FeedData) {
  const items = buildFeedItems(data);
  const hash = await sha256(JSON.stringify(items));
  const pages = paginate(items);
  const updatedAt = new Date().toISOString();

  pages.forEach((pageItems, i) => {
    const page = i + 1;
    const json = JSON.stringify({
      app: 'crate',
      version: 1,
      updated_at: updatedAt,
      page,
      pages: pages.length,
      next_page_url: page < pages.length ? feedUrl(token, page + 1) : null,
      items: pageItems,
    });
    batch.set(feedDoc(pageId(token, page)), { uid, json, updatedAt: Date.now() });
  });
  deletePages(batch, token, pages.length + 1, previousPages);
  batch.set(feedMetaDoc(uid), { token, hash, pages: pages.length, updatedAt: Date.now() } satisfies FeedMeta);
}

/**
 * Rewrites the feed if the crate changed since it was last written. `cancelled` is checked
 * just before saving, so a feed turned off meanwhile isn't written back.
 */
export async function syncFeed(uid: string, meta: FeedMeta, data: FeedData, cancelled: () => boolean) {
  const hash = await sha256(JSON.stringify(buildFeedItems(data)));
  if (hash === meta.hash) return;
  const batch = writeBatch(firestore);
  await writeFeed(batch, uid, meta.token, meta.pages, data);
  if (cancelled()) return;
  // Not awaited, like other saves: it completes once online
  batch.commit().catch(reportError);
}

/** Creates the feed, or replaces it under a new token so the old link stops working. */
export async function startFeed(uid: string, data: FeedData, previous?: FeedMeta | null) {
  const batch = writeBatch(firestore);
  if (previous) deletePages(batch, previous.token, 1, Math.max(1, previous.pages));
  await writeFeed(batch, uid, newToken(), 0, data);
  batch.commit().catch(reportError);
}

export function stopFeed(uid: string, meta: FeedMeta) {
  const batch = writeBatch(firestore);
  deletePages(batch, meta.token, 1, Math.max(1, meta.pages));
  batch.delete(feedMetaDoc(uid));
  batch.commit().catch(reportError);
}

/** Plain-text instructions to paste into the assistant. */
export function feedInstructions(token: string): string {
  return [
    'Crate listening feed (read-only)',
    `GET ${feedUrl(token)}`,
    '',
    'No auth header: the link itself is the secret. The response is a Firestore document;',
    'parse fields.json.stringValue as JSON. updateTime changes only when the crate changes.',
    '404 means the link was revoked or replaced.',
    '',
    'items[] (newest logged first), one entry per album (no re-listens):',
    'id (permanent); album {title, artist (one string as typed, not split), year|null,',
    'released: "YYYY-MM-DD" | "YYYY-MM" | "YYYY" | null (day and month are optional)};',
    'rating: 0.5–5 in half steps, null = unrated;',
    'date_listened: always null (Crate does not record listening dates);',
    'date_logged: ISO 8601 UTC, when the album was added to Crate, which is not a listening date;',
    'review: text | null; lists[]: {name, rank}, rank = position in a ranked list (1 = top), null if the list is unranked.',
    'If pages > 1, follow next_page_url.',
  ].join('\n');
}
