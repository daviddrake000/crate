import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth } from './firebase';
import {
  albumsCol,
  coversCol,
  feedMetaDoc,
  listOrderDoc,
  listsCol,
  orderLists,
  reportError,
  toAlbum,
  type Album,
  type AlbumList,
} from './db';
import { syncFeed, type FeedMeta } from './feed';

interface Crate {
  user: User;
  albums: Album[];
  /** In the order chosen on the Lists page. */
  lists: AlbumList[];
  albumById: Map<string, Album>;
  /** The listening feed for AI assistants: null when off, undefined while loading. */
  feed: FeedMeta | null | undefined;
}

const CrateContext = createContext<Crate | null>(null);

export function useCrate(): Crate {
  const crate = useContext(CrateContext);
  if (!crate) throw new Error('useCrate must be used inside <CrateProvider>');
  return crate;
}

/** undefined while Firebase is still restoring the session. */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(() => (auth.currentUser ? auth.currentUser : undefined));
  useEffect(() => onAuthStateChanged(auth, setUser), []);
  return user;
}

/** Subscribes once to the user's albums and lists; renders children when both have loaded. */
export function CrateProvider({ user, children }: { user: User; children: ReactNode }) {
  const [albums, setAlbums] = useState<Album[] | null>(null);
  const [lists, setLists] = useState<AlbumList[] | null>(null);
  const [listOrder, setListOrder] = useState<string[] | null>(null);
  const [feed, setFeed] = useState<FeedMeta | null | undefined>();
  const [error, setError] = useState('');

  useEffect(() => {
    const onError = (err: Error) => setError(err.message);
    const unsubAlbums = onSnapshot(
      albumsCol(user.uid),
      (snap) => setAlbums(snap.docs.map((d) => toAlbum(d.id, d.data()))),
      onError,
    );
    const unsubLists = onSnapshot(
      listsCol(user.uid),
      (snap) => setLists(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as AlbumList)),
      onError,
    );
    const unsubOrder = onSnapshot(
      listOrderDoc(user.uid),
      (snap) => setListOrder((snap.data()?.ids as string[] | undefined) ?? []),
      onError,
    );
    const unsubFeed = onSnapshot(
      feedMetaDoc(user.uid),
      (snap) => setFeed(snap.exists() ? (snap.data() as FeedMeta) : null),
      onError,
    );
    return () => {
      unsubAlbums();
      unsubLists();
      unsubOrder();
      unsubFeed();
    };
  }, [user.uid]);

  const value = useMemo(
    () =>
      albums && lists && listOrder
        ? {
            user,
            albums,
            lists: orderLists(lists, listOrder),
            albumById: new Map(albums.map((a) => [a.id, a])),
            feed,
          }
        : null,
    [user, albums, lists, listOrder, feed],
  );

  // Keep the listening feed current. Debounced so a burst of edits causes one rewrite;
  // syncFeed itself skips the write when nothing in the feed changed.
  useEffect(() => {
    if (!value?.feed) return;
    const { feed: meta } = value;
    let cancelled = false;
    const timer = setTimeout(() => {
      syncFeed(user.uid, meta, value, () => cancelled).catch(reportError);
    }, 2000);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value, user.uid]);

  if (error) {
    return (
      <div className="empty-state">
        <h1>Couldn't load your crate</h1>
        <p className="muted">{error}</p>
        <button type="button" className="btn" onClick={() => location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  if (!value) return <div className="loading" aria-label="Loading" />;
  return <CrateContext.Provider value={value}>{children}</CrateContext.Provider>;
}

/** The full-size cover for an album: a data URL, null if it has none, undefined while loading. */
export function useCover(albumId: string | undefined): string | null | undefined {
  const { user } = useCrate();
  const [cover, setCover] = useState<{ albumId: string; data: string | null }>();

  useEffect(() => {
    if (!albumId) return;
    return onSnapshot(
      doc(coversCol(user.uid), albumId),
      (snap) => setCover({ albumId, data: snap.exists() ? (snap.data().data as string) : null }),
      () => setCover({ albumId, data: null }),
    );
  }, [user.uid, albumId]);

  return cover && cover.albumId === albumId ? cover.data : undefined;
}
