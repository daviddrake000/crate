import {
  arrayRemove,
  arrayUnion,
  collection,
  deleteField,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  writeBatch,
  type DocumentData,
  type WriteBatch,
} from 'firebase/firestore';
import { auth, firestore } from './firebase';
import { makeThumb, type CoverImages } from './utils';

// Everything lives under users/{uid}/ — albums, covers (full-size images, kept apart so
// grids only download thumbnails) and lists. Security rules limit each path to its owner.
// Names start with "album" so they can't collide with another app's data if the Firebase
// project is ever shared.

export interface Album {
  id: string;
  title: string;
  artist: string;
  /** Release date: YYYY-MM-DD, or YYYY-MM / YYYY when the day or month isn't known. */
  released?: string;
  /** 0.5–5 in half steps; undefined means unrated. */
  rating?: number;
  review?: string;
  /** Small JPEG data URL for grids; the full-size image is in the covers collection. */
  thumb?: string;
  createdAt: number;
  updatedAt: number;
}

export interface AlbumList {
  id: string;
  name: string;
  description?: string;
  /** Ordered: position in this array is the album's position in the list. */
  albumIds: string[];
  /** Numbered as a ranking. Only `false` turns it off, so lists made before the option are ranked. */
  ranked?: boolean;
  createdAt: number;
  updatedAt: number;
}

export const isRanked = (list: AlbumList) => list.ranked !== false;

export type AlbumInput = Pick<Album, 'title' | 'artist' | 'released' | 'rating' | 'review'>;

/** Albums saved before release dates had a day and month stored only a `year` number. */
const legacyYear = (year: unknown) => (typeof year === 'number' ? String(year) : undefined);

export function toAlbum(id: string, data: DocumentData): Album {
  const { year, ...rest } = data;
  return { ...rest, released: rest.released ?? legacyYear(year), id } as Album;
}

function currentUid(): string {
  const user = auth.currentUser;
  if (!user) throw new Error('You are signed out. Sign in again to save changes.');
  return user.uid;
}

export const albumsCol = (uid = currentUid()) => collection(firestore, 'users', uid, 'albums');
export const coversCol = (uid = currentUid()) => collection(firestore, 'users', uid, 'albumCovers');
export const listsCol = (uid = currentUid()) => collection(firestore, 'users', uid, 'albumLists');
/** { ids: string[] } — the order of lists chosen on the Lists page. */
export const listOrderDoc = (uid = currentUid()) => doc(firestore, 'users', uid, 'meta', 'albumListOrder');
/** The listening feed's settings (see feed.ts); missing when the feed is off. */
export const feedMetaDoc = (uid = currentUid()) => doc(firestore, 'users', uid, 'meta', 'albumFeed');

/**
 * Puts lists in the user's chosen order. Lists that were never placed (created since the
 * last reorder) come first, newest first, so a new list is easy to find.
 */
export function orderLists(lists: AlbumList[], order: string[]): AlbumList[] {
  const rank = new Map(order.map((id, i) => [id, i]));
  return [...lists].sort((a, b) => {
    const ra = rank.get(a.id);
    const rb = rank.get(b.id);
    if (ra === undefined || rb === undefined) {
      if (ra === rb) return b.createdAt - a.createdAt;
      return ra === undefined ? -1 : 1;
    }
    return ra - rb;
  });
}

/** Shows a failed background save in the app's error banner. */
export function reportError(err: unknown) {
  console.error(err);
  const message = err instanceof Error ? err.message : String(err);
  window.dispatchEvent(new CustomEvent('crate:error', { detail: message }));
}

// Writes are applied to the local cache immediately, so the UI updates at once and keeps
// working offline. They are not awaited: offline, the promise only settles once back online.
function commit(batch: WriteBatch) {
  batch.commit().catch(reportError);
}

function syncMembership(batch: WriteBatch, albumId: string, wanted: string[], lists: AlbumList[], now: number) {
  for (const list of lists) {
    const has = list.albumIds.includes(albumId);
    const want = wanted.includes(list.id);
    if (want !== has) {
      batch.update(doc(listsCol(), list.id), {
        albumIds: want ? arrayUnion(albumId) : arrayRemove(albumId),
        updatedAt: now,
      });
    }
  }
}

interface SaveAlbumParams {
  input: AlbumInput;
  /** Undefined leaves the cover as it is; null removes it. */
  cover: CoverImages | null | undefined;
  listIds: string[];
  lists: AlbumList[];
  existing?: Album;
}

/** Creates or updates an album and syncs which lists it belongs to. Returns the album id. */
export function saveAlbum({ input, cover, listIds, lists, existing }: SaveAlbumParams): string {
  const ref = existing ? doc(albumsCol(), existing.id) : doc(albumsCol());
  const now = Date.now();
  const batch = writeBatch(firestore);
  // set() replaces the whole document, so fields cleared in the form are removed
  batch.set(ref, {
    ...input,
    thumb: cover === undefined ? existing?.thumb : cover?.thumb,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  });
  if (cover) batch.set(doc(coversCol(), ref.id), { data: cover.cover });
  else if (cover === null) batch.delete(doc(coversCol(), ref.id));
  syncMembership(batch, ref.id, listIds, lists, now);
  commit(batch);
  return ref.id;
}

export function setRating(albumId: string, rating: number | undefined) {
  updateDoc(doc(albumsCol(), albumId), { rating: rating ?? deleteField(), updatedAt: Date.now() }).catch(reportError);
}

export function deleteAlbum(album: Album, lists: AlbumList[]) {
  const batch = writeBatch(firestore);
  batch.delete(doc(albumsCol(), album.id));
  batch.delete(doc(coversCol(), album.id));
  syncMembership(batch, album.id, [], lists, Date.now());
  commit(batch);
}

export function createList(name: string, description?: string): string {
  const ref = doc(listsCol());
  const now = Date.now();
  setDoc(ref, { name, description, albumIds: [], ranked: true, createdAt: now, updatedAt: now }).catch(reportError);
  return ref.id;
}

export function setListRanked(id: string, ranked: boolean) {
  updateDoc(doc(listsCol(), id), { ranked, updatedAt: Date.now() }).catch(reportError);
}

export function updateList(id: string, { name, description }: { name: string; description?: string }) {
  updateDoc(doc(listsCol(), id), { name, description: description ?? deleteField(), updatedAt: Date.now() }).catch(
    reportError,
  );
}

export function setAlbumInList(listId: string, albumId: string, inList: boolean) {
  updateDoc(doc(listsCol(), listId), {
    albumIds: inList ? arrayUnion(albumId) : arrayRemove(albumId),
    updatedAt: Date.now(),
  }).catch(reportError);
}

export function deleteList(id: string) {
  writeBatch(firestore).delete(doc(listsCol(), id)).commit().catch(reportError);
}

export function saveListOrder(listIds: string[]) {
  setDoc(listOrderDoc(), { ids: listIds, updatedAt: Date.now() }).catch(reportError);
}

/** Replaces the order of albums in a list. */
export function setListAlbums(listId: string, albumIds: string[]) {
  updateDoc(doc(listsCol(), listId), { albumIds, updatedAt: Date.now() }).catch(reportError);
}

// ---------- Backup & restore ----------

// A backup is one JSON file with every album (full-size covers inline) and every list.
interface BackupAlbum extends Partial<Omit<Album, 'id' | 'thumb'>> {
  id: string;
  cover?: string;
  /** Older backups have only a release year */
  year?: number;
}

interface BackupList extends Partial<Omit<AlbumList, 'id' | 'albumIds'>> {
  id: string;
  albumIds?: string[];
}

export interface CrateData {
  albums: BackupAlbum[];
  lists: BackupList[];
}

export async function exportBackup(): Promise<Blob> {
  const [albums, covers, lists, order] = await Promise.all([
    getDocs(albumsCol()),
    getDocs(coversCol()),
    getDocs(listsCol()),
    getDoc(listOrderDoc()),
  ]);
  const coverById = new Map(covers.docs.map((d) => [d.id, d.data().data as string]));
  // Lists are written in the user's chosen order; restore keeps that order
  const orderedLists = orderLists(
    lists.docs.map((d) => ({ ...d.data(), id: d.id }) as AlbumList),
    (order.data()?.ids as string[] | undefined) ?? [],
  );
  const backup = {
    app: 'crate',
    version: 1,
    exportedAt: new Date().toISOString(),
    albums: albums.docs.map((d) => {
      const data = d.data();
      delete data.thumb; // rebuilt from the cover on restore
      return { ...data, id: d.id, cover: coverById.get(d.id) };
    }),
    lists: orderedLists,
  };
  return new Blob([JSON.stringify(backup)], { type: 'application/json' });
}

export function parseBackup(text: string): CrateData {
  let data: { app?: unknown; albums?: unknown; lists?: unknown };
  try {
    data = JSON.parse(text);
  } catch {
    data = {};
  }
  if (data.app !== 'crate' || !Array.isArray(data.albums) || !Array.isArray(data.lists)) {
    throw new Error("This doesn't look like a Crate backup file.");
  }
  return { albums: data.albums, lists: data.lists };
}

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined);

// Firestore commits are limited to 10 MiB; full-size covers are ~100 KB each
const ALBUMS_PER_BATCH = 25;

async function deleteEverything(uid: string) {
  const snaps = await Promise.all([getDocs(albumsCol(uid)), getDocs(coversCol(uid)), getDocs(listsCol(uid))]);
  const refs = [...snaps.flatMap((s) => s.docs.map((d) => d.ref)), listOrderDoc(uid)];
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(firestore);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

/**
 * Replaces everything in the crate with the albums and lists from a backup.
 * Needs a connection: unlike everyday edits, this waits for the server.
 */
export async function restoreBackup(
  data: CrateData,
  onProgress?: (done: number, total: number) => void,
): Promise<{ albums: number; lists: number }> {
  const uid = currentUid();
  await deleteEverything(uid);

  const newIds = new Map<string, string>();
  let batch = writeBatch(firestore);
  let pending = 0;
  const flush = async () => {
    if (pending) await batch.commit();
    batch = writeBatch(firestore);
    pending = 0;
  };

  for (const [i, a] of data.albums.entries()) {
    const ref = doc(albumsCol(uid));
    newIds.set(String(a.id), ref.id);
    const cover = str(a.cover);
    const now = Date.now();
    batch.set(ref, {
      title: str(a.title) ?? 'Untitled',
      artist: str(a.artist) ?? '',
      released: str(a.released) ?? legacyYear(a.year),
      rating: num(a.rating),
      review: str(a.review),
      thumb: cover ? await makeThumb(cover) : undefined,
      createdAt: num(a.createdAt) ?? now,
      updatedAt: num(a.updatedAt) ?? now,
    });
    if (cover) batch.set(doc(coversCol(uid), ref.id), { data: cover });
    if (++pending === ALBUMS_PER_BATCH) await flush();
    onProgress?.(i + 1, data.albums.length);
  }

  const newListIds: string[] = [];
  for (const l of data.lists) {
    const now = Date.now();
    const ref = doc(listsCol(uid));
    newListIds.push(ref.id);
    batch.set(ref, {
      name: str(l.name) ?? 'Untitled list',
      description: str(l.description),
      albumIds: (l.albumIds ?? []).map((id) => newIds.get(String(id))).filter((id): id is string => !!id),
      ranked: typeof l.ranked === 'boolean' ? l.ranked : undefined,
      createdAt: num(l.createdAt) ?? now,
      updatedAt: num(l.updatedAt) ?? now,
    });
    pending++;
  }
  // Keep the backup's list order
  if (newListIds.length) batch.set(listOrderDoc(uid), { ids: newListIds, updatedAt: Date.now() });
  await flush();
  return { albums: data.albums.length, lists: data.lists.length };
}
