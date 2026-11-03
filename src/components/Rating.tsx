import { useState, type KeyboardEvent } from 'react';
import { ratingText } from '../utils';

// A record with its centre hole cut out (even-odd fill)
const DISC_PATH = 'M12 1.5a10.5 10.5 0 1 0 0 21a10.5 10.5 0 1 0 0-21zM12 9.6a2.4 2.4 0 1 1 0 4.8a2.4 2.4 0 1 1 0-4.8z';

function DiscIcon({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={DISC_PATH} fillRule="evenodd" />
    </svg>
  );
}

/** One disc filled 0, 50 or 100 percent. */
function DiscSlot({ fill, size }: { fill: number; size: number }) {
  return (
    <span className="disc-slot" style={{ width: size, height: size }}>
      <span className="disc-empty">
        <DiscIcon size={size} />
      </span>
      <span className="disc-fill" style={{ width: `${fill}%` }}>
        <DiscIcon size={size} />
      </span>
    </span>
  );
}

/** Read-only rating: one disc per point and half a disc for a half, e.g. 3½ = three and a half discs. */
export function Discs({ rating, size = 12, className = '' }: { rating?: number; size?: number; className?: string }) {
  if (!rating) return null;
  const count = Math.ceil(rating);
  return (
    <span className={`discs ${className}`} role="img" aria-label={`${rating} out of 5`} title={`${rating} / 5`}>
      {Array.from({ length: count }, (_, i) => (
        <DiscSlot key={i} size={size} fill={rating >= i + 1 ? 100 : 50} />
      ))}
    </span>
  );
}

interface DiscInputProps {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  size?: number;
}

/** Half-step rating input. Click the left or right half of a disc; click the current value again to clear. */
export function DiscInput({ value, onChange, size = 30 }: DiscInputProps) {
  const [hover, setHover] = useState<number | null>(null);
  const shown = hover ?? value ?? 0;

  const pick = (v: number) => onChange(v === value ? undefined : v);

  const onKeyDown = (e: KeyboardEvent) => {
    const current = value ?? 0;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(Math.min(5, current + 0.5));
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault();
      const next = current - 0.5;
      onChange(next > 0 ? next : undefined);
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      e.preventDefault();
      onChange(undefined);
    }
  };

  return (
    <div className="disc-input-wrap">
      <div
        className={`disc-input${hover !== null ? ' is-hovering' : ''}`}
        role="slider"
        tabIndex={0}
        aria-label="Rating"
        aria-valuemin={0}
        aria-valuemax={5}
        aria-valuenow={value ?? 0}
        aria-valuetext={value ? `${value} out of 5` : 'Unrated'}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <span key={i} className="disc-input-slot">
            <DiscSlot size={size} fill={shown >= i ? 100 : shown >= i - 0.5 ? 50 : 0} />
            <span className="disc-hit left" onMouseEnter={() => setHover(i - 0.5)} onClick={() => pick(i - 0.5)} />
            <span className="disc-hit right" onMouseEnter={() => setHover(i)} onClick={() => pick(i)} />
          </span>
        ))}
      </div>
      <span className="disc-input-label">{shown ? `${ratingText(shown)} / 5` : 'Unrated'}</span>
      {value !== undefined && hover === null && (
        <button type="button" className="link-button" onClick={() => onChange(undefined)}>
          Clear
        </button>
      )}
    </div>
  );
}
