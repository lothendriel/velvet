import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ArrowLeft, ArrowRight, BadgeCheck, Moon, ShieldCheck, Sun, Users } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CREATOR_LIST = 'velvet-adult-creators';
export function CreatorDirectoryPage() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const { theme, setTheme } = useTheme();
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme !== 'dark');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);
  const directoryQuery = useQuery({
    queryKey: ['velvet-public-creators'],
    queryFn: async ({ signal }) => {
      const recent = await nostr.query([{ kinds: [30000], '#d': [CREATOR_LIST], limit: 2000 }], { signal });
      const owners = Array.from(new Set(recent.filter((event) => event.kind === 30000 && event.tags.some(([name, value]) => name === 'd' && value === CREATOR_LIST)).map((event) => event.pubkey)));
      const latestByOwner = new Map<string, NostrEvent>();
      for (let start = 0; start < owners.length; start += 100) {
        const chunk = owners.slice(start, start + 100);
        const lists = await nostr.query(chunk.map((author) => ({ kinds: [30000], authors: [author], '#d': [CREATOR_LIST], limit: 10 })), { signal });
        for (const event of lists) {
          if (event.kind !== 30000 || !chunk.includes(event.pubkey) || !event.tags.some(([name, value]) => name === 'd' && value === CREATOR_LIST)) continue;
          const latest = latestByOwner.get(event.pubkey);
          if (!latest || event.created_at > latest.created_at) latestByOwner.set(event.pubkey, event);
        }
      }
      const members = Array.from(latestByOwner.values()).filter((event) => event.tags.some(([name, value]) => name === 'p' && value === event.pubkey)).map((event) => event.pubkey);
      if (!members.length) return [];
      const metadataEvents = await nostr.query([{ kinds: [0], authors: members.slice(0, 100), limit: 100 }], { signal });
      const latestMetadata = new Map<string, NostrEvent>();
      for (const event of metadataEvents) {
        const previous = latestMetadata.get(event.pubkey);
        if (!previous || event.created_at > previous.created_at) latestMetadata.set(event.pubkey, event);
      }
      return members.map((pubkey) => ({ pubkey, event: latestMetadata.get(pubkey) })).filter((entry): entry is { pubkey: string; event: NostrEvent } => Boolean(entry.event));
    },
    staleTime: 60_000,
    retry: 1,
  });

  const parseMetadata = (event: NostrEvent): Record<string, unknown> => {
    try {
      const content: unknown = JSON.parse(event.content);
      if (typeof content === 'object' && content !== null) return content as Record<string, unknown>;
    } catch {
      // Fall back to a short key when profile metadata is malformed.
    }
    return {};
  };


  return (
    <main className="profile-page velvet-app">
      <header className="profile-topbar"><Link className="profile-back" to="/"><ArrowLeft size={17} /> Velvet</Link><span className="profile-top-brand">Creator directory</span><span className="directory-top-actions"><button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button>{user && <Link className="profile-home" to={`/${nip19.npubEncode(user.pubkey)}`}>My profile</Link>}</span></header>
      <div className="profile-content">
        <header className="directory-page-heading"><span className="eyebrow">A COMMUNITY BY CHOICE</span><h1>Meet the creators.</h1><p>People here chose to identify as adult creators on Nostr. Profiles are self-identified, not verified.</p></header>
        {!user && <div className="directory-optin-card"><div><strong>Creator in the adult industry?</strong><p>Sign in, open your profile, and opt in to appear in the public directory.</p></div><Link className="secondary-button" to="/">Join Velvet <ArrowRight size={14} /></Link></div>}
        {directoryQuery.isPending ? <div className="favorite-grid">{Array.from({ length: 4 }, (_, index) => <div className="creator-directory-skeleton" key={index} />)}</div> : directoryQuery.isError ? <div className="profile-empty"><Users size={20} /><strong>Couldn’t load creators</strong><span>Try again when your relays are available.</span><button className="secondary-button" onClick={() => void directoryQuery.refetch()}>Retry</button></div> : directoryQuery.data?.length ? <div className="public-creator-grid">{directoryQuery.data.map(({ pubkey, event }) => {
          const profile = parseMetadata(event);
          const nameValue = profile.display_name || profile.name;
          const name = typeof nameValue === 'string' ? nameValue : `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
          const about = typeof profile.about === 'string' ? profile.about : '';
          const picture = typeof profile.picture === 'string' && profile.picture.startsWith('https://') ? profile.picture : undefined;
          return <Link className="public-creator-card" key={pubkey} to={`/${nip19.npubEncode(pubkey)}`}><Avatar className="public-creator-avatar"><AvatarImage src={picture} alt="" referrerPolicy="no-referrer" /><AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><span className="public-creator-copy"><strong>{name}</strong><small>{about || `npub:${pubkey.slice(0, 8)}…`}</small></span><span className="self-identified-badge"><BadgeCheck size={11} /> Self-identified</span><ArrowRight className="directory-card-arrow" size={16} /></Link>;
        })}</div> : <div className="profile-empty"><Users size={20} /><strong>No one has opted in yet</strong><span>Creators can opt in from their own Velvet profile.</span></div>}
        <div className="profile-disclaimer"><ShieldCheck size={15} /><span>This directory is discovery only. Listings are self-asserted—not age verification, identity verification, or endorsement. Favorites are managed on creator profiles and are public Nostr lists.</span></div>
      </div>
      <footer className="profile-footer"><Link to="/">Velvet</Link><span>Built on Nostr · Vibed with Shakespeare</span></footer>
    </main>
  );
}
