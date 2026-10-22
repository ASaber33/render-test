import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowDown, ArrowUp, BookOpen, Check, ChevronLeft, CircleUserRound, Heart, LogIn, LogOut, MessageCircle, PenLine, Plus, RefreshCw, Shield, Trash2, UserPlus, Users, X } from 'lucide-react';
import './style.css';

const API = import.meta.env.VITE_API_URL || '';
const SESSION_KEY = 'hekaya-session';
const date = value => value ? new Intl.DateTimeFormat('ar-EG', { dateStyle: 'medium' }).format(new Date(value)) : '';
const initialSession = () => { try { return JSON.parse(localStorage.getItem(SESSION_KEY) || 'null'); } catch { return null; } };

async function request(path, { token, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API}${path}`, { ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers } });
  } catch { throw new Error('تعذر الاتصال بالخادم. حاول مرة أخرى.'); }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `حدث خطأ (${response.status})`);
  return result;
}

function App() {
  const [session, setSession] = useState(initialSession);
  const [posts, setPosts] = useState([]);
  const [comments, setComments] = useState({});
  const [reactions, setReactions] = useState({});
  const [users, setUsers] = useState([]);
  const [allComments, setAllComments] = useState([]);
  const [allReactions, setAllReactions] = useState([]);
  const [view, setView] = useState('feed');
  const [authMode, setAuthMode] = useState('login');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const isAdmin = session?.user?.role === 'admin';

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const data = await request('/posts');
      setPosts(data.posts || []);
      const entries = await Promise.all((data.posts || []).map(async post => {
        const [commentData, reactionData] = await Promise.all([request(`/posts/${post.id}/comments`), request(`/posts/${post.id}/reactions`)]);
        return [post.id, commentData.comments || [], reactionData.reactions || []];
      }));
      setComments(Object.fromEntries(entries.map(([id, list]) => [id, list])));
      setReactions(Object.fromEntries(entries.map(([id, list]) => [id, list])));
      if (session?.token && isAdmin) {
        const [u, c, r] = await Promise.all([request('/users', { token: session.token }), request('/comments', { token: session.token }), request('/reactions', { token: session.token })]);
        setUsers(u.users || []); setAllComments(c.comments || []); setAllReactions(r.reactions || []);
      }
      setNotice('');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }, [session, isAdmin]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    if (!session?.token) return;
    request('/profile', { token: session.token }).then(data => {
      const next = { ...session, user: data.user };
      setSession(next); localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    }).catch(() => { localStorage.removeItem(SESSION_KEY); setSession(null); });
  // Verify a stored session once at app startup.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function authenticate(event) {
    event.preventDefault(); setBusy(true); setNotice('');
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    try {
      if (authMode === 'register') await request('/register', { method: 'POST', body: JSON.stringify(payload) });
      const result = await request('/login', { method: 'POST', body: JSON.stringify({ email: payload.email, password: payload.password }) });
      const next = { token: result.token, user: result.user };
      localStorage.setItem(SESSION_KEY, JSON.stringify(next)); setSession(next); setView('feed'); setNotice('تم تسجيل الدخول بنجاح.');
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function action(path, method, body, success = 'تم حفظ التغييرات.') {
    if (!session?.token) { setView('auth'); setNotice('سجل دخولك أولًا للمتابعة.'); return; }
    try { await request(path, { token: session.token, method, ...(body ? { body: JSON.stringify(body) } : {}) }); setNotice(success); await refresh(); }
    catch (error) { setNotice(error.message); }
  }

  async function submitPost(event) {
    event.preventDefault(); const formElement = event.currentTarget; const form = new FormData(formElement);
    await action('/posts', 'POST', { title: form.get('title'), content: form.get('content') }, 'تم نشر حكايتك.');
    formElement.reset();
  }

  const totals = useMemo(() => ({ posts: posts.length, comments: allComments.length || Object.values(comments).reduce((n, list) => n + list.length, 0), users: users.length, reactions: allReactions.length }), [posts, comments, allComments, users, allReactions]);
  const signOut = () => { localStorage.removeItem(SESSION_KEY); setSession(null); setView('feed'); setUsers([]); setNotice('تم تسجيل الخروج.'); };

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="#feed" onClick={() => setView('feed')}><span className="brand-mark"><BookOpen size={21}/></span><span>حكاية<small>مساحة للقصص</small></span></a>
      <nav className="main-nav"><button className={view === 'feed' ? 'active' : ''} onClick={() => setView('feed')}>القصص</button>{isAdmin && <><button className={view === 'admin' ? 'active' : ''} onClick={() => setView('admin')}>لوحة الإدارة</button><button className={view === 'users' ? 'active' : ''} onClick={() => setView('users')}>الأعضاء</button></>}</nav>
      <div className="account">{session ? <><span className="user-chip"><CircleUserRound size={18}/>{session.user.username}{isAdmin && <Shield size={14}/>}</span><button className="icon-button" onClick={signOut} title="تسجيل الخروج"><LogOut size={18}/></button></> : <button className="button button-dark button-small" onClick={() => { setView('auth'); setAuthMode('login'); }}><LogIn size={16}/> دخول</button>}</div>
    </header>

    {notice && <div className={`notice ${notice.includes('نجاح') || notice.includes('تم ') ? 'notice-ok' : ''}`}><span>{notice}</span><button onClick={() => setNotice('')} aria-label="إغلاق"><X size={16}/></button></div>}

    {view === 'auth' ? <main className="auth-layout"><section className="auth-intro"><span className="eyebrow">مجتمع يكتب ويقرأ</span><h1>كل حكاية<br/><em>تستحق أن تُروى.</em></h1><p>شارك أفكارك، اقرأ تجارب الآخرين، وابدأ حوارًا يستمر.</p><div className="intro-note"><BookOpen size={19}/> مساحة بسيطة للكلمات الصادقة.</div></section><form className="auth-card" onSubmit={authenticate}><span className="eyebrow">{authMode === 'login' ? 'أهلًا بعودتك' : 'انضم إلى الحكاية'}</span><h2>{authMode === 'login' ? 'سجّل دخولك' : 'أنشئ حسابك'}</h2><p>{authMode === 'login' ? 'تابع القراءة وشارك في الحوار.' : 'حسابك يتيح لك النشر والتعليق والتفاعل.'}</p>{authMode === 'register' && <label>اسم المستخدم<input name="username" required maxLength="100" autoComplete="username"/></label>}<label>البريد الإلكتروني<input type="email" name="email" required autoComplete="email"/></label><label>كلمة المرور<input type="password" name="password" required minLength="8" autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}/></label><button className="button button-dark button-wide" disabled={busy}>{busy ? 'لحظة واحدة…' : authMode === 'login' ? 'دخول' : 'إنشاء الحساب'}</button><button className="text-button" type="button" onClick={() => { setAuthMode(authMode === 'login' ? 'register' : 'login'); setNotice(''); }}>{authMode === 'login' ? 'ليس لديك حساب؟ أنشئ حسابًا' : 'لديك حساب؟ سجّل الدخول'}</button></form></main>
    : view === 'users' && isAdmin ? <main className="page admin-page"><div className="page-heading"><div><span className="eyebrow">إدارة المجتمع</span><h1>الأعضاء</h1><p>راجع الحسابات والأدوار وأدر صلاحيات الوصول.</p></div><button className="button button-light" onClick={refresh}><RefreshCw size={16}/> تحديث</button></div><section className="admin-table"><div className="table-head users-cols"><span>العضو</span><span>البريد الإلكتروني</span><span>الصلاحية</span><span>تاريخ الانضمام</span><span>إجراءات</span></div>{users.map(user => <div className="table-row users-cols" key={user.id}><strong>{user.username}</strong><span>{user.email}</span><select value={user.role} onChange={e => action(`/users/${user.id}/role`, 'PATCH', { role: e.target.value }, 'تم تحديث الصلاحية.')}><option value="user">عضو</option><option value="admin">مشرف</option></select><span>{date(user.created_at)}</span><button className="icon-button danger" title="حذف العضو" onClick={() => window.confirm(`حذف حساب ${user.username} وكل محتواه؟`) && action(`/users/${user.id}`, 'DELETE', null, 'تم حذف العضو ومحتواه.')}><Trash2 size={17}/></button></div>)}</section></main>
    : view === 'admin' && isAdmin ? <main className="page admin-page"><div className="page-heading"><div><span className="eyebrow">مساحة المشرف</span><h1>لوحة الإدارة</h1><p>نظرة على المحتوى والمجتمع وإجراءات الإشراف.</p></div><button className="button button-light" onClick={refresh}><RefreshCw size={16}/> تحديث</button></div><div className="stat-grid"><Stat icon={<BookOpen/>} label="المنشورات" value={totals.posts}/><Stat icon={<MessageCircle/>} label="التعليقات" value={totals.comments}/><Stat icon={<Users/>} label="الأعضاء" value={totals.users}/><Stat icon={<Heart/>} label="التفاعلات" value={totals.reactions}/></div><section className="admin-section"><div className="section-heading"><div><span className="eyebrow">إشراف المحتوى</span><h2>آخر التعليقات</h2></div><button className="text-button" onClick={() => setView('feed')}>عرض المنشورات <ChevronLeft size={16}/></button></div>{allComments.slice(0, 12).map(comment => <div className="moderation-row" key={comment.id}><div><strong>{comment.username}</strong><p>{comment.content}</p><small>على المنشور #{comment.post_id} · {date(comment.created_at)}</small></div><button className="icon-button danger" title="حذف التعليق" onClick={() => action(`/comments/${comment.id}`, 'DELETE', null, 'تم حذف التعليق.')}><Trash2 size={17}/></button></div>)}{allReactions.length > 0 && <><div className="section-heading subsection"><div><span className="eyebrow">التفاعلات</span><h2>إدارة التفاعلات</h2></div></div>{allReactions.slice(0, 12).map(reaction => <div className="moderation-row compact-row" key={reaction.id}><span>#{reaction.id} · عضو #{reaction.user_id} · منشور #{reaction.post_id}</span><select value={reaction.type} onChange={e => action(`/reactions/${reaction.id}`, 'PATCH', { type: e.target.value }, 'تم تحديث التفاعل.')}><option value="like">إعجاب</option><option value="dislike">عدم إعجاب</option></select><button className="icon-button danger" onClick={() => action(`/reactions/${reaction.id}`, 'DELETE', null, 'تم حذف التفاعل.')}><Trash2 size={17}/></button></div>)}</>}</section></main>
    : <main className="page feed-page"><section className="hero"><div className="hero-copy"><span className="eyebrow"><span className="eyebrow-dot"/> مجتمع يكتب من القلب</span><h1>مساحةٌ لك،<br/><em>ولكل حكاية.</em></h1><p>أفكار صغيرة، تجارب حقيقية، وحوارات تقرّبنا من بعض.</p><a className="hero-link" href="#stories" onClick={() => document.getElementById('stories')?.scrollIntoView({ behavior: 'smooth' })}>اكتشف القصص <ArrowDown size={16}/></a></div><div className="hero-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="sun-disc"><BookOpen size={49} strokeWidth={1.2}/></div><span className="art-star star-one">✳</span><span className="art-star star-two">✦</span><span className="art-word">اقرأ<br/>واكتب</span><span className="art-line"/></div></section>
      <section className="feed-layout" id="stories"><div className="stories-column"><div className="section-heading feed-heading"><div><span className="eyebrow">من المجتمع</span><h2>أحدث الحكايات <span className="count-pill">{posts.length}</span></h2></div><button className="icon-button" title="تحديث المنشورات" onClick={refresh}><RefreshCw size={17}/></button></div>{busy && posts.length === 0 ? <div className="empty-state">نحمّل الحكايات…</div> : posts.length === 0 ? <div className="empty-state">لا توجد منشورات حتى الآن. ابدأ أول حكاية!</div> : posts.map(post => <PostCard key={post.id} post={post} comments={comments[post.id] || []} reactions={reactions[post.id] || []} session={session} isAdmin={isAdmin} action={action} refresh={refresh}/>)}</div>
      <aside className="side-column"><div className="write-card"><div className="write-icon"><PenLine size={20}/></div><span className="eyebrow">مساحتك الخاصة</span><h3>{session ? `أهلًا ${session.user.username}` : 'لديك حكاية؟'}</h3><p>{session ? 'شارك فكرة أو تجربة مع مجتمع حكاية.' : 'سجّل دخولك لتكتب منشورًا وتشارك في الحوار.'}</p>{session ? <form onSubmit={submitPost}><input name="title" placeholder="عنوان الحكاية" required maxLength="200"/><textarea name="content" placeholder="ابدأ الكتابة هنا…" required maxLength="50000" rows="5"/><button className="button button-dark button-wide"><Plus size={17}/> نشر الحكاية</button></form> : <button className="button button-dark button-wide" onClick={() => { setView('auth'); setAuthMode('login'); }}><LogIn size={16}/> سجّل دخولك</button>}</div><div className="community-card"><div className="community-icon"><Users size={19}/></div><h3>الحكاية تكبر بنا</h3><p>اقرأ باحترام، شارك بصدق، واترك مساحة لكل صوت.</p><div className="community-rule"><Check size={15}/> كن لطيفًا في الحوار</div><div className="community-rule"><Check size={15}/> شارك ما يفيد الآخرين</div></div></aside></section><footer className="footer"><span>حكاية — مساحة للقصص التي تجمعنا</span><span>كُتبت لتُقرأ ✳</span></footer></main>}
  </div>;
}

function Stat({ icon, label, value }) { return <article className="stat-card"><span className="stat-icon">{icon}</span><span>{label}</span><strong>{value}</strong></article>; }

function PostCard({ post, comments, reactions, session, isAdmin, action, refresh }) {
  const [showComments, setShowComments] = useState(true);
  const [editing, setEditing] = useState(false);
  const [commentDraft, setCommentDraft] = useState('');
  const [replyError, setReplyError] = useState('');
  const likeCount = reactions.find(row => row.type === 'like')?.count || 0;
  const dislikeCount = reactions.find(row => row.type === 'dislike')?.count || 0;
  const canManage = isAdmin || String(session?.user?.id) === String(post.user_id);
  async function sendComment(event) {
    event.preventDefault(); if (!session) { setReplyError('سجّل دخولك لإضافة تعليق.'); return; }
    try { await request(`/posts/${post.id}/comments`, { token: session.token, method: 'POST', body: JSON.stringify({ content: commentDraft }) }); setCommentDraft(''); setReplyError(''); await refresh(); }
    catch (error) { setReplyError(error.message); }
  }
  return <article className="post-card"><div className="post-meta"><span className="avatar">{(post.username || '?').slice(0, 1)}</span><div><strong>{post.username}</strong><small>{date(post.created_at)}</small></div><span className="post-category">حكاية</span></div>{editing ? <form className="edit-form" onSubmit={async event => { event.preventDefault(); const form = new FormData(event.currentTarget); await action(`/posts/${post.id}`, 'PATCH', { title: form.get('title'), content: form.get('content') }, 'تم تحديث المنشور.'); setEditing(false); }}><input name="title" defaultValue={post.title} maxLength="200" required/><textarea name="content" defaultValue={post.content} rows="6" required/><div className="edit-actions"><button className="button button-dark button-small"><Check size={15}/> حفظ</button><button type="button" className="button button-light button-small" onClick={() => setEditing(false)}>إلغاء</button></div></form> : <><h3 className="post-title">{post.title}</h3><p className="post-content">{post.content}</p></>}<div className="post-actions"><div className="reaction-actions"><button onClick={() => action(`/posts/${post.id}/reaction`, 'PUT', { type: 'like' }, 'تم تسجيل إعجابك.')}><Heart size={17}/> إعجاب <b>{likeCount}</b></button><button onClick={() => action(`/posts/${post.id}/reaction`, 'PUT', { type: 'dislike' }, 'تم تسجيل تفاعلك.')}><ArrowDown size={16}/> <b>{dislikeCount}</b></button><button onClick={() => setShowComments(!showComments)}><MessageCircle size={17}/> {comments.length} تعليق</button></div>{canManage && <div className="manage-actions"><button className="icon-button" title="تعديل المنشور" onClick={() => setEditing(!editing)}><PenLine size={16}/></button><button className="icon-button danger" title="حذف المنشور" onClick={() => window.confirm('حذف هذا المنشور وكل تعليقاته وتفاعلاته؟') && action(`/posts/${post.id}`, 'DELETE', null, 'تم حذف المنشور.')}><Trash2 size={16}/></button></div>}</div>{showComments && <div className="comments-area"><div className="comment-list">{comments.map(comment => <Comment key={comment.id} comment={comment} session={session} isAdmin={isAdmin} action={action}/>)}</div><form className="comment-form" onSubmit={sendComment}><input value={commentDraft} onChange={e => setCommentDraft(e.target.value)} placeholder={session ? 'اكتب تعليقًا لطيفًا…' : 'سجّل دخولك للتعليق'} maxLength="10000"/><button aria-label="إرسال التعليق" disabled={!commentDraft.trim()}><ChevronLeft size={18}/></button></form>{replyError && <small className="form-error">{replyError}</small>}</div>}</article>;
}

function Comment({ comment, session, isAdmin, action }) {
  const [editing, setEditing] = useState(false); const [value, setValue] = useState(comment.content);
  const canManage = isAdmin || String(session?.user?.id) === String(comment.user_id);
  return <div className="comment-item"><span className="avatar avatar-small">{(comment.username || '?').slice(0, 1)}</span><div className="comment-body"><div className="comment-by"><strong>{comment.username}</strong><small>{date(comment.created_at)}</small></div>{editing ? <form className="comment-edit" onSubmit={async e => { e.preventDefault(); await action(`/comments/${comment.id}`, 'PATCH', { content: value }, 'تم تحديث التعليق.'); setEditing(false); }}><input value={value} onChange={e => setValue(e.target.value)} maxLength="10000"/><button className="text-button">حفظ</button></form> : <p>{comment.content}</p>}</div>{canManage && <div className="comment-controls"><button title="تعديل" onClick={() => setEditing(!editing)}><PenLine size={13}/></button><button title="حذف" onClick={() => action(`/comments/${comment.id}`, 'DELETE', null, 'تم حذف التعليق.')}><Trash2 size={13}/></button></div>}</div>;
}

createRoot(document.getElementById('root')).render(<React.StrictMode><App/></React.StrictMode>);
