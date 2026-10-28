import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  ArrowUpRight, ArrowRight, ArrowLeft, Search, Sparkles, X, Check, Clock,
  MapPin, Users, Heart, ChevronRight, LayoutGrid, SlidersHorizontal,
  Database, Server, Globe, Layers, GitBranch, BarChart3, RefreshCw, CheckCircle2, AlertCircle,
} from 'lucide-react';
import { api, useResource, dollars, number, daysLeft } from './api.js';
import { ProjectArt } from './art.jsx';
import './styles.css';

function App() {
  const [route, setRoute] = useState(location.hash.slice(1) || 'explore');
  const [notice, setNotice] = useState('');
  useEffect(() => {
    const change = () => { setRoute(location.hash.slice(1) || 'explore'); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 6000);
    return () => clearTimeout(timer);
  }, [notice]);
  const section = route.split('/')[0];
  return <>
    <div className="demo-banner"><span className="status-dot" /> BIG DREAMS. FAKE MONEY. <span className="banner-divider">/</span> A very real local demo <span className="checkpoint-badge">CHECKPOINT 02</span></div>
    <header className="site-header">
      <a className="brand" href="#explore" aria-label="Kickstopper home"><span className="brand-mark">✳</span>kickstopper<span className="brand-period">.</span></a>
      <nav aria-label="Main navigation">
        {[['explore', 'Discover'], ['funding', 'Funding desk'], ['analytics', 'Analytics'], ['architecture', 'Under the hood']].map(([id, label]) =>
          <a key={id} href={`#${id}`} className={section === id || (id === 'explore' && section === 'project') ? 'active' : ''}>{label}</a>)}
      </nav>
      <a className="profile" href="#funding"><span className="avatar">BH</span><span>Demo founder</span><ChevronRight size={14} /></a>
    </header>
    <main key={section}>
      {section === 'project' ? <ProjectPage id={route.split('/')[1]} notify={setNotice} /> :
        section === 'funding' ? <FundingPage notify={setNotice} /> :
          section === 'analytics' ? <AnalyticsPage /> :
            section === 'architecture' ? <ArchitecturePage notify={setNotice} /> : <ExplorePage />}
    </main>
    <footer><a className="brand footer-brand" href="#explore"><span className="brand-mark">✳</span>kickstopper.</a><p>For the ideas that probably should have stayed ideas.</p><span>All pledges and grants are simulated. Please invest responsibly. Elsewhere.</span></footer>
    {notice && <div className="toast" role="status"><CheckCircle2 size={20} />{notice}<button className="icon-button" aria-label="Dismiss notification" onClick={() => setNotice('')}><X size={16} /></button></div>}
  </>;
}

function ErrorBox({ message, retry }) {
  return <div className="error-box" role="alert"><AlertCircle size={20} /><span>{message}</span>{retry && <button className="button small secondary" onClick={retry}>Try again</button>}</div>;
}
function Loading() { return <div className="loading" role="status"><RefreshCw size={20} className="spin" /> Rounding up the questionable ideas...</div>; }
function Source({ children }) { return <span className="source"><span className="status-dot" />{children}</span>; }

function ExplorePage() {
  const [query, setQuery] = useState('');
  const [draft, setDraft] = useState('');
  const [category, setCategory] = useState('');
  const [match, setMatch] = useState('');
  const [showMatches, setShowMatches] = useState(false);
  const resource = useResource(match ? `/similar?query=${encodeURIComponent(match)}` : `/projects?q=${encodeURIComponent(query)}&category=${encodeURIComponent(category)}`);
  const presets = useResource('/semantic-queries');
  const categories = ['All projects', 'Technology', 'Food & Drink', 'Transportation', 'Design'];
  return <div className="page explore-page">
    <section className="hero">
      <div className="hero-copy">
        <div className="eyebrow"><span className="tiny-star">✳</span> FOR THE UNREASONABLY AMBITIOUS</div>
        <h1>Big ideas.<br />Questionable <span className="serif-word">judgment.</span></h1>
        <p>Back the next big thing. Or at least something<br className="desktop-break" /> you can tell your friends you backed.</p>
        <a className="button primary" href="#projects" onClick={event => { event.preventDefault(); document.getElementById('projects')?.scrollIntoView({ behavior: 'smooth' }); }}>Find your bad idea <ArrowUpRight size={18} /></a>
        <div className="hero-proof"><div className="mini-avatars"><span>AP</span><span>NL</span><span>OC</span><span>+1</span></div><span>Good people. <strong>Debatable investments.</strong></span></div>
      </div>
      <a className="hero-feature" href="#project/1" aria-label="Explore Honk, Uber for geese">
        <div className="feature-label"><span className="status-dot" /> THE FLOCK IS GROWING <ArrowUpRight size={17} /></div>
        <ProjectArt id={1} large />
        <div className="feature-caption"><div><span className="eyebrow">FEATURED BAD IDEA</span><h2>Honk<span>®</span></h2><p>The future of mobility has a temper.</p></div><span className="round-arrow"><ArrowUpRight size={24} /></span></div>
        <div className="feature-sticker"><Sparkles size={15} /> 100% goose-powered</div>
      </a>
    </section>
    <div className="value-strip"><span><Heart size={17} /> Independently questionable</span><span><Users size={17} /> Community-backed delusions</span><span><CheckCircle2 size={17} /> Absolutely no real money</span><span className="strip-note">Dream big. Due diligence optional.</span></div>
    <section id="projects" className="discovery-section">
      <div className="section-heading"><div><div className="eyebrow muted">THE NEXT BIG MAYBE</div><h2>Find something to believe in<span className="orange-dot">.</span></h2></div><span className="collection-note">A little vision. A lot of commitment.</span></div>
      <div className="discovery-controls">
        <form className="search-box" onSubmit={event => { event.preventDefault(); setMatch(''); setQuery(draft); }}>
          <Search size={19} /><input aria-label="Search projects" placeholder="Search ideas, dreams, red flags..." value={draft} onChange={event => setDraft(event.target.value)} />
          {draft && <button type="button" className="icon-button" aria-label="Clear search" onClick={() => { setDraft(''); setQuery(''); }}><X size={16} /></button>}
          <button className="search-submit" type="submit">Search <ArrowRight size={14} /></button>
        </form>
        <button className={`button secondary match-button ${showMatches ? 'selected' : ''}`} onClick={() => setShowMatches(!showMatches)} aria-expanded={showMatches}><Sparkles size={17} /> Find my kind of weird</button>
      </div>
      {showMatches && <div className="match-panel"><div><Sparkles size={20} /><div><strong>Similar energy. Different bad idea.</strong><p>Real vector search with prepared demo embeddings. No AI inference.</p></div></div>
        {presets.error && <ErrorBox message={presets.error} retry={presets.refresh} />}
        <div className="preset-list">{presets.data?.map(preset => <button key={preset.id} className={match === preset.id ? 'selected' : ''} onClick={() => { setMatch(preset.id); setQuery(''); setDraft(''); setCategory(''); }}>{preset.label}<ArrowUpRight size={14} /></button>)}</div>
      </div>}
      <div className="filter-row"><div className="category-tabs" aria-label="Project categories">{categories.map((label, i) => <button key={label} className={category === (i ? label : '') && !match ? 'selected' : ''} onClick={() => { setCategory(i ? label : ''); setMatch(''); }}>{i === 0 && <LayoutGrid size={14} />}{label}</button>)}</div><span className="curated"><SlidersHorizontal size={14} /> Curated chaos</span></div>
      {resource.error && <ErrorBox message={resource.error} retry={resource.refresh} />}
      {resource.loading ? <Loading /> : resource.data && <>
        {(query || match) && <div className="results-label"><span>{match ? 'Ideas with matching energy' : `Results for "${query}"`} · {resource.data.projects.length} projects</span><button onClick={() => { setQuery(''); setDraft(''); setMatch(''); }}>Clear results <X size={13} /></button></div>}
        <div className="project-grid">{resource.data.projects.map(project => <ProjectCard key={project.id} project={project} />)}</div>
        {!resource.data.projects.length && <div className="empty-state"><Search size={30} /><h3>No questionable ideas found.</h3><p>Try "bread", "agents", or a little less specificity.</p></div>}
        <div className="results-footer"><span>Every great company started with an idea. So did these.</span><Source>{resource.data.source}</Source></div>
      </>}
    </section>
    <section className="bottom-cta"><span className="cta-star">✳</span><div><h2>Some ideas change the world.<br />These are also ideas.</h2><p>A small platform. An unnecessarily large architecture.</p></div><a className="button primary" href="#architecture">See what it takes <ArrowUpRight size={18} /></a></section>
  </div>;
}

function ProjectCard({ project }) {
  const percent = Math.round(project.pledged_cents / project.goal_cents * 100);
  return <a className="project-card" href={`#project/${project.id}`}>
    <div className={`card-image ${project.color}`}><ProjectArt id={project.id} /><span className="category-tag">{project.category}</span>{project.status === 'expired' && <span className="ended-tag">Campaign ended</span>}</div>
    <div className="card-content"><div className="card-title"><h3>{project.name}</h3><ArrowUpRight size={19} /></div><p className="card-tagline">{project.tagline}</p><span className="founder">by {project.founder}</span>
      <div className="progress-track"><span style={{ width: `${Math.min(100, percent)}%` }} /></div>
      <div className="card-funding"><strong>{dollars(project.pledged_cents)} <span>pledged</span></strong><span>{percent}% funded</span></div>
      <div className="card-meta"><span><Users size={13} /> {number(project.backers_count)} backers</span><span><Clock size={13} /> {project.status === 'expired' ? 'Ended' : `${daysLeft(project.deadline)} days left`}</span></div>
      {project.similarity !== undefined && <span className="similarity"><Sparkles size={12} /> {Math.round(project.similarity * 100)}% similar energy</span>}
    </div>
  </a>;
}

function ProjectPage({ id, notify }) {
  const resource = useResource(`/projects/${encodeURIComponent(id)}`, 5000);
  const [backing, setBacking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const similar = useResource(`/similar?projectId=${encodeURIComponent(id)}`);
  async function requestFunding() {
    setBusy(true); setError('');
    try {
      await api(`/projects/${id}/funding`, { method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() }, body: '{}' });
      notify('Funding requested. The queue worker is on it.');
      location.hash = 'funding';
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  if (resource.loading) return <div className="page"><Loading /></div>;
  if (!resource.data) return <div className="page"><ErrorBox message={resource.error} retry={resource.refresh} /></div>;
  const project = resource.data;
  const percent = Math.round(project.pledged_cents / project.goal_cents * 100);
  const ended = project.status === 'expired' || daysLeft(project.deadline) === 0;
  return <div className="page detail-page">
    <a className="back-link" href="#explore"><ArrowLeft size={16} /> Back to questionable ideas</a>
    {resource.error && <ErrorBox message={resource.error} retry={resource.refresh} />}
    <div className="detail-top"><span className="pill">{project.category}</span><h1>{project.name}<span className="orange-dot">.</span></h1><p>{project.tagline}</p><span className="location"><MapPin size={15} />{project.location}<span>Created by <strong>{project.founder}</strong></span></span></div>
    <div className="detail-layout"><div><div className={`detail-art ${project.color}`}><ProjectArt id={project.id} large /></div><section className="story"><div className="eyebrow muted">THE PITCH</div><h2>It sounded good in the group chat.</h2><p>{project.description}</p><div className="founder-note"><span className="avatar">{project.founder.split(' ').map(part => part[0]).join('')}</span><div><strong>{project.founder}</strong><p>Founder, optimist, probably too far into this.</p></div></div></section></div>
      <aside className="pledge-panel"><div className="eyebrow muted">A LITTLE FAITH GOES A LONG WAY</div><h2>{dollars(project.pledged_cents)}</h2><p>pledged of {dollars(project.goal_cents)} goal</p><div className="progress-track"><span style={{ width: `${Math.min(percent, 100)}%` }} /></div><div className="pledge-stats"><div><strong>{number(project.backers_count)}</strong><span>believers</span></div><div><strong>{percent}%</strong><span>funded</span></div><div><strong>{daysLeft(project.deadline)}</strong><span>days to go</span></div></div>
        <button className="button primary full" disabled={ended} onClick={() => setBacking(true)}>{ended ? 'Campaign ended' : 'Back this questionable idea'}<ArrowUpRight size={18} /></button><p className="fine-print"><CheckCircle2 size={13} /> Fake money. Real emotional commitment.</p>
        <div className="reward"><span className="eyebrow muted">YOUR REWARD</span><p>{project.reward}</p></div>
        <div className="funding-callout"><GitBranch size={20} /><div><strong>On the other side of the table?</strong><p>Play founder and request a simulated matching grant.</p></div></div>
        <button className="button secondary full" disabled={busy || ended} onClick={requestFunding}>{busy ? 'Submitting...' : 'Request funding'}<ArrowRight size={16} /></button>
        {error && <ErrorBox message={error} />}
      </aside>
    </div>
    <section className="related"><div className="section-heading"><div><div className="eyebrow muted">SAME ENERGY</div><h2>You might also question these</h2></div><Source>Postgres + pgvector · cosine similarity</Source></div>{similar.error && <ErrorBox message={similar.error} retry={similar.refresh} />}<div className="project-grid related-grid">{similar.data?.projects.slice(0, 3).map(item => <ProjectCard key={item.id} project={item} />)}</div></section>
    {backing && <BackingDialog project={project} close={() => setBacking(false)} complete={message => { setBacking(false); resource.refresh(); notify(message); }} />}
  </div>;
}

function BackingDialog({ project, close, complete }) {
  const [amount, setAmount] = useState('25');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const key = useRef(crypto.randomUUID());
  const dialog = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current.showModal();
    return () => previous?.focus();
  }, []);
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const cents = Math.round(Number(amount) * 100);
      await api(`/projects/${project.id}/back`, { method: 'POST', headers: { 'Idempotency-Key': key.current }, body: JSON.stringify({ amount_cents: cents }) });
      complete(`You backed ${project.name} with ${dollars(cents)}. Your real wallet is safe.`);
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <dialog ref={dialog} className="backing-dialog" aria-labelledby="backing-title"
    onCancel={event => { if (busy) event.preventDefault(); else close(); }}
    onKeyDown={event => {
      if (event.key === 'Escape') { event.preventDefault(); if (!busy) close(); }
    }}>
    <button className="icon-button dialog-close" disabled={busy} onClick={close} aria-label="Close backing dialog"><X size={20} /></button><span className="dialog-icon"><Heart size={28} /></span>
    <div className="eyebrow muted">A LEAP OF QUESTIONABLE FAITH</div><h2 id="backing-title">You're backing {project.name}.</h2><p>Choose your commitment. This is a demo, so your accountant never has to know.</p>
    <form onSubmit={submit}><div className="amount-options">{[10, 25, 50, 100].map(value => <button disabled={busy} type="button" className={Number(amount) === value ? 'selected' : ''} key={value} onClick={() => setAmount(String(value))}>${value}</button>)}</div><label htmlFor="pledge-amount">Your pledge (fake USD)</label><div className="amount-input"><span>$</span><input id="pledge-amount" type="number" min="5" max="10000" step="0.01" required value={amount} disabled={busy} onChange={event => setAmount(event.target.value)} /></div>{error && <ErrorBox message={error} />}<button className="button primary full" disabled={busy}>{busy ? 'Making a questionable decision...' : `Pledge ${dollars(Math.round(Number(amount || 0) * 100))}`}<ArrowRight size={17} /></button></form>
    <p className="fine-print">No card. No charge. No refunds for your taste in startups.</p>
  </dialog>;
}

const statusLabels = { queued: 'In the queue', awaiting_approval: 'Needs a human', approval_queued: 'Recording decision', completed: 'Grant approved', rejected: 'Declined', ineligible: 'Not eligible' };
function FundingPage({ notify }) {
  const resource = useResource('/funding', 2000);
  const [selected, setSelected] = useState('');
  return <div className="page dashboard-page">
    <PageHeading eyebrow="THE BANK OF MAKE-BELIEVE" title="The funding desk." description="A serious process for some deeply unserious businesses." source="RabbitMQ + a visible Node worker" />
    <div className="info-strip"><GitBranch size={18} /><span>Check eligibility <ArrowRight size={13} /> Calculate fake risk <ArrowRight size={13} /> Wait for approval <ArrowRight size={13} /> Record a simulated grant</span></div>
    {resource.error && <ErrorBox message={resource.error} retry={resource.refresh} />}
    {resource.loading ? <Loading /> : !resource.data?.length ? <div className="empty-state panel"><GitBranch size={36} /><h2>No requests. Remarkable restraint.</h2><p>Open a project and select "Request funding" to send a real job through the queue.</p><a className="button primary" href="#project/1">Meet your first investment <ArrowUpRight size={18} /></a></div> :
      <div className="funding-layout"><div className="funding-list">{resource.data.map(funding => <button className={`funding-item panel ${selected === funding.id ? 'selected' : ''}`} key={funding.id} onClick={() => setSelected(funding.id)}><div className={`funding-thumbnail ${funding.color}`}><ProjectArt id={funding.project_id} /></div><div><h3>{funding.name}</h3><span className={`status-pill ${funding.status}`}>{statusLabels[funding.status]}</span><p>{funding.id.slice(0, 8)} · {new Date(funding.created_at).toLocaleTimeString()}</p></div><ChevronRight size={18} /></button>)}</div><FundingDetail id={selected || resource.data[0].id} notify={notify} refreshList={resource.refresh} /></div>}
    <p className="operational-note">The request and transactional outbox are saved in Postgres. RabbitMQ delivers work at least once; the worker guards state transitions against duplicates. This is not the later pg_durable demonstration.</p>
  </div>;
}

function FundingDetail({ id, notify, refreshList }) {
  const resource = useResource(`/funding/${id}`, 1500);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function decide(decision) {
    setBusy(true); setError('');
    try {
      await api(`/funding/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision }) });
      resource.refresh(); refreshList(); notify('Decision queued. The worker will finish the paperwork.');
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  const funding = resource.data;
  return <section className="workflow-panel panel"><div className="eyebrow muted">WORKFLOW RECEIPT</div><h2>A little oversight.</h2>{(error || resource.error) && <ErrorBox message={error || resource.error} retry={resource.refresh} />}
    {funding ? <><code className="instance-id">INSTANCE {funding.id}</code><div className="workflow-metrics"><div><span>Fake risk score</span><strong>{funding.risk_score ?? '…'}<small> / 100</small></strong></div><div><span>Simulated grant</span><strong>{dollars(funding.grant_cents)}</strong></div></div>
      <ol className="timeline">{funding.events.map((event, index) => <li key={`${event.created_at}-${index}`}><span className="timeline-dot"><Check size={12} /></span><div><p>{event.message}</p><time>{new Date(event.created_at).toLocaleTimeString()}</time></div></li>)}</ol>
      {funding.status === 'awaiting_approval' && <div className="decision-actions"><button className="button primary" disabled={busy} onClick={() => decide('approve')}>Approve fake grant <Check size={16} /></button><button className="button secondary" disabled={busy} onClick={() => decide('reject')}>Decline</button></div>}
      {funding.status === 'completed' && <div className="success-note"><CheckCircle2 size={18} /> Paperwork complete. No real money moved.</div>}
      <Source>Updates automatically · persistent request ID</Source>
    </> : <Loading />}
  </section>;
}

function PageHeading({ eyebrow, title, description, source }) {
  return <div className="page-heading"><div><div className="eyebrow muted">{eyebrow}</div><h1>{title}</h1><p>{description}</p></div>{source && <Source>{source}</Source>}</div>;
}

function AnalyticsPage() {
  const resource = useResource('/analytics', 5000);
  const totals = resource.data?.totals;
  return <div className="page dashboard-page">
    <PageHeading eyebrow="THE NUMBERS ARE REAL. THE MONEY IS NOT." title="Conviction, quantified." description="A clear-eyed look at our collective lapse in judgment." source="Queries served by ClickHouse" />
    {resource.error && <ErrorBox message={resource.error} retry={resource.refresh} />}
    {resource.loading ? <Loading /> : totals && <>
      <div className="metric-grid">{[['Total pledged', dollars(totals.pledged_cents), 'In entirely imaginary dollars', Heart], ['True believers', number(totals.backers), 'Each one made a choice', Users], ['Live experiments', number(Number(totals.projects) - Number(totals.expired)), `${totals.expired} expired by the scheduler`, Layers], ['Fully funded', number(totals.funded), 'Somehow, we did it', CheckCircle2]].map(([label, value, note, Icon]) => <div className="metric-card panel" key={label}><span>{label}<Icon size={18} /></span><strong>{value}</strong><small>{note}</small></div>)}</div>
      <div className="analytics-grid"><section className="chart-panel panel"><div className="panel-heading"><div><h2>The optimism index</h2><p>Daily fake pledges · last 14 days · UTC</p></div><span className="pill">PLEDGES / USD</span></div><PledgeChart daily={resource.data.daily} /></section>
        <section className="category-panel panel"><h2>Where the belief goes</h2><p>Pledges by category</p><div className="category-chart">{resource.data.categories.map((category, index) => <div key={category.category}><div><span><i className={`category-dot dot-${index}`} />{category.category}</span><strong>{dollars(category.pledged_cents)}</strong></div><div className="progress-track"><span className={`bar-${index}`} style={{ width: `${Number(category.pledged_cents) / Number(totals.pledged_cents) * 100}%` }} /></div></div>)}</div><div className="chart-footnote">Diversification is important.<br />We offer several different bad ideas.</div></section></div>
      <div className="results-footer"><span><Clock size={14} /> Last replicated {new Date(resource.data.refreshed_at).toLocaleTimeString()} · scheduler refreshes every 5 seconds</span><button className="text-button" onClick={resource.refresh}><RefreshCw size={14} /> Refresh dashboard</button></div>
      <div className="info-strip"><Database size={18} /><span>Postgres owns the transactions. A separate scheduler copies snapshots into the warehouse. These analytics are eventually consistent, not a second source of truth.</span></div>
    </>}
  </div>;
}

function PledgeChart({ daily }) {
  const dates = Array.from({ length: 14 }, (_, i) => {
    const day = new Date(); day.setUTCDate(day.getUTCDate() - 13 + i); return day.toISOString().slice(0, 10);
  });
  const lookup = new Map(daily.map(item => [item.day, Number(item.amount_cents)]));
  const values = dates.map(day => lookup.get(day) || 0);
  const max = Math.max(...values, 100);
  return <div className="bar-chart" role="img" aria-label={`Daily pledges over fourteen days. Total ${dollars(values.reduce((sum, value) => sum + value, 0))}.`}>
    <div className="chart-y-labels"><span>{dollars(max)}</span><span>{dollars(max / 2)}</span><span>$0</span></div><div className="chart-bars">{values.map((value, i) => <div className="chart-column" key={dates[i]}><div className="chart-bar-space"><div className={`chart-bar ${i === 13 ? 'today' : ''}`} style={{ height: `${Math.max(1, value / max * 100)}%` }} title={`${dates[i]}: ${dollars(value)}`} /></div><span>{new Date(`${dates[i]}T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span></div>)}</div>
  </div>;
}

const architectureNodes = [
  { id: 'frontend', title: 'Frontend host', subtitle: 'Nginx + locally built React', Icon: Globe, path: ['browse', 'search', 'vectors', 'back', 'funding', 'analytics'] },
  { id: 'api', title: 'Express API', subtitle: 'Handwritten routes · Node.js', Icon: Server, path: ['browse', 'search', 'vectors', 'back', 'funding', 'analytics'] },
  { id: 'queue', title: 'Queue + worker', subtitle: 'RabbitMQ + Node worker · 2 containers', Icon: GitBranch, path: ['funding'] },
  { id: 'scheduler', title: 'Scheduler', subtitle: 'Node · expiration, cache cleanup, warehouse sync', Icon: Clock, path: ['expiry', 'analytics'] },
  { id: 'warehouse', title: 'Analytics warehouse', subtitle: 'ClickHouse · replicated snapshots', Icon: BarChart3, path: ['analytics', 'expiry'] },
];

function ArchitecturePage({ notify }) {
  const [path, setPath] = useState('browse');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const projects = useResource('/projects', 5000);
  const paths = {
    browse: 'Browser → frontend → Express → Postgres: a 20-second UNLOGGED summary cache, regenerated on a miss.',
    search: 'Browser → frontend → Express → Postgres: full-text search with a GIN index, plus cached summaries.',
    vectors: 'Browser → frontend → Express → Postgres: pgvector cosine distance over the same prepared vectors, plus cached summaries.',
    back: 'Browser → frontend → Express → Postgres: backing transaction and a trigger that invalidates the summary cache.',
    funding: 'Browser → Express → Postgres request + outbox → worker → RabbitMQ → worker → Postgres. Human decisions use the same path.',
    analytics: 'Browser → frontend → Express → ClickHouse. The scheduler copies Postgres snapshots every five seconds.',
    expiry: 'Scheduler → Postgres: expire due unsuccessful campaigns, trigger cache invalidation, delete expired cache rows → refresh ClickHouse.',
  };
  async function expire() {
    setBusy(true); setError('');
    try {
      const result = await api('/demo/expire', { method: 'POST', body: '{}' });
      notify(result.message); setPath('expiry');
    } catch (failure) { setError(failure.message); } finally { setBusy(false); }
  }
  return <div className="page architecture-page">
    <PageHeading eyebrow="THE VILLAGE KEEPS SHRINKING." title="Vectors moved in, too." description="The same app. Five surrounding responsibilities. Seven containers." source="02 · Qdrant removed" />
    <div className="architecture-toolbar"><span className="eyebrow muted">FOLLOW A REQUEST</span><div>{[['browse', 'Browse'], ['search', 'Search'], ['vectors', 'Similar ideas'], ['back', 'Back'], ['funding', 'Funding'], ['analytics', 'Analytics'], ['expiry', 'Expiration']].map(([id, label]) => <button className={path === id ? 'selected' : ''} key={id} onClick={() => setPath(id)}>{label}</button>)}</div></div>
    <div className={`architecture-canvas path-${path}`}>
      <div className="architecture-services">{architectureNodes.map(({ id, title, subtitle, Icon, path: nodePaths }) => <div className={`architecture-node ${nodePaths.includes(path) ? 'highlighted' : ''}`} key={id}><span className="node-icon"><Icon size={21} /></span><div><strong>{title}</strong><span>{subtitle}</span></div>{nodePaths.includes(path) && <span className="node-active" />}</div>)}</div>
      <div className="diagram-connector"><span /><ArrowRight size={24} /><span /></div>
      <div className="postgres-node"><Database size={50} strokeWidth={1.3} /><span className="eyebrow">THE DATABASE, AND THEN SOME</span><h2>Postgres</h2><p>Projects. Backings.<br />Workflow state. Outbox.<br /><strong>Search. Cache.<br />Vectors.</strong></p><span className="postgres-version">17 · GIN + UNLOGGED + pgvector</span></div>
    </div>
    <div className="request-description" aria-live="polite"><ArrowRight size={20} /><p>{paths[path]}</p></div><p className="diagram-disclaimer">Scripted conceptual paths, not live telemetry. Highlighted boxes participate in the selected operation. Postgres remains the transactional source of truth; not every read reaches it.</p>
    <div className="architecture-bottom"><div className="panel"><h2>SHIP IT. For this workload.</h2><p>Postgres now owns search, the summary cache, and vector similarity. The same prepared vectors, no inference calls. Funding still runs through RabbitMQ and its worker. Analytics still queries ClickHouse.</p><p>Eight projects need an exact cosine scan, not an approximate index. Vector workloads now compete with transactions inside Postgres. The UNLOGGED cache is still disposable; the scheduler still owns cleanup.</p></div>
      <div className="panel demo-controls"><div className="eyebrow muted">REHEARSAL CONTROL</div><h2>Time is a distributed system.</h2><p>Move WalkBlock's deadline to now. The separate scheduler, not this button, expires the unsuccessful campaign.</p><button className="button secondary" onClick={expire} disabled={busy}>Make WalkBlock due <Clock size={16} /></button><span className="demo-state">Campaign state: <strong>{projects.data?.projects.find(project => project.id === 8)?.status ?? 'loading'}</strong></span>{(error || projects.error) && <ErrorBox message={error || projects.error} />}</div></div>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
