import { useEffect, useRef, useState, type DragEvent, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { deleteAlbum, saveAlbum, type Album } from '../db';
import { useCover, useCrate } from '../crate';
import { DiscInput } from '../components/Rating';
import { ListPicker } from '../components/ListPicker';
import { Cover } from '../components/Cover';
import { MONTHS, makeCoverImages, type CoverImages } from '../utils';

/** Log a new album (/new) or edit an existing one (/album/:id/edit). */
export function AlbumForm() {
  const { id } = useParams();
  const { albumById } = useCrate();
  const navigate = useNavigate();
  const existing = id ? albumById.get(id) : undefined;

  useEffect(() => {
    if (id && !existing) navigate('/', { replace: true });
  }, [id, existing, navigate]);

  if (id && !existing) return null;
  // Keyed so switching between albums starts from fresh form state
  return <AlbumFormFields key={id ?? 'new'} existing={existing} />;
}

function AlbumFormFields({ existing }: { existing?: Album }) {
  const { lists } = useCrate();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const savedCover = useCover(existing?.id);

  const [title, setTitle] = useState(existing?.title ?? '');
  const [artist, setArtist] = useState(existing?.artist ?? '');
  // The release date is entered in parts so the day and month can be left out
  const [savedYear = '', savedMonth = '', savedDay = ''] = existing?.released?.split('-') ?? [];
  const [day, setDay] = useState(savedDay ? String(Number(savedDay)) : '');
  const [month, setMonth] = useState(savedMonth);
  const [year, setYear] = useState(savedYear);
  const [rating, setRating] = useState(existing?.rating);
  const [review, setReview] = useState(existing?.review ?? '');
  // undefined = unchanged, null = removed
  const [newCover, setNewCover] = useState<CoverImages | null | undefined>();
  const [listIds, setListIds] = useState<string[]>(() => {
    if (existing) return lists.filter((l) => l.albumIds.includes(existing.id)).map((l) => l.id);
    const fromList = searchParams.get('list');
    return fromList ? [fromList] : [];
  });
  const [error, setError] = useState('');

  // What the cover box shows: a new upload, the saved full-size cover, or its thumbnail while that loads
  const shownCover = newCover === undefined ? (savedCover ?? existing?.thumb) : newCover?.cover;

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('A title is required.');
      return;
    }
    const release = releaseFromParts(day.trim(), month, year.trim());
    if (release.error) {
      setError(release.error);
      return;
    }
    try {
      const id = saveAlbum({
        input: {
          title: title.trim(),
          artist: artist.trim(),
          released: release.released,
          rating,
          review: review.trim() || undefined,
        },
        cover: newCover,
        listIds,
        lists,
        existing,
      });
      navigate(`/album/${id}`, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save the album.');
    }
  };

  const onDelete = () => {
    if (!existing) return;
    if (!confirm(`Delete “${existing.title}” from your crate? This also removes it from all lists.`)) return;
    deleteAlbum(existing, lists);
    navigate('/', { replace: true });
  };

  const toggleList = (id: string) =>
    setListIds((ids) => (ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id]));

  return (
    <div className="page narrow">
      <h1 className="page-title">{existing ? 'Edit album' : 'Log an album'}</h1>

      <form className="album-form" onSubmit={onSubmit}>
        <CoverField
          cover={shownCover ?? undefined}
          title={title}
          artist={artist}
          onChange={setNewCover}
          onError={setError}
        />

        <div className="form-fields">
          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus={!existing} />
          </label>
          <label className="field">
            <span>Artist</span>
            <input value={artist} onChange={(e) => setArtist(e.target.value)} />
          </label>
          <div className="field" role="group" aria-labelledby="release-label">
            <span id="release-label">Release date</span>
            <div className="date-parts">
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={31}
                step={1}
                placeholder="Day"
                aria-label="Day"
                value={day}
                onChange={(e) => setDay(e.target.value)}
              />
              <select
                aria-label="Month"
                className={month ? '' : 'is-empty'}
                value={month}
                onChange={(e) => setMonth(e.target.value)}
              >
                <option value="">Month</option>
                {MONTHS.map((name, i) => (
                  <option key={name} value={String(i + 1).padStart(2, '0')}>
                    {name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                inputMode="numeric"
                step={1}
                placeholder="Year"
                aria-label="Year"
                value={year}
                onChange={(e) => setYear(e.target.value)}
              />
            </div>
          </div>

          <div className="field">
            <span>Rating</span>
            <DiscInput value={rating} onChange={setRating} />
          </div>

          <label className="field">
            <span>Review</span>
            <textarea
              rows={6}
              value={review}
              onChange={(e) => setReview(e.target.value)}
              placeholder="What did you think?"
            />
          </label>

          <div className="field">
            <span>Lists</span>
            <ListPicker selected={listIds} onToggle={toggleList} />
          </div>

          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}

          <div className="form-actions">
            {existing && (
              <button type="button" className="btn btn-danger" onClick={onDelete}>
                Delete
              </button>
            )}
            <span className="spacer" />
            <button type="button" className="btn" onClick={() => navigate(-1)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Builds YYYY, YYYY-MM or YYYY-MM-DD from the form's parts, or explains what's missing. */
function releaseFromParts(day: string, month: string, year: string): { released?: string; error?: string } {
  if (!year) return day || month ? { error: 'Add the year to the release date.' } : {};
  if (!/^\d{4}$/.test(year)) return { error: 'Enter the release year as four digits.' };
  if (!month) return day ? { error: 'Pick a month for the release date.' } : { released: year };
  if (!day) return { released: `${year}-${month}` };
  const d = Number(day);
  const daysInMonth = new Date(Number(year), Number(month), 0).getDate();
  if (!Number.isInteger(d) || d < 1 || d > daysInMonth) return { error: `Enter a release day from 1 to ${daysInMonth}.` };
  return { released: `${year}-${month}-${String(d).padStart(2, '0')}` };
}

interface CoverFieldProps {
  cover: string | undefined;
  title: string;
  artist: string;
  onChange: (cover: CoverImages | null) => void;
  onError: (message: string) => void;
}

function CoverField({ cover, title, artist, onChange, onError }: CoverFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    try {
      onChange(await makeCoverImages(file));
      onError('');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not read that image.');
    } finally {
      setBusy(false);
    }
  };

  // Paste an image from the clipboard anywhere on the form page
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const file = [...(e.clipboardData?.files ?? [])].find((f) => f.type.startsWith('image/'));
      if (file) {
        e.preventDefault();
        handleFile(file);
      }
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  return (
    <div className="cover-field">
      <button
        type="button"
        className={`dropzone${dragging ? ' dragging' : ''}${cover ? ' has-cover' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        aria-label={cover ? 'Replace cover art' : 'Upload cover art'}
      >
        {cover ? (
          <Cover album={{ title, artist }} src={cover} />
        ) : (
          <span className="dropzone-hint">
            {busy ? (
              'Processing…'
            ) : (
              <>
                <strong>Add cover art</strong>
                <span>Tap to choose an image, or drop or paste one</span>
              </>
            )}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      {cover && (
        <div className="cover-actions">
          <button type="button" className="link-button" onClick={() => inputRef.current?.click()}>
            Replace
          </button>
          <button type="button" className="link-button" onClick={() => onChange(null)}>
            Remove
          </button>
        </div>
      )}
    </div>
  );
}
