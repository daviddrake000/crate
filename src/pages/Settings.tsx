import { useState } from 'react';
import { useCrate } from '../crate';
import { feedInstructions, feedUrl, startFeed, stopFeed } from '../feed';

export function Settings() {
  return (
    <div className="page narrow">
      <h1 className="page-title">Settings</h1>
      <FeedSettings />
    </div>
  );
}

/** Create, copy, replace or turn off the read-only feed for AI assistants. */
function FeedSettings() {
  const crate = useCrate();
  const { user, feed } = crate;
  const [copied, setCopied] = useState('');

  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(''), 2000);
    } catch {
      setCopied('Copy failed: select the text and copy it instead');
    }
  };

  const regenerate = () => {
    if (!feed) return;
    if (!confirm('Make a new link? The current one stops working immediately, so you will need to give the new one to your assistant.')) {
      return;
    }
    startFeed(user.uid, crate, feed);
  };

  const turnOff = () => {
    if (!feed) return;
    if (!confirm('Turn off the listening feed? The link stops working immediately.')) return;
    stopFeed(user.uid, feed);
  };

  return (
    <section className="settings-section">
      <h2 className="section-heading">Listening feed for AI assistants</h2>
      <p>
        A private, read-only link that lets an AI assistant read your albums, ratings, reviews and lists. It
        can't change anything. Anyone who has the link can read it, so only give it to your assistant.
      </p>

      {feed === undefined ? null : feed === null ? (
        <button type="button" className="btn btn-primary" onClick={() => startFeed(user.uid, crate)}>
          Create feed link
        </button>
      ) : (
        <>
          <label className="field">
            <span>Feed link</span>
            <input readOnly value={feedUrl(feed.token)} onFocus={(e) => e.target.select()} />
          </label>
          <div className="settings-actions">
            <button type="button" className="btn btn-primary" onClick={() => copy(feedInstructions(feed.token), 'Instructions copied')}>
              Copy instructions for your assistant
            </button>
            <button type="button" className="btn" onClick={() => copy(feedUrl(feed.token), 'Link copied')}>
              Copy link only
            </button>
            <span className="muted" role="status">
              {copied}
            </span>
          </div>
          <p className="muted settings-note">
            Updates automatically whenever your crate changes
            {feed.updatedAt ? `; last updated ${new Date(feed.updatedAt).toLocaleString()}` : ''}.
          </p>
          <div className="settings-actions">
            <button type="button" className="btn" onClick={regenerate}>
              Make a new link
            </button>
            <button type="button" className="btn btn-danger" onClick={turnOff}>
              Turn off
            </button>
          </div>
        </>
      )}
    </section>
  );
}
