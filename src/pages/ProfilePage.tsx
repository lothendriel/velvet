import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { useSeoMeta } from '@unhead/react';
import { ArrowLeft, ArrowRight, BadgeCheck, Camera, Heart, Image, Moon, Radio, ShieldCheck, Sun, Video } from 'lucide-react';
import { nip19 } from 'nostr-tools';
import { Link } from 'react-router-dom';
import { useAuthor } from '@/hooks/useAuthor';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAppContext } from '@/hooks/useAppContext';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useTheme } from '@/hooks/useTheme';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const CREATOR_LIST = 'velvet-adult-creators';
const FAVORITES_LIST = 'velvet-favorite-creators';

function parseFavorites(event: NostrEvent | undefined, owner: string): string[] {
  if (!event || event.kind !== 30000 || event.pubkey !== owner || !event.tags.some(([name, value]) => name === 'd' && value === FAVORITES_LIST)) return [];
  return Array.from(new Set(event.tags.filter(([name, value]) => name === 'p' && /^[0-9a-f]{64}$/i.test(value)).map(([, value]) => value)));
}

interface ProfilePageProps {
  pubkey: string;
}

function listIsSelfDeclared(event: NostrEvent | undefined, identifier: string, pubkey: string): boolean {
  if (!event || event.kind !== 30000 || event.pubkey !== pubkey) return false;
  if (!event.tags.some(([name, value]) => name === 'd' && value === identifier)) return false;
  return event.tags.some(([name, value]) => name === 'p' && value === pubkey);
}

function useCreatorRole(pubkey: string) {
  const { nostr } = useNostr();
  return useQuery({
    queryKey: ['velvet-profile-role', pubkey],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([{ kinds: [30000], authors: [pubkey], '#d': [CREATOR_LIST], limit: 10 }], { signal });
      return events.filter((event) => event.kind === 30000 && event.pubkey === pubkey && event.tags.some(([name, value]) => name === 'd' && value === CREATOR_LIST)).sort((a, b) => b.created_at - a.created_at)[0];
    },
    staleTime: 60_000,
  });
}

function FavoriteCard({ pubkey, event }: { pubkey: string; event: NostrEvent | undefined }) {
  let name = `${pubkey.slice(0, 6)}…${pubkey.slice(-4)}`;
  let picture: string | undefined;
  if (event) {
    try {
      const metadata: unknown = JSON.parse(event.content);
      if (typeof metadata === 'object' && metadata !== null) {
        if ('display_name' in metadata && typeof metadata.display_name === 'string') name = metadata.display_name;
        else if ('name' in metadata && typeof metadata.name === 'string') name = metadata.name;
        if ('picture' in metadata && typeof metadata.picture === 'string' && metadata.picture.startsWith('https://')) picture = metadata.picture;
      }
    } catch {
      // Render the abbreviated pubkey when profile metadata is invalid.
    }
  }
  return <Link className="favorite-card" to={`/${nip19.npubEncode(pubkey)}`}><Avatar className="favorite-avatar"><AvatarImage src={picture} alt="" referrerPolicy="no-referrer" /><AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><span><strong>{name}</strong><small>Creator profile</small></span><ArrowRight size={15} /></Link>;
}

function ProfileShell({ children }: { children: React.ReactNode }) {
  const { theme, setTheme } = useTheme();
  return (
    <main className="profile-page velvet-app">
      <header className="profile-topbar"><Link className="profile-back" to="/"><ArrowLeft size={17} /> Velvet</Link><span className="profile-top-brand">Creator community</span><div className="profile-top-actions"><button className="icon-button theme-toggle" aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}</button><Link className="profile-home" to="/">Home</Link></div></header>
      <div className="profile-content">{children}</div>
      <footer className="profile-footer"><Link to="/">Velvet</Link><span>Independent by nature · Built on Nostr</span><a href="https://shakespeare.diy" target="_blank" rel="noreferrer">Vibed with Shakespeare</a></footer>
    </main>
  );
}

function ProfileLoading() {
  return <ProfileShell><div className="profile-loading"><div className="profile-cover-skeleton" /><div className="profile-loading-row"><div className="profile-avatar-skeleton" /><div><i /><i /></div></div><div className="profile-card-skeleton" /><div className="profile-card-skeleton" /></div></ProfileShell>;
}

export function ProfilePage({ pubkey }: ProfilePageProps) {
  const { nostr } = useNostr();
  const authorQuery = useAuthor(pubkey);
  const { user } = useCurrentUser();
  const { config, updateConfig } = useAppContext();
  const { theme } = useTheme();
  const queryClient = useQueryClient();
  const { mutateAsync: publishEvent, isPending: isPublishing } = useNostrPublish();
  const isOwnProfile = user?.pubkey === pubkey;
  const isSiteOwner = user?.pubkey === '0155373ac79b7ffb0f586c3e68396f9e82d46f7afe7016d46ed9ca46ba3e1bed';
  const profileViewMode = isSiteOwner && isOwnProfile ? config.velvetProfileViewMode : 'automatic';
  const viewerPubkey = user?.pubkey;
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme !== 'dark');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);
  const [actionError, setActionError] = useState('');

  const roleQuery = useCreatorRole(pubkey);
  const isCreator = profileViewMode === 'automatic'
    ? listIsSelfDeclared(roleQuery.data, CREATOR_LIST, pubkey)
    : profileViewMode === 'creator';

  const viewerFavoritesQuery = useQuery({
    queryKey: ['velvet-favorite-creators', 'viewer', viewerPubkey ?? ''],
    queryFn: async ({ signal }) => {
      if (!viewerPubkey) return undefined;
      const events = await nostr.query([{ kinds: [30000], authors: [viewerPubkey], '#d': [FAVORITES_LIST], limit: 10 }], { signal });
      return events.filter((event) => event.kind === 30000 && event.pubkey === viewerPubkey && event.tags.some(([name, value]) => name === 'd' && value === FAVORITES_LIST)).sort((a, b) => b.created_at - a.created_at)[0];
    },
    enabled: Boolean(viewerPubkey),
    staleTime: 0,
  });
  const viewerFavoritePubkeys = useMemo(() => parseFavorites(viewerFavoritesQuery.data, viewerPubkey ?? ''), [viewerFavoritesQuery.data, viewerPubkey]);
  const profileFavoritesQuery = useQuery({
    queryKey: ['velvet-favorite-creators', 'profile', pubkey],
    queryFn: async ({ signal }) => {
      const events = await nostr.query([{ kinds: [30000], authors: [pubkey], '#d': [FAVORITES_LIST], limit: 10 }], { signal });
      return events.filter((event) => event.kind === 30000 && event.pubkey === pubkey && event.tags.some(([name, value]) => name === 'd' && value === FAVORITES_LIST)).sort((a, b) => b.created_at - a.created_at)[0];
    },
    enabled: !isCreator,
    staleTime: 60_000,
  });
  const profileFavoritePubkeys = useMemo(() => parseFavorites(profileFavoritesQuery.data, pubkey), [profileFavoritesQuery.data, pubkey]);
  const isFavorited = viewerFavoritePubkeys.includes(pubkey);

  const favoritesProfilesQuery = useQuery({
    queryKey: ['velvet-favorite-profile-metadata', pubkey, profileFavoritePubkeys],
    queryFn: async ({ signal }) => {
      if (profileFavoritePubkeys.length === 0) return [];
      const events = await nostr.query([{ kinds: [0], authors: profileFavoritePubkeys.slice(0, 100), limit: 100 }], { signal });
      const newest = new Map<string, NostrEvent>();
      for (const event of events) {
        const previous = newest.get(event.pubkey);
        if (!previous || event.created_at > previous.created_at) newest.set(event.pubkey, event);
      }
      return Array.from(newest.values());
    },
    enabled: !isCreator && profileFavoritePubkeys.length > 0,
    staleTime: 60_000,
  });
  const favoriteProfiles = new Map((favoritesProfilesQuery.data ?? []).map((event) => [event.pubkey, event]));
  const visibleFavoritePubkeys = profileFavoritePubkeys.slice(0, 100);

  const creatorPostsQuery = useQuery({
    queryKey: ['velvet-profile-posts', pubkey],
    queryFn: async ({ signal }) => nostr.query([{ kinds: [1], authors: [pubkey], '#t': ['adultcreator'], limit: 30 }], { signal }),
    enabled: isCreator,
    staleTime: 30_000,
  });

  const metadata = authorQuery.data?.metadata;
  const displayName = metadata?.display_name || metadata?.name || `${pubkey.slice(0, 8)}…${pubkey.slice(-6)}`;
  useSeoMeta({ title: `${displayName} — Velvet`, description: metadata?.about || `Nostr profile for ${displayName} on Velvet.` });

  const writeFavorites = async (target: string) => {
    if (!user || !viewerPubkey) return;
    setActionError('');
    const sourceFavorites = viewerFavoritePubkeys;
    const current = new Set(sourceFavorites);
    if (current.has(target)) current.delete(target);
    else current.add(target);
    const tags: string[][] = [
      ['d', FAVORITES_LIST],
      ['title', 'Velvet favorite creators'],
      ['description', 'Creator profiles this account chose to favorite on Velvet. This list is public.'],
      ['client', 'Velvet'],
      ...Array.from(current, (favorite) => ['p', favorite]),
      ['alt', 'Public list of creator profiles favorited by this Nostr account.'],
    ];
    const published = await publishEvent({ kind: 30000, content: '', tags });
    queryClient.setQueryData(['velvet-favorite-creators', 'viewer', viewerPubkey], published);
    if (isOwnProfile) queryClient.setQueryData(['velvet-favorite-creators', 'profile', pubkey], published);
    await queryClient.invalidateQueries({ queryKey: ['velvet-favorite-profile-metadata'] });
  };


  const toggleFavorite = async () => {
    if (!user || !isCreator || user.pubkey === pubkey || isPublishing) return;
    try {
      await writeFavorites(pubkey);
    } catch {
      setActionError('Favorite update did not publish. Check your relay connection and try again.');
    }
  };

  if (authorQuery.isPending || (profileViewMode === 'automatic' && roleQuery.isPending)) return <ProfileLoading />;

  const setCreatorStatus = async (shouldOptIn: boolean) => {
    if (!user || !isOwnProfile || isPublishing) return;
    setActionError('');
    try {
      const tags: string[][] = [
        ['d', CREATOR_LIST],
        ['title', 'Velvet adult creator profile'],
        ['description', 'Self-identification as an adult creator on Velvet. Public, optional, and not independently verified.'],
        ...(shouldOptIn ? [['p', user.pubkey]] : []),
        ['alt', shouldOptIn ? 'Public self-identification as an adult creator for Velvet; not independently verified.' : 'Opted out of public Velvet creator self-identification.'],
      ];
      const published = await publishEvent({ kind: 30000, content: '', tags });
      queryClient.setQueryData(['velvet-profile-role', pubkey], published);
      await queryClient.invalidateQueries({ queryKey: ['velvet-profile-posts', pubkey] });
      await queryClient.invalidateQueries({ queryKey: ['velvet-public-creators'] });
    } catch {
      setActionError('Creator profile update did not publish. Check your relay connection and try again.');
    }
  };

  return (
    <ProfileShell>
      <section className={`profile-hero ${isCreator ? 'profile-hero-creator' : ''}`}>
        {metadata?.banner?.startsWith('https://') ? <img className="profile-cover" src={metadata.banner} alt="" referrerPolicy="no-referrer" /> : <div className="profile-cover profile-cover-fallback"><span>v.</span></div>}
        <div className="profile-identity-row">
          <Avatar className="profile-avatar"><AvatarImage src={metadata?.picture?.startsWith('https://') ? metadata.picture : undefined} alt="" referrerPolicy="no-referrer" /><AvatarFallback>{displayName.slice(0, 1).toUpperCase()}</AvatarFallback></Avatar>
          <div className="profile-actions">
            {isCreator && <span className="creator-label"><BadgeCheck size={14} /> Adult creator · self-identified</span>}
            {isOwnProfile ? <Link className="secondary-button" to="/">Back to Velvet</Link> : isCreator && user && <button className={isFavorited ? 'secondary-button favorite-button favorited' : 'secondary-button favorite-button'} disabled={isPublishing || viewerFavoritesQuery.isPending} onClick={() => void toggleFavorite()}><Heart size={15} fill={isFavorited ? 'currentColor' : 'none'} /> {isFavorited ? 'Favorited' : 'Favorite creator'}</button>}
          </div>
        </div>
        <div className="profile-heading"><div><h1>{displayName}</h1><span className="profile-npub">{nip19.npubEncode(pubkey).slice(0, 18)}…{nip19.npubEncode(pubkey).slice(-6)}</span></div>{metadata?.nip05 && <span className="profile-nip05"><BadgeCheck size={14} /> {metadata.nip05}</span>}</div>
        {metadata?.about && <p className="profile-about">{metadata.about}</p>}
        <div className="profile-links">{metadata?.website?.startsWith('https://') && <a href={metadata.website} target="_blank" rel="noreferrer">{metadata.website.replace(/^https:\/\//, '')} <ArrowRight size={13} /></a>}<span><ShieldCheck size={13} /> Nostr identity</span></div>
        {user && isOwnProfile && isSiteOwner && <div className="creator-optin-callout profile-view-testing"><div><span className="eyebrow">SITE OWNER TESTING</span><strong>Profile preview mode</strong><p>Switch the layout locally without publishing a role change. This only changes how your profile appears on this device.</p></div><div className="profile-view-toggle" role="group" aria-label="Profile preview mode"><button className={profileViewMode === 'automatic' ? 'secondary-button selected' : 'secondary-button'} aria-pressed={profileViewMode === 'automatic'} onClick={() => updateConfig((current) => ({ ...current, velvetProfileViewMode: 'automatic' }))}>Automatic</button><button className={profileViewMode === 'regular' ? 'secondary-button selected' : 'secondary-button'} aria-pressed={profileViewMode === 'regular'} onClick={() => updateConfig((current) => ({ ...current, velvetProfileViewMode: 'regular' }))}>Regular view</button><button className={profileViewMode === 'creator' ? 'secondary-button selected' : 'secondary-button'} aria-pressed={profileViewMode === 'creator'} onClick={() => updateConfig((current) => ({ ...current, velvetProfileViewMode: 'creator' }))}>Creator view</button></div></div>}
        {user && isOwnProfile && profileViewMode === 'automatic' && !isCreator && <div className="creator-optin-callout"><div><span className="eyebrow">CREATOR PROFILE</span><strong>Work in the adult industry?</strong><p>Opt in to a creator profile to unlock the creator layout and appear in Velvet discovery. This is a public, self-identified label—not verification.</p></div><button className="primary-button" disabled={isPublishing} onClick={() => void setCreatorStatus(true)}>{isPublishing ? 'Updating…' : 'Opt in as creator'} <ArrowRight size={15} /></button></div>}
        {user && isOwnProfile && profileViewMode === 'automatic' && isCreator && <div className="creator-optin-callout creator-opted-in"><div><span className="eyebrow">CREATOR PROFILE · PUBLIC</span><strong>Your profile is set to creator mode.</strong><p>Your creator label is self-identified and public on Nostr. You can switch back to a regular profile here.</p></div><button className="secondary-button" disabled={isPublishing} onClick={() => void setCreatorStatus(false)}>{isPublishing ? 'Updating…' : 'Opt out'}</button></div>}
        {actionError && <p className="error-message profile-action-error" role="alert">{actionError}</p>}
      </section>

      {isCreator ? <>
        <nav className="creator-profile-tabs" aria-label="Creator profile sections"><a className="creator-tab-active" href="#creator-feed"><Radio size={15} /> Feed</a><a href="#gallery"><Image size={15} /> Photos</a><a href="#videos"><Video size={15} /> Videos</a><a href="#live"><Camera size={15} /> Live</a></nav>
        <section className="profile-section" id="creator-feed"><div className="profile-section-heading"><div><span className="eyebrow">CREATOR NOTES</span><h2>From {displayName}</h2></div></div>
          {creatorPostsQuery.isPending ? <div className="profile-card-skeleton" /> : (creatorPostsQuery.data ?? []).length > 0 ? <div className="creator-post-list">{(creatorPostsQuery.data ?? []).slice(0, 20).map((event) => <article className="creator-post-card" key={event.id}><span className="eyebrow">{new Date(event.created_at * 1000).toLocaleDateString()}</span><p>{event.content}</p><Link to={`/${nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind })}`}>Open conversation <ArrowRight size={14} /></Link></article>)}</div> : <div className="profile-empty"><Radio size={20} /><strong>No creator notes yet</strong><span>Creator posts will appear here.</span></div>}
        </section>
        <section className="profile-section" id="gallery"><div className="profile-section-heading"><div><span className="eyebrow">IMAGE GALLERY</span><h2>Photos</h2></div></div><div className="profile-empty"><Image size={20} /><strong>Photo gallery foundation</strong><span>Creator photo collections will live here. Media publishing and access settings can be added next.</span></div></section>
        <section className="profile-section" id="videos"><div className="profile-section-heading"><div><span className="eyebrow">VIDEO GALLERY</span><h2>Videos</h2></div></div><div className="profile-empty"><Video size={20} /><strong>Video gallery foundation</strong><span>Creator video collections will live here, using Nostr video events.</span></div></section>
        <section className="profile-section" id="live"><div className="profile-section-heading"><div><span className="eyebrow">LIVE SHOWS</span><h2>Live</h2></div></div><div className="profile-empty"><Camera size={20} /><strong>Live show foundation</strong><span>Live activity announcements can use NIP-53. Streaming provider setup is a separate step.</span></div></section>
      </> : <section className="profile-section favorites-section"><div className="profile-section-heading"><div><span className="eyebrow">YOUR CREATOR LIST</span><h2>{isOwnProfile ? 'Favorite creators' : `${displayName}’s favorites`}</h2></div>{isOwnProfile && <span className="favorites-privacy"><ShieldCheck size={13} /> Public Nostr list</span>}</div>
        {profileFavoritesQuery.isPending || (profileFavoritePubkeys.length > 0 && favoritesProfilesQuery.isPending) ? <div className="profile-card-skeleton" /> : visibleFavoritePubkeys.length > 0 ? <><div className="favorite-grid">{visibleFavoritePubkeys.map((favoritePubkey) => <FavoriteCard key={favoritePubkey} pubkey={favoritePubkey} event={favoriteProfiles.get(favoritePubkey)} />)}</div>{profileFavoritePubkeys.length > visibleFavoritePubkeys.length && <p className="favorites-overflow">Showing first {visibleFavoritePubkeys.length} of {profileFavoritePubkeys.length} favorites.</p>}</> : <div className="profile-empty"><Heart size={20} /><strong>{isOwnProfile ? 'No favorite creators yet' : 'No public creator favorites'}</strong><span>{isOwnProfile ? 'Visit a creator profile and tap Favorite creator to add them here.' : 'This user has not shared any favorite creators.'}</span></div>}
      </section>}
      <div className="profile-disclaimer"><ShieldCheck size={15} /> Creator status is self-identified, not independently verified. Profile details, posts, and public favorites are visible on Nostr. Nostr clients cannot enforce audience visibility beyond Velvet’s own interface.</div>
    </ProfileShell>
  );
}
