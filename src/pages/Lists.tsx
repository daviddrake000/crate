import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { createList, isRanked, saveListOrder, type AlbumList } from '../db';
import { useCrate } from '../crate';
import { ListArt } from '../components/ListArt';
import { ReorderList } from '../components/ReorderList';
import { plural } from '../utils';

export function Lists() {
  const { lists } = useCrate();
  const [creating, setCreating] = useState(false);
  const [reordering, setReordering] = useState(false);

  return (
    <div className="page">
      <div className="toolbar">
        <h1 className="page-title">Lists</h1>
        <div className="toolbar-buttons">
          {reordering ? (
            <button type="button" className="btn btn-primary" onClick={() => setReordering(false)}>
              Done
            </button>
          ) : (
            !creating && (
              <>
                {lists.length > 1 && (
                  <button type="button" className="btn" onClick={() => setReordering(true)}>
                    Reorder
                  </button>
                )}
                <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
                  New list
                </button>
              </>
            )
          )}
        </div>
      </div>

      {creating && <NewListForm onCancel={() => setCreating(false)} />}

      {reordering ? (
        <>
          <p className="reorder-hint muted">Drag the handles to put your lists in order. Changes save automatically.</p>
          <ReorderList
            items={lists}
            getId={(list) => list.id}
            itemLabel={(list) => list.name}
            onReorder={saveListOrder}
            renderItem={(list) => (
              <>
                <ListArt list={list} className="reorder-thumb" />
                <span className="reorder-text">
                  <span className="reorder-name">{list.name}</span>
                  <span className="reorder-sub">{listSummary(list)}</span>
                </span>
              </>
            )}
          />
        </>
      ) : lists.length === 0 && !creating ? (
        <div className="empty-state">
          <p>Lists let you group albums however you like: desert-island picks, a genre, a year, a road-trip rotation.</p>
          <button type="button" className="btn btn-primary btn-large" onClick={() => setCreating(true)}>
            Start your first list
          </button>
        </div>
      ) : (
        <ul className="list-cards">
          {lists.map((list) => (
            <li key={list.id}>
              <Link to={`/lists/${list.id}`} className="list-card">
                <ListArt list={list} />
                <h2 className="list-card-name">{list.name}</h2>
                <p className="list-card-count">{listSummary(list)}</p>
                {list.description && <p className="list-card-desc">{list.description}</p>}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** "Ranked · 12 albums" or "12 albums" */
function listSummary(list: AlbumList): string {
  const count = plural(list.albumIds.length, 'album');
  return isRanked(list) ? `Ranked · ${count}` : count;
}

function NewListForm({ onCancel }: { onCancel: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    navigate(`/lists/${createList(name.trim(), description.trim() || undefined)}`);
  };

  return (
    <form className="panel list-form" onSubmit={onSubmit}>
      <label className="field">
        <span>Name</span>
        <input value={name} onChange={(e) => setName(e.target.value)} autoFocus required placeholder="e.g. Desert-island albums" />
      </label>
      <label className="field">
        <span>Description</span>
        <textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <div className="form-actions">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" disabled={!name.trim()}>
          Create list
        </button>
      </div>
    </form>
  );
}
