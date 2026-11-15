import { useEffect, useRef, useState } from 'react';
import { useSeoMeta } from '@unhead/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';
import type { NostrEvent, NostrMetadata } from '@nostrify/nostrify';
import {
  ArrowDownRight, ArrowRight, Bell, Check, ChevronDown, CircleHelp,
  Compass, Copy, Heart, ImagePlus, Link2, LockKeyhole, Menu, MessageCircle, Moon, MoreHorizontal, Radio,
  Search, ShieldCheck, Sparkles, Sun, Upload, Users, Wallet, X,
} from 'lucide-react';
import { LoginArea } from '@/components/auth/LoginArea';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useNostrPublish } from '@/hooks/useNostrPublish';
import { useUploadFile } from '@/hooks/useUploadFile';
import { useTheme } from '@/hooks/useTheme';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { nip19 } from 'nostr-tools';

const topics = ['For you', 'Creator notes', 'Industry talk', 'Work & wellness'];
const timeAgo = (timestamp: number) => {
  const minutes = Math.max(1, Math.floor((Date.now() / 1000 - timestamp) / 60));
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return `${Math.floor(minutes / 1440)}d`;
};

function VelvetThemeToggle({ theme, setTheme }: { theme: string; setTheme: (theme: 'light' | 'dark') => void }) {
  const dark = theme === 'dark';
  return <button className="icon-button theme-toggle" aria-label={`Switch to ${dark ? 'light' : 'dark'} mode`} title={`Switch to ${dark ? 'light' : 'dark'} mode`} onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? <Sun size={18} /> : <Moon size={18} />}</button>;
}

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
  const { user, metadata } = useCurrentUser();
  const queryClient = useQueryClient();
  const { mutateAsync: publish, isPending, error } = useNostrPublish();
  const { mutateAsync: reactToEvent } = useNostrPublish();
  const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();
  const [attachments, setAttachments] = useState<Array<{ url: string; tags: string[][] }>>([]);
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [profileDraft, setProfileDraft] = useState({ name: '', about: '', website: '', picture: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const [uploadMessage, setUploadMessage] = useState('');
  const profileFileInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { theme, setTheme } = useTheme();
  const currentProfileName = metadata?.display_name || metadata?.name || '';
  useEffect(() => {
    setProfileDraft({ name: metadata?.name ?? '', about: metadata?.about ?? '', website: metadata?.website ?? '', picture: metadata?.picture ?? '' });
  }, [metadata]);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme !== 'dark');
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }, [theme]);
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

  const addAttachment = async (file: File) => {
    if (!user) return;
    setUploadMessage('');
    try {
      const tags = await uploadFile(file);
      const url = tags.find(([name]) => name === 'url')?.[1];
      if (!url) throw new Error('Upload did not return a media URL');
      setAttachments((current) => [...current, { url, tags }]);
    } catch {
      setUploadMessage('Upload didn’t finish. Check your Blossom server settings and try again.');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const submitPost = async () => {
    if ((!draft.trim() && attachments.length === 0) || !user) return;
    try {
      const mediaText = attachments.map(({ url }) => url).join('\n');
      const imetaTags = attachments.map(({ tags }) => ['imeta', ...tags.map(([name, value]) => `${name} ${value}`)]);
      await publish({ kind: 1, content: [draft.trim(), mediaText].filter(Boolean).join('\n\n'), tags: [['t', 'adultcreator'], ['t', 'adultindustry'], ...imetaTags] });
      setDraft('');
      setAttachments([]);
      await queryClient.invalidateQueries({ queryKey: ['velvet-creator-feed'] });
    } catch {
      // The publish hook reports relay errors; keep the draft and attachments available for retry.
    }
  };

  const shareProfile = async () => {
    if (!user) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/${nip19.npubEncode(user.pubkey)}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      setProfileMessage('Could not copy automatically. Copy your profile link from the address bar.');
    }
  };

  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    setProfileMessage('');
    try {
      const next: NostrMetadata = { ...(metadata ?? {}), ...profileDraft };
      for (const key of Object.keys(next) as Array<keyof NostrMetadata>) {
        if (next[key] === '') delete next[key];
      }
      await publish({ kind: 0, content: JSON.stringify(next) });
      await queryClient.invalidateQueries({ queryKey: ['nostr', 'author', user.pubkey] });
      await queryClient.invalidateQueries({ queryKey: ['logins'] });
      setCreatorOpen(false);
    } catch {
      setProfileMessage('Profile update didn’t publish. Check your relay connection and try again.');
    } finally {
      setProfileSaving(false);
    }
  };

  if (!entered) return <AgeGate onEnter={enter} />;

  return (
    <div className="velvet-app">
      <header className="topbar">
        <button className="icon-button mobile-menu" aria-label="Open menu" onClick={() => setMobileNav(!mobileNav)}>{mobileNav ? <X size={20} /> : <Menu size={20} />}</button>
        <a href="/" className="brand-lockup"><span className="brand-mark">v.</span><span>velvet<span className="brand-dot">.</span></span></a>
        <div className="top-search"><Search size={17} /><input aria-label="Search Velvet" placeholder="Search creators, conversations…" value={search} onChange={(event) => setSearch(event.target.value)} /><kbd>⌘ K</kbd></div>
        <div className="top-actions"><VelvetThemeToggle theme={theme} setTheme={setTheme} /><button className="icon-button" aria-label="Notifications"><Bell size={19} /><i /></button><LoginArea className="login-area" /></div>
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
          <button className="nav-link nav-button" onClick={() => { setCreatorOpen(true); setMobileNav(false); }}><Wallet size={18} /> Creator tools <ArrowRight className="nav-trailing" size={14} /></button>
          <a href="#safety" className="nav-link" onClick={() => setMobileNav(false)}><ShieldCheck size={18} /> Safety & privacy</a>
          <div className="sidebar-promo" id="creator-tools"><div className="promo-icon"><LockKeyhole size={17} /></div><h3>Your work. Your keys.</h3><p>Public by default—share thoughtfully and keep control of your identity.</p><button className="promo-action" onClick={() => setCreatorOpen(true)}>OPEN CREATOR TOOLS <ArrowRight size={13} /></button></div>
          <div className="sidebar-bottom"><a href="#safety"><CircleHelp size={16} /> Community guidelines</a><a href="https://shakespeare.diy" target="_blank" rel="noreferrer">Vibed with Shakespeare</a><span>© 2026 Velvet · Built on Nostr</span></div>
        </aside>

        <main className="main-column" id="feed">
          <section className="welcome-banner" id="discover">
            <div className="banner-copy"><div className="banner-kicker"><span className="live-dot" /> A NEW KIND OF CREATOR SPACE</div><h1>Your work.<br /><em>Your people.</em></h1><p>A creator-first community where adult industry voices can connect, share, and grow on their own terms.</p><a href="#community" className="banner-link">Find your people <ArrowRight size={16} /></a></div>
            <div className="banner-art" aria-hidden="true"><div className="art-orbit orbit-one" /><div className="art-orbit orbit-two" /><div className="art-glow" /><div className="art-letter">v</div><div className="art-caption">INDEPENDENT<br />BY NATURE</div><div className="art-stamp">18+ <span>✳</span></div></div>
            <div className="banner-bottom"><span><LockKeyhole size={13} /> YOU CONTROL YOUR IDENTITY</span><span>OPEN PROTOCOL <span className="purple-dot">●</span></span></div>
          </section>

          <section className="topic-row" aria-label="Feed topics">{topics.map((topic) => <button key={topic} className={`topic-pill ${activeTopic === topic ? 'topic-selected' : ''}`} onClick={() => { setActiveTopic(topic); setMobileNav(false); }}>{topic}</button>)}</section>

          <section className="compose-card" aria-label="Write a post" id="compose">
            <div className="compose-avatar">{user ? <span>{user.pubkey.slice(0, 1).toUpperCase()}</span> : <Sparkles size={19} />}</div>
            <div className="compose-body"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={user ? 'What’s on your mind? Share with the community…' : 'Join the conversation. Connect your Nostr account to post.'} aria-label="Write a community post" maxLength={2000} /><input ref={fileInputRef} className="visually-hidden" type="file" accept="image/*,video/*" aria-label="Choose post media" onChange={(event) => { const file = event.target.files?.[0]; if (file) void addAttachment(file); }} />{attachments.length > 0 && <div className="attachment-list">{attachments.map(({ url }, index) => <div className="attachment-chip" key={url}><ImagePlus size={14} /><span>Media {index + 1} attached</span><button aria-label={`Remove media ${index + 1}`} onClick={() => setAttachments((current) => current.filter((item) => item.url !== url))}><X size={14} /></button></div>)}</div>}{uploadMessage && <p className="error-message">{uploadMessage}</p>}<div className="compose-footer"><span><LockKeyhole size={13} /> Public post · visible to connected relays</span><div className="compose-actions"><button className="icon-button attach-button" aria-label="Attach media" title={user ? 'Upload image or video' : 'Connect a Nostr account to upload media'} disabled={!user || isUploading} onClick={() => fileInputRef.current?.click()}>{isUploading ? <Upload className="spin" size={17} /> : <ImagePlus size={18} />}</button><button className="primary-button post-button" disabled={(!draft.trim() && attachments.length === 0) || !user || isPending || isUploading} onClick={() => void submitPost()}>{isPending ? 'Posting…' : 'Post'} <ArrowRight size={15} /></button></div></div>{error && <p className="error-message">Could not publish right now. Check your relay connection and try again.</p>}</div>
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
      <Dialog open={creatorOpen} onOpenChange={setCreatorOpen}>
        <DialogContent className="creator-dialog" showCloseButton={false} aria-describedby="creator-tools-description">
          <DialogTitle className="visually-hidden">Creator tools</DialogTitle>
          <DialogDescription className="visually-hidden">Profile management, media posting, public sharing, and safety tips.</DialogDescription>
          <section className="creator-panel">
            <div className="creator-panel-header"><div><span className="eyebrow">YOUR CREATOR SPACE</span><h2 id="creator-tools-title">Creator tools</h2><p id="creator-tools-description">Manage your profile, share your identity, and post safely.</p></div><button className="icon-button" onClick={() => setCreatorOpen(false)} aria-label="Close creator tools"><X size={19} /></button></div>
            {user ? <>
              <div className="creator-profile-preview"><div className="creator-profile-avatar">{metadata?.picture?.startsWith('https://') ? <img src={metadata.picture} alt="" /> : (currentProfileName || user.pubkey.slice(0, 1)).slice(0, 1).toUpperCase()}</div><div className="creator-profile-meta"><strong>{currentProfileName || 'Set up your creator profile'}</strong><span>nostr:{nip19.npubEncode(user.pubkey).slice(0, 19)}…</span></div><button className="icon-button" onClick={() => void shareProfile()} aria-label="Copy your profile link" title="Copy profile link">{copied ? <Check size={17} /> : <Copy size={17} />}</button></div>
              {copied && <p className="success-message">Profile link copied. Share it anywhere.</p>}
              <div className="creator-form"><label>Display name<input value={profileDraft.name} maxLength={50} onChange={(event) => setProfileDraft((current) => ({ ...current, name: event.target.value }))} placeholder="How people know you" /></label><label>About you<textarea value={profileDraft.about} maxLength={280} rows={3} onChange={(event) => setProfileDraft((current) => ({ ...current, about: event.target.value }))} placeholder="Your work, interests, and what you’re here for" /><small>{profileDraft.about.length}/280</small></label><label>Website or creator link<input type="url" value={profileDraft.website} onChange={(event) => setProfileDraft((current) => ({ ...current, website: event.target.value }))} placeholder="https://your-site.example" /></label><label>Profile photo URL<input type="url" value={profileDraft.picture} onChange={(event) => setProfileDraft((current) => ({ ...current, picture: event.target.value }))} placeholder="https://…" /></label><div className="profile-upload-row"><input ref={profileFileInputRef} className="visually-hidden" type="file" accept="image/*" aria-label="Upload profile photo" onChange={async (event) => { const file = event.target.files?.[0]; if (!file) return; try { const result = await uploadFile(file); const url = result.find(([name]) => name === 'url')?.[1]; if (url) setProfileDraft((current) => ({ ...current, picture: url })); setProfileMessage('Profile photo uploaded. Save profile to publish the change.'); } catch { setProfileMessage('Upload failed. Check your Blossom server settings.'); } finally { event.target.value = ''; } }} /><button className="secondary-button" disabled={isUploading} onClick={() => profileFileInputRef.current?.click()}><Upload size={15} /> {isUploading ? 'Uploading…' : 'Upload profile photo'}</button><span>Profile details are public on Nostr.</span></div><button className="primary-button save-profile-button" disabled={profileSaving || isUploading} onClick={() => void saveProfile()}>{profileSaving ? 'Saving…' : 'Save profile'} <ArrowRight size={15} /></button>{profileMessage && <p className="error-message">{profileMessage}</p>}</div>
              <div className="safety-reminder"><ShieldCheck size={18} /><div><strong>Share with care</strong><p>Notes and profile details are public on Nostr and may be copied or relayed. Only share media you have the rights and consent to publish.</p></div></div>
            </> : <div className="creator-login-prompt"><div className="empty-icon"><Wallet size={21} /></div><h3>Connect your Nostr account</h3><p>Sign in to set up your public creator profile, publish posts, and share your profile link.</p><LoginArea /></div>}
            {user && <div className="creator-share"><div><Link2 size={16} /><div><strong>Share your profile</strong><span>Let people find you across Nostr.</span></div></div><button className="secondary-button" onClick={() => void shareProfile()}>{copied ? <Check size={15} /> : <Copy size={15} />} {copied ? 'Copied' : 'Copy link'}</button></div>}
          </section>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
