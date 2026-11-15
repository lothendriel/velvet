import { useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent } from '@nostrify/nostrify';
import { nip19 } from 'nostr-tools';
import {
  ArrowDownRight, ArrowRight, Bell, ChevronDown, CircleHelp,
  Compass, Heart, LockKeyhole, Menu, MessageCircle, MoreHorizontal, Radio,
  Search, ShieldCheck, Sparkles, Users, Wallet, X,
} from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';

const topics = ['For you', 'Creator notes', 'Industry talk', 'Work & wellness'];
const timeAgo = (timestamp: number) => {
  const minutes = Math.max(1, Math.floor((Date.now() / 1000 - timestamp) / 60));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
};

function AgeGate({ onEnter }: { onEnter: () => void }) {
  const [confirmed, setConfirmed] = useState(false);
  return (
    <main className="age-screen">
      <div className="age-grain" aria-hidden="true" />
      <div className="age-card">
        <a href="/" className="brand-lockup age-brand"><span className="brand-mark">v.</span><span>velvet<span className="brand-dot">.</span></span></a>
        <div className="age-rule" />
        <p className="eyebrow">A creator-first network</p>
        <h1>Made for the people<br />behind the work.</h1>
        <p className="age-copy">A more human corner of the internet for adult creators, performers, and the people who support them.</p>
        <div className="age-notice"><ShieldCheck size={19} /><span>Velvet is an 18+ community. This experience is intended for adults only.</span></div>
        <label className="age-check"><input type="checkbox" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} /><span>I confirm that I am at least 18 years old and can legally access this site where I live.</span></label>
        <button className="primary-button age-enter" disabled={!confirmed} onClick={onEnter}>Enter Velvet <ArrowRight size={17} /></button>
        <p className="age-footnote">By continuing, you agree to follow our community standards. <a href="https://shakespeare.diy" target="_blank" rel="noreferrer">Learn more</a></p>
        <div className="age-footer"><span>Independent by nature.</span><span>Powered by Nostr <span className="purple-dot">●</span></span></div>
      </div>
    </main>
  );
}

function PostCard({ event, onLike, canLike }: { event: NostrEvent; onLike: (event: NostrEvent) => void; canLike: boolean }) {
  const displayName = `${event.pubkey.slice(0, 6)}…${event.pubkey.slice(-4)}`;
  const eventLink = `/${nip19.neventEncode({ id: event.id, author: event.pubkey, kind: event.kind })}`;
  return (
    <article className="post-card">
      <div className="post-author-row">
        <div className="avatar avatar-purple">{displayName.slice(0, 1).toUpperCase()}</div>
        <div className="post-author"><strong>{displayName}</strong><span>@{displayName.toLowerCase()} · {timeAgo(event.created_at)}</span></div>
        <button className="icon-button post-more" aria-label="More post options"><MoreHorizontal size={19} /></button>
      </div>
      <p className="post-content">{event.content}</p>
      <div className="post-tags">{event.tags.filter(([name]) => name === 't').slice(0, 3).map(([, tag]) => <span key={tag}>#{tag}</span>)}</div>
      <div className="post-actions">
        <button className="post-action" onClick={() => onLike(event)} aria-label="Like post" disabled={!canLike}><Heart size={17} /></button>
        <a className="post-action" href={eventLink} aria-label="Open post to reply"><MessageCircle size={17} /></a>
        <a className="post-action post-event-link" href={eventLink} aria-label="Open post"><ArrowDownRight size={18} /></a>
      </div>
    </article>
  );
}

const Index = () => {
  useSeoMeta({ title: 'Velvet — a creator-first Nostr community', description: 'A more human corner of the internet for adult creators, performers, and the people who support them. Independent by nature, powered by Nostr.' });
  const [entered, setEntered] = useState(() => {
    try { return sessionStorage.getItem('velvet-age-confirmed') === 'yes'; } catch { return false; }
  });
  const [activeTopic, setActiveTopic] = useState(topics[0]);
  const [search, setSearch] = useState('');
  const [draft, setDraft] = useState('');
  const [mobileNav, setMobileNav] = useState(false);
  const { nostr } = useNostr();
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publish, isPending, error } = useNostrPublish();
  const { mutateAsync: reactToEvent } = useNostrPublish();
  const feedTagGroups = [
    ...(activeTopic === 'For you' || activeTopic === 'Creator notes' ? [['adultcreator', 'nsfwcreator', 'adultcontentcreator']] : []),
    ...(activeTopic === 'For you' || activeTopic === 'Industry talk' ? [['adultindustry', 'adultentertainment', 'sexwork', 'sexworker']] : []),
    ...(activeTopic === 'Work & wellness' ? [['creatorwellness', 'creatorlife']] : []),
  ];
  const feed = useQuery({
    queryKey: ['velvet-creator-feed', activeTopic],
    queryFn: async ({ signal }) => nostr.query(feedTagGroups.map((tags) => ({ kinds: [1], '#t': tags, limit: 25 })), { signal }),
    enabled: entered,
    retry: 1,
  });
  const posts = (feed.data ?? []).filter((event, index, events) => event.kind === 1 && events.findIndex((item) => item.id === event.id) === index && (!search || event.content.toLowerCase().includes(search.toLowerCase()))).sort((a, b) => b.created_at - a.created_at).slice(0, 15);
  const likePost = async (event: NostrEvent) => {
    if (!user) return;
    try {
      await reactToEvent({ kind: 7, content: '+', tags: [['e', event.id], ['p', event.pubkey], ['k', String(event.kind)]] });
      await queryClient.invalidateQueries({ queryKey: ['velvet-creator-feed'] });
    } catch {
      // The publish hook reports relay errors; keep the timeline available.
    }
  };

  const enter = () => {
    try { sessionStorage.setItem('velvet-age-confirmed', 'yes'); } catch { /* Session storage may be unavailable. */ }
    setEntered(true);
  };

  const submitPost = async () => {
    if (!draft.trim() || !user) return;
    try {
      await publish({ kind: 1, content: draft.trim(), tags: [['t', 'adultcreator'], ['t', 'adultindustry']] });
      setDraft('');
      await queryClient.invalidateQueries({ queryKey: ['velvet-creator-feed'] });
    } catch {
      // The publish hook reports relay errors; keep the draft available for retry.
    }
  };

  if (!entered) return <AgeGate onEnter={enter} />;

  return (
    <div className="velvet-app">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
        <a href="/" className="brand-lockup"><span className="brand-mark">v.</span><span>velvet<span className="brand-dot">.</span></span></a>
        <div className="top-search"><Search size={17} /><input aria-label="Search Velvet" placeholder="Search creators, conversations…" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>
        <div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button><LoginArea className="login-area" /></div>
      </header>

      <div className="app-layout">
        <aside className={`left-sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
          <nav className="main-nav" aria-label="Main navigation">
            <a href="#feed" className="nav-link nav-active" onClick={() => setMobileNav(false)}><Compass size={18} /> Home <span className="nav-indicator" /></a>
            <a href="#discover" className="nav-link" onClick={() => { setActiveTopic('Creator notes'); setMobileNav(false); }}><Sparkles size={18} /> Discover</a>
            <a href="#community" className="nav-link" onClick={() => setMobileNav(false)}><Users size={18} /> Community</a>
          </nav>
          <div className="sidebar-divider" />
          <div className="sidebar-label">YOUR SPACE <button className="icon-button tiny" aria-label="Add a list"><span>+</span></button></div>
          <a href="#compose" className="nav-link" onClick={() => setMobileNav(false)}><Wallet size={18} /> Creator tools</a>
          <a href="#safety" className="nav-link" onClick={() => setMobileNav(false)}><ShieldCheck size={18} /> Safety & privacy</a>
          <div className="sidebar-promo" id="creator-tools"><div className="promo-icon"><LockKeyhole size={17} /></div><h3>Your work. Your keys.</h3><p>Build your audience without asking a platform for permission.</p><span>HOW NOSTR WORKS <ArrowRight size={13} /></span></div>
          <div className="sidebar-bottom"><a href="#safety"><CircleHelp size={16} /> Community guidelines</a><a href="https://shakespeare.diy" target="_blank" rel="noreferrer">Vibed with Shakespeare</a><span>© 2026 Velvet · Built on Nostr</span></div>
        </aside>

        <main className="main-column" id="feed">
          <section className="welcome-banner">
            <div className="banner-copy"><div className="banner-kicker"><span className="live-dot" /> A NEW KIND OF CREATOR SPACE</div><h1>Your work.<br /><em>Your people.</em></h1><p>A creator-first community where adult industry voices can connect, share, and grow on their own terms.</p><a href="#community" className="banner-link">Find your people <ArrowRight size={16} /></a></div>
            <div className="banner-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-glow" /><div className="art-letter">v</div><div className="art-caption">INDEPENDENT<br />BY NATURE</div><div className="art-stamp">18+ <span>✳</span></div></div>
            <div className="banner-bottom"><span><LockKeyhole size={13} /> YOU CONTROL YOUR IDENTITY</span><span>OPEN PROTOCOL <span className="purple-dot">●</span></span></div>
          </section>

          <section className="topic-row" aria-label="Feed topics">{topics.map((topic) => <button key={topic} className={`topic-pill ${activeTopic === topic ? 'topic-selected' : ''}`} onClick={() => { setActiveTopic(topic); setMobileNav(false); }}>{topic}</button>)}</section>

          <section className="compose-card" aria-label="Write a post" id="compose">
            <div className="compose-avatar">{user ? <span>{user.pubkey.slice(0, 1).toUpperCase()}</span> : <Sparkles size={19} />}</div>
            <div className="compose-body"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={user ? 'What’s on your mind? Share with the community…' : 'Join the conversation. Connect your Nostr account to post.'} aria-label="Write a community post" maxLength={2000} /><div className="compose-footer"><span><LockKeyhole size={13} /> Public post · visible to connected relays</span><button className="primary-button post-button" disabled={!draft.trim() || !user || isPending} onClick={() => void submitPost()}>{isPending ? 'Posting…' : 'Post'} <ArrowRight size={15} /></button></div>{error && <p className="error-message">Could not publish right now. Check your relay connection and try again.</p>}</div>
          </section>

          <div className="feed-heading"><div><span className="eyebrow">THE CONVERSATION</span><h2>{activeTopic === 'For you' ? 'Latest from the community' : activeTopic}</h2></div><button className="sort-button">Latest <ChevronDown size={15} /></button></div>
          {feed.isPending ? <div className="feed-loading"><div className="skeleton-avatar" /><div className="skeleton-lines"><i /><i /><i /></div></div> : posts.length > 0 ? <div className="post-list">{posts.map((event) => <PostCard key={event.id} event={event} canLike={Boolean(user)} onLike={(target) => void likePost(target)} />)}</div> : <div className="empty-feed"><div className="empty-icon"><Radio size={21} /></div><span className="eyebrow">YOUR NETWORK, YOUR FEED</span><h3>It’s quiet in here. For now.</h3><p>Choose Creator notes or Industry talk to explore public conversations, or share a thought with the community to get started.</p><button className="text-button" onClick={() => document.querySelector<HTMLTextAreaElement>('.compose-body textarea')?.focus()}>Write the first note <ArrowRight size={15} /></button></div>}
          <div className="feed-end"><span /> YOU’RE ALL CAUGHT UP <span /></div>
        </main>

        <aside className="right-sidebar">
          <section className="side-card community-card" id="community"><div className="side-card-title"><div><span className="eyebrow">A BETTER KIND OF SOCIAL</span><h3>Built for creators.</h3></div><ArrowDownRight size={19} /></div><p>Velvet brings independent adult creators together on an open, people-powered network.</p><div className="community-stat"><div className="stat-avatars"><span>A</span><span>J</span><span>M</span><span>+</span></div><span>Creators are finding their people</span></div><a href="#discover" className="side-link">Explore the community <ArrowRight size={14} /></a></section>
          <section className="side-card guide-card" id="safety"><div className="guide-heading"><div className="guide-symbol"><ShieldCheck size={17} /></div><span className="eyebrow">YOUR SAFETY MATTERS</span></div><h3>Good boundaries.<br />Better community.</h3><p>Learn about consent, privacy, and how to report content that crosses a line.</p><a href="#community" className="side-link">Read our guidelines <ArrowRight size={14} /></a></section>
          <section className="side-card trend-card"><div className="trends-head"><span className="eyebrow">CONVERSATIONS TO JOIN</span><button className="icon-button tiny" aria-label="More topics"><MoreHorizontal size={16} /></button></div><a href="#feed" className="trend-item"><span>CREATOR LIFE · TRENDING</span><strong>Building on your own terms</strong><small>Join a growing conversation</small></a><a href="#feed" className="trend-item"><span>INDUSTRY TALK · NEW</span><strong>Privacy that puts you first</strong><small>Explore the discussion</small></a><a href="#feed" className="side-link">See what’s happening <ArrowRight size={14} /></a></section>
          <footer className="right-footer"><a href="#community">About</a><a href="#safety">Privacy</a><a href="#safety">Guidelines</a><span>Independent by nature. <span className="purple-dot">●</span></span></footer>
        </aside>
      </div>
    </div>
  );
};

export default Index;
