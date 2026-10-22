import { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowDown, ArrowDownUp, ArrowRight, BookOpen, Check, ChevronDown,
  Clock3, FileText, LayoutDashboard, List, LockKeyhole, LogOut, Menu,
  MessageSquare, MoreHorizontal, Plus, Search, ShieldCheck, Sparkles, ThumbsUp,
  Trash2, Users, X,
} from 'lucide-react';

const getSession = () => {
  try { return JSON.parse(localStorage.getItem('daybook-session') || 'null'); } catch { return null; }
};

async function api(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error('Could not reach the server. Check your connection and try again.');
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

function shortDate(value) {
  if (!value) return 'Just now';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function Auth({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try { onLogin(await api('/login', { method: 'POST', body: JSON.stringify(form) })); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <main className="auth-page"><div className="auth-art"><a className="brand" href="#"><span className="brand-icon"><BookOpen size={19} /></span>daybook</a><div className="art-copy"><span className="overline"><Sparkles size={14} /> YOUR BLOG, IN GOOD HANDS</span><h1>Good stories<br />deserve a <em>home.</em></h1><p>A thoughtful workspace to publish, moderate, and keep your community close.</p><div className="art-post"><div className="art-meta">LATEST STORY <span>·</span> 4 MIN READ</div><h3>The quiet joy of starting again</h3><p>Somewhere between the first draft and the final sentence, something starts to feel like yours.</p><div className="art-author"><span className="author-avatar">A</span><span>By your community</span><span className="art-like"><ThumbsUp size={13} /> 24</span></div></div></div><div className="art-footer"><span>WORDS THAT BRING US CLOSER</span><span>✳ &nbsp; A SPACE TO SHARE</span></div></div><section className="auth-main"><div className="auth-mobile"><a className="brand" href="#"><span className="brand-icon"><BookOpen size={18} /></span>daybook</a></div><form className="auth-card" onSubmit={submit}><div className="auth-badge"><LockKeyhole size={18} /></div><span className="overline">YOUR EDITORIAL SPACE</span><h2>Welcome back</h2><p className="auth-sub">Sign in to manage your blog and community.</p><label>Email address<input type="email" autoComplete="username" placeholder="you@example.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label><label>Password<input type="password" autoComplete="current-password" placeholder="Your password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required /></label>{error && <div className="notice error">{error}</div>}<button className="primary full" disabled={busy}>{busy ? 'Signing in…' : 'Sign in to dashboard'}<ArrowRight size={16} /></button><div className="auth-safe"><ShieldCheck size={15} />Private, secure access for your account</div></form><footer className="auth-legal">A CONSIDERED SPACE FOR EVERY STORY <span>·</span> 2026</footer></section></main>;
}

function Modal({ title, initial = {}, fields, onClose, onSave, busy }) {
  const [values, setValues] = useState(initial);
  const [error, setError] = useState('');
  async function submit(e) { e.preventDefault(); setError(''); try { await onSave(values); } catch (err) { setError(err.message); } }
  return <div className="backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}><form className="modal" onSubmit={submit}><div className="modal-head"><div><span className="overline">YOUR EDITORIAL DESK</span><h2>{title}</h2></div><button type="button" className="icon-btn" onClick={onClose}><X size={18} /></button></div>{fields.map((field) => <label key={field.name}>{field.label}{field.multiline ? <textarea maxLength={field.max} rows={8} required value={values[field.name] || ''} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} placeholder={field.placeholder} /> : <input required maxLength={field.max} value={values[field.name] || ''} onChange={(e) => setValues({ ...values, [field.name]: e.target.value })} placeholder={field.placeholder} />}</label>)}{error && <div className="notice error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={busy}>{busy ? 'Saving…' : <><Check size={15} />Save changes</>}</button></div></form></div>;
}

function App() {
  const [session, setSession] = useState(getSession);
  const [section, setSection] = useState('Overview');
  const [data, setData] = useState({ posts: [], comments: [], users: [], reactions: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState('');
  const [mobileNav, setMobileNav] = useState(false);

  function setLogin(result) {
    const next = { token: result.token, user: result.user };
    localStorage.setItem('daybook-session', JSON.stringify(next)); setSession(next);
  }
  function logout() { localStorage.removeItem('daybook-session'); setSession(null); setData({ posts: [], comments: [], users: [], reactions: [] }); }

  async function load() {
    if (!session?.token) return;
    setLoading(true); setError('');
    try {
      const profile = await api('/profile', { token: session.token });
      const user = profile.user || session.user;
      if (user.role !== 'admin') {
        setData({ posts: [], comments: [], users: [], reactions: [] });
        setError('This dashboard is for administrators. Sign in with an admin account to manage the blog.');
        return;
      }
      const [posts, comments, users, reactions] = await Promise.all([
        api('/posts'), api('/comments'), api('/users', { token: session.token }), api('/reactions', { token: session.token }),
      ]);
      setData({ posts: posts.posts || [], comments: comments.comments || [], users: users.users || [], reactions: reactions.reactions || [] });
      const updated = { ...session, user };
      localStorage.setItem('daybook-session', JSON.stringify(updated)); setSession(updated);
    } catch (err) {
      setError(err.message);
      if (/token|required|expired|invalid/i.test(err.message)) logout();
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [session?.token]);
  useEffect(() => { if (!toast) return; const timer = setTimeout(() => setToast(''), 2600); return () => clearTimeout(timer); }, [toast]);

  async function mutate(path, method, body, success) {
    setBusy(true);
    try { await api(path, { method, token: session.token, ...(body ? { body: JSON.stringify(body) } : {}) }); setModal(null); await load(); setToast(success); }
    catch (err) { setToast(err.message); } finally { setBusy(false); }
  }
  async function remove(kind, item) {
    const label = kind === 'posts' ? item.title : kind === 'comments' ? 'this comment' : `${item.username}'s account`;
    if (!window.confirm(`Delete ${label}? This action cannot be undone.`)) return;
    const endpoint = kind === 'posts' ? `/posts/${item.id}` : kind === 'comments' ? `/comments/${item.id}` : `/users/${item.id}`;
    await mutate(endpoint, 'DELETE', null, 'Item deleted.');
  }

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return Object.fromEntries(Object.entries(data).map(([key, list]) => [key, list.filter((item) => JSON.stringify(item).toLowerCase().includes(term))]));
  }, [data, search]);
  if (!session?.token) return <Auth onLogin={setLogin} />;
  const nav = [
    { label: 'Overview', icon: LayoutDashboard }, { label: 'Posts', icon: FileText, count: data.posts.length },
    { label: 'Comments', icon: MessageSquare, count: data.comments.length }, { label: 'Users', icon: Users, count: data.users.length },
    { label: 'Reactions', icon: ThumbsUp, count: data.reactions.length },
  ];
  const activePosts = visible.posts;
  const activeComments = visible.comments;
  const activeUsers = visible.users;
  const activeReactions = visible.reactions;

  function postModal(post) {
    setModal({ title: post ? 'Edit story' : 'Write a story', initial: post || {}, fields: [
      { name: 'title', label: 'Title', placeholder: 'A title readers will remember', max: 200 },
      { name: 'content', label: 'Story', placeholder: 'Start with what you want to say…', multiline: true, max: 50000 },
    ], save: (values) => mutate(post ? `/posts/${post.id}` : '/posts', post ? 'PATCH' : 'POST', values, post ? 'Story updated.' : 'Story published.') });
  }

  function tableRows() {
    if (section === 'Posts') return <div className="records">{activePosts.map((post) => <article className="record post-record" key={post.id}><div className="record-main"><span className="record-type"><FileText size={14} /> STORY · {shortDate(post.created_at)}</span><h3>{post.title}</h3><p>{post.content}</p><span className="record-by">By {post.username || 'Community member'} · ID {post.id}</span></div><div className="record-actions"><button className="icon-btn" title="Edit story" onClick={() => postModal(post)}><MoreHorizontal size={18} /></button><button className="icon-btn danger" title="Delete story" onClick={() => remove('posts', post)}><Trash2 size={16} /></button></div></article>)}{!activePosts.length && <Empty label="No stories match this search." />}</div>;
    if (section === 'Comments') return <div className="records">{activeComments.map((comment) => <article className="record compact-record" key={comment.id}><span className="comment-mark"><MessageSquare size={16} /></span><div className="compact-body"><p>{comment.content}</p><span>By {comment.username} · Post #{comment.post_id} · {shortDate(comment.created_at)}</span></div><button className="icon-btn danger" title="Delete comment" onClick={() => remove('comments', comment)}><Trash2 size={16} /></button></article>)}{!activeComments.length && <Empty label="No comments match this search." />}</div>;
    if (section === 'Users') return <div className="table-wrap"><table><thead><tr><th>MEMBER</th><th>EMAIL</th><th>ROLE</th><th>JOINED</th><th /></tr></thead><tbody>{activeUsers.map((user) => <tr key={user.id}><td><span className="member"><span className="avatar">{user.username?.[0]?.toUpperCase()}</span><span>{user.username}<small>Account #{user.id}</small></span></span></td><td>{user.email}</td><td><span className={`role ${user.role}`}>{user.role}</span></td><td>{shortDate(user.created_at)}</td><td><button className="icon-btn danger" title="Delete user" onClick={() => remove('users', user)}><Trash2 size={15} /></button></td></tr>)}</tbody></table>{!activeUsers.length && <Empty label="No users match this search." />}</div>;
    if (section === 'Reactions') return <div className="table-wrap"><table><thead><tr><th>REACTION</th><th>MEMBER</th><th>STORY</th><th>DATE</th></tr></thead><tbody>{activeReactions.map((reaction) => <tr key={reaction.id}><td><span className={`reaction ${reaction.type}`}>{reaction.type === 'like' ? <ThumbsUp size={13} /> : <ArrowDown size={13} />}{reaction.type}</span></td><td>Member #{reaction.user_id}</td><td>Story #{reaction.post_id}</td><td>{shortDate(reaction.created_at)}</td></tr>)}</tbody></table>{!activeReactions.length && <Empty label="No reactions match this search." />}</div>;
    return <div className="records">{activePosts.slice(0, 5).map((post) => <article className="record post-record" key={post.id}><div className="record-main"><span className="record-type"><FileText size={14} /> STORY · {shortDate(post.created_at)}</span><h3>{post.title}</h3><p>{post.content}</p><span className="record-by">By {post.username || 'Community member'}</span></div><div className="record-actions"><button className="icon-btn" title="Edit story" onClick={() => postModal(post)}><MoreHorizontal size={18} /></button><button className="icon-btn danger" title="Delete story" onClick={() => remove('posts', post)}><Trash2 size={16} /></button></div></article>)}{!activePosts.length && <Empty label="No stories yet. Publish your first one." />}</div>;
  }

  return <div className="dashboard"><aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}><div className="side-brand"><a className="brand" href="#"><span className="brand-icon"><BookOpen size={18} /></span>daybook</a><span className="workspace-tag">EDITORIAL</span></div><button className="primary compose" onClick={() => postModal(null)}><Plus size={17} />Write a story<span className="shortcut">⌘ N</span></button><span className="nav-heading">WORKSPACE</span><nav>{nav.map(({ label, icon: Icon, count }) => <button key={label} className={`nav-link ${section === label ? 'selected' : ''}`} onClick={() => { setSection(label); setMobileNav(false); }}><Icon size={17} /><span>{label}</span>{count !== undefined && <small>{count}</small>}</button>)}</nav><div className="sidebar-bottom"><div className="side-tip"><Sparkles size={16} /><div><strong>Good work takes time.</strong><p>Your next great story is only a draft away.</p></div></div><div className="profile-card"><span className="avatar avatar-large">{session.user?.username?.[0]?.toUpperCase() || 'A'}</span><div className="profile-copy"><strong>{session.user?.username || 'Editor'}</strong><small>{session.user?.email}</small><span className="admin-tag"><ShieldCheck size={11} /> ADMIN</span></div><button className="icon-btn" onClick={logout} title="Sign out"><LogOut size={16} /></button></div></div></aside>{mobileNav && <button className="scrim" onClick={() => setMobileNav(false)} aria-label="Close menu" />}
    <main className="main"><header className="topbar"><div className="crumb"><button className="mobile-menu icon-btn" onClick={() => setMobileNav(true)}><Menu size={19} /></button><span>Workspace</span><b>/</b><strong>{section}</strong></div><div className="top-actions"><span className="live"><i /> ALL SYSTEMS NORMAL</span><button className="icon-btn" onClick={load} title="Refresh"><Activity size={17} /></button></div></header><div className="page-content"><section className="welcome"><div><span className="overline"><Clock3 size={14} /> YOUR EDITORIAL DESK</span><h1>{section === 'Overview' ? <>A good day to<br /><em>tell a story.</em></> : <>{section}<br /><em>and community.</em></>}</h1><p>Here’s what’s happening in your corner of the internet.</p></div><button className="primary welcome-button" onClick={() => postModal(null)}><Plus size={16} />Write a story</button></section>
      <section className="stats">{[{ label: 'PUBLISHED STORIES', value: data.posts.length, icon: FileText, color: 'sage' }, { label: 'COMMUNITY NOTES', value: data.comments.length, icon: MessageSquare, color: 'sand' }, { label: 'MEMBERS', value: data.users.length, icon: Users, color: 'lilac' }, { label: 'REACTIONS', value: data.reactions.length, icon: ThumbsUp, color: 'blue' }].map(({ label, value, icon: Icon, color }) => <div className="stat-card" key={label}><span className={`stat-icon ${color}`}><Icon size={17} /></span><div><span>{label}</span><strong>{value.toString().padStart(2, '0')}</strong></div><span className="stat-mark">↗</span></div>)}</section>
      <section className="manage"><div className="manage-head"><div><span className="overline">YOUR CONTENT, AT A GLANCE</span><h2>{section === 'Overview' ? 'Recent stories' : section}<span className="total">{section === 'Comments' ? data.comments.length : section === 'Users' ? data.users.length : section === 'Reactions' ? data.reactions.length : data.posts.length}</span></h2><p>Keep the conversation moving.</p></div><div className="list-tools"><label className="search"><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search your workspace…" /><kbd>⌘ K</kbd></label><button className="filter-btn" onClick={() => setSearch('')}><ArrowDownUp size={15} /> Clear</button></div></div>
      {error && <div className="notice error"><span>{error}</span><button onClick={load}>Try again</button></div>}{loading ? <div className="loading"><span className="spinner" />Gathering your workspace…</div> : tableRows()}{section === 'Overview' && <div className="view-all"><span>SHOWING {Math.min(activePosts.length, 5)} OF {data.posts.length} STORIES</span><button onClick={() => setSection('Posts')}>VIEW ALL STORIES <ArrowRight size={13} /></button></div>}</section><footer className="page-footer"><span>MADE FOR THE STORIES THAT MATTER.</span><span>DAYBOOK EDITORIAL <span className="star">✳</span></span></footer></div></main>
    {modal && <Modal title={modal.title} initial={modal.initial} fields={modal.fields} busy={busy} onClose={() => setModal(null)} onSave={modal.save} />}{toast && <div className="toast"><Check size={15} />{toast}<button className="icon-btn" onClick={() => setToast('')}><X size={15} /></button></div>}
  </div>;
}

function Empty({ label }) { return <div className="empty"><span><FileText size={21} /></span><p>{label}</p></div>; }

export default App;
