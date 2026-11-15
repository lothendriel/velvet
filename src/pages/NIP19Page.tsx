import { nip19 } from 'nostr-tools';
import { Link, useParams } from 'react-router-dom';
import NotFound from './NotFound';
import { ProfilePage } from './ProfilePage';

export function NIP19Page() {
  const { nip19: identifier } = useParams<{ nip19: string }>();

  if (!identifier) {
    return <NotFound />;
  }

  let decoded;
  try {
    decoded = nip19.decode(identifier);
  } catch {
    return <NotFound />;
  }

  const { type } = decoded;

  switch (type) {
    case 'npub':
      return <ProfilePage pubkey={decoded.data} />;

    case 'nprofile':
      return <ProfilePage pubkey={decoded.data.pubkey} />;

    case 'note':
      return <div className="profile-page velvet-app"><main className="profile-content"><div className="profile-empty"><h1>Note view coming next</h1><p>This identifier is valid, but the note viewer hasn’t been built yet.</p><Link className="secondary-button" to="/">Return to Velvet</Link></div></main></div>;

    case 'nevent':
      return <div className="profile-page velvet-app"><main className="profile-content"><div className="profile-empty"><h1>Event view coming next</h1><p>This identifier is valid, but the event viewer hasn’t been built yet.</p><Link className="secondary-button" to="/">Return to Velvet</Link></div></main></div>;

    case 'naddr':
      return <div className="profile-page velvet-app"><main className="profile-content"><div className="profile-empty"><h1>Addressable event view coming next</h1><p>This identifier is valid, but the event viewer hasn’t been built yet.</p><Link className="secondary-button" to="/">Return to Velvet</Link></div></main></div>;

    default:
      return <NotFound />;
  }
} 