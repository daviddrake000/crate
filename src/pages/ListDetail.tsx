import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import {
  deleteList,
  isRanked,
  setAlbumInList,
  setListAlbums,
  setListRanked,
  updateList,
  type Album,
  type AlbumList,
} from '../db';
import { useCrate } from '../crate';
import { LIST_SORTS, useAlbumQuery } from '../albumQuery';
import { AlbumGrid } from '../components/AlbumGrid';
import { AlbumControls, NoMatches } from '../components/AlbumControls';
import { Cover } from '../components/Cover';
import { ReorderList } from '../components/ReorderList';
import { plural, releaseYear } from '../utils';

export function ListDetail() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { lists, albumById } = useCrate();
  const list = lists.find((l) => l.id === id);
  const albums = useMemo(
    () => (list?.albumIds ?? []).map((albumId) => albumById.get(albumId)).filter((a): a is Album => !!a),
    [list, albumById],
  );
  const q = useAlbumQuery(albums, LIST_SORTS);
  // Place in the list, 1 = top. Kept when the grid is sorted or filtered another way.
  const rankById = useMemo(() => new Map(albums.map((album, i) => [album.id, i + 1])), [albums]);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [reordering, setReordering] = useState(false);

  if (!list) {
    return (
      <div className="empty-state">
        <h1>List not found</h1>
        <Link to="/lists" className="btn">
          All lists
        </Link>
      </div>
    );
  }

  const ranked = isRanked(list);

  const onDelete = () => {
    if (!confirm(`Delete the list “${list.name}”? The albums themselves stay in your crate.`)) return;
    deleteList(id);
    navigate('/lists', { replace: true });
  };

  return (
    <div className="page">
      <Link to="/lists" className="back-link">
        ← All lists
      </Link>

      {editing ? (
        <EditListForm list={list} onDone={() => setEditing(false)} />
      ) : (
        <header className="list-header">
          <div>
            <h1 className="page-title">{list.name}</h1>
            {list.description && <p className="list-description">{list.description}</p>}
            <p className="list-count">{plural(albums.length, 'album')}</p>
          </div>
          <div className="list-header-actions">
            <button
              type="button"
              className="btn btn-switch"
              aria-pressed={ranked}
              onClick={() => setListRanked(id, !ranked)}
              title={ranked ? 'Numbered as a ranking' : 'Not numbered'}
            >
              <span className="switch" aria-hidden="true" />
              Ranked
            </button>
            <button type="button" className="btn" onClick={() => setEditing(true)}>
              Edit
            </button>
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              Delete
            </button>
          </div>
        </header>
      )}

      <div className="toolbar ruled">
        <h2 className="section-heading">
          Albums
          {q.isFiltered && !reordering && <span className="muted">{`${q.shown.length} of ${albums.length}`}</span>}
        </h2>
        {reordering ? (
          <button type="button" className="btn btn-primary" onClick={() => setReordering(false)}>
            Done
          </button>
        ) : (
          <>
            {albums.length > 1 && <AlbumControls q={q} />}
            <div className="toolbar-buttons">
              {albums.length > 1 && !adding && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    // The list's own order is what's being edited, so show it unsorted and unfiltered
                    q.reset();
                    setReordering(true);
                  }}
                >
                  Reorder
                </button>
              )}
              <button
                type="button"
                className={`btn${adding ? '' : ' btn-primary'}`}
                onClick={() => setAdding((a) => !a)}
              >
                {adding ? 'Done adding' : 'Add albums'}
              </button>
            </div>
          </>
        )}
      </div>

      {adding && <AddAlbumsPanel list={list} />}

      {reordering ? (
        <>
          <p className="reorder-hint muted">
            Drag the handles to set this list's order. Changes save automatically.
          </p>
          <ReorderList
            items={albums}
            getId={(album) => album.id}
            itemLabel={(album) => album.title}
            onReorder={(ids) => setListAlbums(id, ids)}
            renderItem={(album) => (
              <>
                <span className="reorder-thumb" aria-hidden="true">
                  <Cover album={album} />
                </span>
                <span className="reorder-text">
                  <span className="reorder-name">{album.title}</span>
                  <span className="reorder-sub">{[album.artist, releaseYear(album.released)].filter(Boolean).join(' · ')}</span>
                </span>
              </>
            )}
          />
        </>
      ) : albums.length === 0 ? (
        !adding && <p className="muted center pad">This list is empty. Use “Add albums” to fill it.</p>
      ) : q.shown.length ? (
        <AlbumGrid
          albums={q.shown}
          rankOf={ranked ? (album) => rankById.get(album.id) : undefined}
          onRemove={(album) => setAlbumInList(id, album.id, false)}
          removeLabel="Remove from list"
        />
      ) : (
        <NoMatches q={q} />
      )}
    </div>
  );
}

function EditListForm({ list, onDone }: { list: AlbumList; onDone: () => void }) {
  const [name, setName] = useState(list.name);
  const [description, setDescription] = useState(list.description ?? '');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    updateList(list.id, { name: name.trim(), description: description.trim() || undefined });
    onDone();
  };

  return (
    <form className="panel list-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onDone}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Save
        </button>
      </div>
    </form>
  );
}

function AddAlbumsPanel({ list }: { list: AlbumList }) {
  const { albums } = useCrate();
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => {
    const inList = new Set(list.albumIds);
    const q = query.trim().toLowerCase();
    return albums
      .filter((a) => !inList.has(a.id))
      .filter((a) => !q || a.title.toLowerCase().includes(q) || a.artist.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title));
  }, [albums, list.albumIds, query]);

  return (
    <div className="panel add-panel">
      <div className="add-panel-head">
        <input
          type="search"
          className="search"
          placeholder="Search your albums"
          aria-label="Search your albums"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <Link to={`/new?list=${list.id}`} className="link-button">
          Log a new album into this list →
        </Link>
      </div>
      {candidates.length ? (
        <ul className="pick-grid">
          {candidates.map((album) => (
            <li key={album.id}>
              <button
                type="button"
                className="pick-item"
                onClick={() => setAlbumInList(list.id, album.id, true)}
                title={`Add “${album.title}”`}
              >
                <span className="pick-cover">
                  <Cover album={album} />
                  <span className="pick-plus" aria-hidden="true">
                    +
                  </span>
                </span>
                <span className="pick-title">{album.title}</span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="muted center">
          {query.trim()
            ? 'No matches.'
            : albums.length
              ? 'Every album in your crate is already in this list.'
              : 'Your crate is empty.'}
        </p>
      )}
    </div>
  );
}
