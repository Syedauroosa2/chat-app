import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, addDoc, setDoc, updateDoc, onSnapshot, query, orderBy, where, serverTimestamp, arrayUnion, arrayRemove, increment, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyBCxJcg4CAfosmbaxKOScvpEBN-qOSPOus",
  authDomain: "chat-application-adc83.firebaseapp.com",
  projectId: "chat-application-adc83",
  storageBucket: "chat-application-adc83.firebasestorage.app",
  messagingSenderId: "894720031152",
  appId: "1:894720031152:web:1f2f70bec40c4424333e75"
});
const auth = getAuth(app), db = getFirestore(app);

/* ---------- helpers ---------- */
const $ = (i) => document.getElementById(i);
const h = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch {} };
const toast = (m, bad) => { const t = h('div', 'toast' + (bad ? ' bad' : ''), m); $('toasts').append(t); setTimeout(() => t.remove(), 3200); };
const hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
const sub = (q, f) => onSnapshot(q, f, (e) => toast('Firestore: ' + e.code + ' (check rules)', 1));
const hue = (s) => [...(s || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
const toURL = (b) => new Promise((r) => { const f = new FileReader(); f.onload = () => r(f.result); f.readAsDataURL(b); });
const showView = (v) => { document.querySelectorAll('.view').forEach((x) => x.classList.remove('on')); $(v).classList.add('on'); };
function avEl(name, photo, cls = 'av') {
  const e = h('div', cls);
  if (photo) e.style.background = `center/cover url("${photo}")`;
  else { e.textContent = (name || 'U')[0].toUpperCase(); e.style.background = `hsl(${hue(name)},65%,50%)`; }
  return e;
}
function shrink(file, max, q) {
  return new Promise((res, rej) => {
    const i = new Image();
    i.onload = () => {
      const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas');
      c.width = i.width * k; c.height = i.height * k; c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
      URL.revokeObjectURL(i.src); res(c.toDataURL('image/jpeg', q));
    };
    i.onerror = () => rej(new Error('Not an image'));
    i.src = URL.createObjectURL(file);
  });
}
function menu(a, items, top) {
  $('ctx')?.remove();
  const m = h('div', 'ctx'); m.id = 'ctx'; top && m.append(top);
  items.filter(Boolean).forEach(([t, f]) => { const b = h('button', '', t); b.onclick = () => { m.remove(); f(); }; m.append(b); });
  document.body.append(m);
  const r = a.getBoundingClientRect();
  m.style.top = Math.max(8, Math.min(r.bottom + 4, innerHeight - m.offsetHeight - 8)) + 'px';
  m.style.left = Math.max(8, Math.min(r.left - 90, innerWidth - m.offsetWidth - 8)) + 'px';
}
document.addEventListener('click', () => $('ctx')?.remove());
function modal(title, body, btns) {
  const o = h('div', 'ov on'), c = h('div', 'pincard'), r = h('div', 'mrow');
  btns.forEach(([t, f, alt]) => { const b = h('button', 'btn rip' + (alt ? ' alt' : ''), t); b.onclick = async () => { if ((await f()) !== false) o.remove(); }; r.append(b); });
  c.append(h('h3', '', title), body, r); o.append(c);
  o.onclick = (e) => { if (e.target === o) o.remove(); };
  document.body.append(o); return o;
}

/* ---------- state ---------- */
let me = null, users = [], chats = [], statuses = [], calls = [], cur = null, msgs = [], unM = null;
let tab = 'chats', showArch = false, reply = null, rec = null, pinCb = null, pinBuf = '';
let pc = null, stream = null, callRef = null, unCall = [], incoming = null, lastT = 0;
const els = new Map();
const myName = () => me.displayName || me.email.split('@')[0];
const myDoc = () => users.find((u) => u.id === me?.uid) || {};
const U = (id) => users.find((u) => u.id === id) || { id, name: 'User' };
const isOn = (u) => u.online && Date.now() - (u.lastSeen || 0) < 70000;
const dmId = (a, b) => [a, b].sort().join('_');
const other = (c) => c.participants.find((x) => x !== me.uid);
const cname = (c) => (c.isGroup ? c.name : U(other(c)).name);
const cphoto = (c) => (c.isGroup ? '' : U(other(c)).photo);
const dmChat = (uid) => chats.find((c) => !c.isGroup && c.participants.includes(uid)) || { id: dmId(me.uid, uid), participants: [me.uid, uid] };
const preview = (d) => d.type === 'image' ? '📷 Photo' : d.type === 'voice' ? '🎤 Voice message' : d.type === 'sticker' ? d.text + ' Sticker' : d.type === 'location' ? '📍 Location' : (d.text || '').slice(0, 60);
const upMy = (f, id) => { const a = myDoc()[f] || []; return updateDoc(doc(db, 'users', me.uid), { [f]: a.includes(id) ? arrayRemove(id) : arrayUnion(id) }); };

/* ---------- auth ---------- */
setTimeout(() => $('splash').classList.add('off'), 700);
const seg = document.querySelector('.seg'), panes = $('panes');
const setMode = (m) => { seg.dataset.m = panes.dataset.m = m; $('tabLogin').classList.toggle('on', m === 'login'); $('tabSignup').classList.toggle('on', m === 'signup'); $('fLogin').classList.toggle('on', m === 'login'); $('fSignup').classList.toggle('on', m === 'signup'); };
$('tabLogin').onclick = () => setMode('login'); $('tabSignup').onclick = () => setMode('signup');
document.querySelectorAll('.eye').forEach((b) => b.onclick = () => { const i = b.parentElement.querySelector('input'); i.type = i.type === 'password' ? 'text' : 'password'; });
const fail = (e) => { $('err').textContent = ({ 'auth/invalid-credential': 'Wrong email or password', 'auth/email-already-in-use': 'Email already used', 'auth/weak-password': 'Password needs 6+ characters' })[e.code] || e.code || e.message; };
$('fLogin').onsubmit = async (e) => { e.preventDefault(); try { await signInWithEmailAndPassword(auth, $('liEmail').value, $('liPass').value); } catch (x) { fail(x); } };
$('fSignup').onsubmit = async (e) => {
  e.preventDefault();
  try {
    const c = await createUserWithEmailAndPassword(auth, $('suEmail').value, $('suPass').value);
    await updateProfile(c.user, { displayName: $('suName').value });
    await setDoc(doc(db, 'users', c.user.uid), { name: $('suName').value }, { merge: true });
    $('meName').textContent = $('suName').value;
  } catch (x) { fail(x); }
};
$('bGoogle').onclick = async () => { try { await signInWithPopup(auth, new GoogleAuthProvider()); } catch (x) { fail(x); } };
onAuthStateChanged(auth, (u) => { if (u) { me = u; init(); } else { me = null; showView('v-auth'); } });

/* ---------- theme + wallpaper ---------- */
const applyTheme = () => { const d = ls('dark') === '1'; document.documentElement.dataset.theme = d ? 'dark' : ''; $('bTheme').textContent = d ? '☀️' : '🌙'; };
applyTheme(); $('bTheme').onclick = () => { ls('dark', ls('dark') === '1' ? '0' : '1'); applyTheme(); };
const WALLS = ['', 'linear-gradient(160deg,#0f2027,#2c5364)', 'linear-gradient(160deg,#41295a,#2f0743)', 'linear-gradient(160deg,#134e5e,#71b280)', 'linear-gradient(160deg,#fceabb,#f8b500)'];
const applyWall = () => { $('msgs').style.background = WALLS[+ls('wall') || 0]; };

/* ---------- init ---------- */
function init() {
  setDoc(doc(db, 'users', me.uid), { name: myDoc().name || myName(), email: me.email, online: true, lastSeen: Date.now() }, { merge: true }).catch((e) => toast('Firestore: ' + e.code + ' (check rules)', 1));
  showView('v-app'); applyWall();
  sub(collection(db, 'users'), (s) => { users = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderAll(); });
  sub(query(collection(db, 'chats'), where('participants', 'array-contains', me.uid)), (s) => {
    chats = s.docs.map((d) => ({ id: d.id, ...d.data() }));
    if (cur) { const n = chats.find((c) => c.id === cur.id); if (n) cur = { ...cur, ...n }; headInfo(); }
    renderList();
  });
  sub(collection(db, 'statuses'), (s) => { statuses = s.docs.map((d) => ({ id: d.id, ...d.data() })); renderStories(); });
  sub(query(collection(db, 'calls'), where('participants', 'array-contains', me.uid)), onCalls);
  setInterval(() => updateDoc(doc(db, 'users', me.uid), { online: true, lastSeen: Date.now() }).catch(() => {}), 25000);
  addEventListener('pagehide', () => updateDoc(doc(db, 'users', me.uid), { online: false, lastSeen: Date.now() }));
  document.addEventListener('visibilitychange', markSeen);
}
function renderAll() {
  const a = avEl(myName(), myDoc().photo); a.id = 'meAv'; $('meAv').replaceWith(a);
  $('meName').textContent = myName(); renderList(); renderStories(); headInfo();
}

/* ---------- lists ---------- */
const mkRow = (a, t, s, tm, un, muted) => {
  const r = h('div', 'row'), w = h('div', 'rw'), t1 = h('div'), t2 = h('div');
  t1.append(h('b', '', t), h('small', '', tm || '')); t2.append(h('span', 'pv', s || ''));
  if (un) t2.append(h('span', 'badge' + (muted ? ' mute' : ''), un));
  w.append(t1, t2); r.append(a, w); return r;
};
document.querySelectorAll('.tabs button').forEach((b) => b.onclick = () => {
  document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('on')); b.classList.add('on'); tab = b.dataset.t; renderList();
});
$('q').oninput = () => renderList();
function renderList() {
  const box = $('list'); box.replaceChildren(); const q = $('q').value.toLowerCase(), md = myDoc();
  if (tab === 'people') {
    const g = mkRow(avEl('+'), 'New group', 'Create a group chat'); g.onclick = newGroup; box.append(g);
    users.filter((u) => u.id !== me.uid && (u.name || '').toLowerCase().includes(q)).forEach((u) => {
      const r = mkRow(avEl(u.name, u.photo), u.name, (isOn(u) ? '🟢 ' : '') + (u.about || 'Hey there!')); r.onclick = () => openChat(dmChat(u.id)); box.append(r);
    });
  } else if (tab === 'calls') {
    if (!calls.length) box.append(h('p', 'pv', 'No calls yet.'));
    calls.forEach((c) => {
      const out = c.from === me.uid, o = out ? c.to : c.from;
      const r = mkRow(avEl(U(o).name, U(o).photo), U(o).name, `${out ? '↗ Outgoing' : '↙ Incoming'} ${c.type === 'video' ? '📹' : '📞'} · ${c.status}`, hm(c.createdAt));
      r.onclick = () => openChat(dmChat(o)); box.append(r);
    });
  } else {
    const arch = md.archived || [], pins = md.pins || [], mut = md.muted || [];
    const l = chats.filter((c) => arch.includes(c.id) === showArch && cname(c).toLowerCase().includes(q));
    l.sort((a, b) => (pins.includes(b.id) - pins.includes(a.id)) || (b.lastAt || 0) - (a.lastAt || 0));
    if (!showArch && arch.length) { const r = mkRow(avEl('A'), 'Archived', arch.length + ' chat(s)'); r.onclick = () => { showArch = true; renderList(); }; box.append(r); }
    if (showArch) { const r = mkRow(avEl('←'), 'Back to chats', ''); r.onclick = () => { showArch = false; renderList(); }; box.append(r); }
    l.forEach((c) => {
      const locked = ls('lock_' + c.id), un = c.unread?.[me.uid] || 0;
      const r = mkRow(avEl(cname(c), cphoto(c)), (pins.includes(c.id) ? '📌 ' : '') + cname(c) + (mut.includes(c.id) ? ' 🔕' : ''), locked ? '🔒 Locked chat' : (c.lastFrom === me.uid ? 'You: ' : '') + (c.last || ''), c.lastAt ? hm(c.lastAt) : '', un, mut.includes(c.id));
      if (cur && c.id === cur.id) r.style.background = 'var(--bg)';
      const mb = h('button', 'ib', '⋮');
      mb.onclick = (e) => { e.stopPropagation(); menu(mb, [[pins.includes(c.id) ? '📌 Unpin' : '📌 Pin', () => upMy('pins', c.id)], [arch.includes(c.id) ? '📤 Unarchive' : '🗄 Archive', () => upMy('archived', c.id)], [mut.includes(c.id) ? '🔔 Unmute' : '🔕 Mute', () => upMy('muted', c.id)]]); };
      r.append(mb); r.onclick = () => openChat(c); box.append(r);
    });
    if (!l.length) box.append(h('p', 'pv', showArch ? 'Nothing archived.' : 'No chats yet. Open the People tab and say hi 👋'));
  }
}

/* ---------- open chat ---------- */
function openChat(c) {
  const pin = ls('lock_' + c.id);
  if (pin) return askPin('Enter PIN', 'This chat is locked', (p) => p === pin ? go(c) : toast('Wrong PIN', 1));
  go(c);
}
function go(c) {
  cur = c; reply = null; $('rep').replaceChildren(); els.clear(); msgs = []; $('msgs').replaceChildren();
  $('empty').hidden = true; $('cv').hidden = false; $('app').classList.add('chat-open');
  headInfo(); applyWall(); unM && unM();
  unM = sub(query(collection(db, 'chats', c.id, 'messages'), orderBy('createdAt', 'asc')), onMsgs);
  renderList();
}
function headInfo() {
  if (!cur) return;
  const a = avEl(cname(cur), cphoto(cur)); a.id = 'chAv'; $('chAv').replaceWith(a);
  $('chName').textContent = cname(cur);
  const ty = Object.entries(cur.typing || {}).filter(([u, t]) => u !== me.uid && Date.now() - t < 5000).map(([u]) => U(u).name.split(' ')[0]);
  let s;
  if (ty.length) s = cur.isGroup ? ty.join(', ') + ' typing…' : 'typing…';
  else if (cur.isGroup) s = cur.participants.map((p) => U(p).name).join(', ');
  else { const u = U(other(cur)); s = isOn(u) ? 'online' : u.lastSeen ? 'last seen ' + hm(u.lastSeen) : 'offline'; }
  $('chSub').textContent = s; $('bCall').style.display = $('bVideo').style.display = cur.isGroup ? 'none' : '';
}
setInterval(headInfo, 3000);
function typingPing() { if (!cur || Date.now() - lastT < 2500) return; lastT = Date.now(); setDoc(doc(db, 'chats', cur.id), { typing: { [me.uid]: Date.now() } }, { merge: true }); }

/* ---------- messages ---------- */
function onMsgs(s) {
  s.docChanges().forEach((ch) => {
    const id = ch.doc.id, m = { id, ...ch.doc.data({ serverTimestamps: 'estimate' }) };
    if (ch.type === 'removed') { els.get(id)?.remove(); els.delete(id); msgs = msgs.filter((x) => x.id !== id); return; }
    const hidden = m.deletedFor?.includes(me.uid) || (m.from !== me.uid && myDoc().blocked?.includes(m.from));
    msgs = msgs.filter((x) => x.id !== id); const old = els.get(id);
    if (hidden) { old?.remove(); els.delete(id); return; }
    msgs.push(m); const row = bubble(m);
    old ? old.replaceWith(row) : $('msgs').append(row); els.set(id, row);
  });
  $('msgs').scrollTop = $('msgs').scrollHeight; markSeen();
}
function markSeen() {
  if (!cur || document.hidden) return;
  msgs.filter((m) => m.from !== me.uid && !m.seenBy?.includes(me.uid)).slice(0, 40).forEach((m) => updateDoc(doc(db, 'chats', cur.id, 'messages', m.id), { seenBy: arrayUnion(me.uid) }).catch(() => {}));
  if (cur.unread?.[me.uid]) setDoc(doc(db, 'chats', cur.id), { unread: { [me.uid]: 0 } }, { merge: true });
}
const upd = (m, o) => updateDoc(doc(db, 'chats', cur.id, 'messages', m.id), o);
const react = (m, e) => upd(m, { [`react.${me.uid}`]: m.react?.[me.uid] === e ? deleteField() : e });
function viewImg(src) { const o = h('div', 'ov on imgv'), i = h('img'); i.src = src; o.append(i); o.onclick = () => o.remove(); document.body.append(o); }

function bubble(m) {
  const mine = m.from === me.uid, d = h('div', 'm ' + (mine ? 'o' : 'i')), tm = m.createdAt?.toMillis?.() || Date.now();
  if (m.type === 'sticker' && !m.deleted) d.classList.add('stk');
  if (!mine && cur.isGroup) { const w = h('div', 'who', m.name); w.style.color = `hsl(${hue(m.name)},65%,45%)`; d.append(w); }
  if (m.fwd) d.append(h('div', 'fw', '↪ Forwarded'));
  if (m.replyTo && !m.deleted) { const q = h('div', 'rq'); q.append(h('b', '', m.replyTo.name), h('span', '', m.replyTo.text)); q.onclick = () => els.get(m.replyTo.id)?.scrollIntoView({ behavior: 'smooth', block: 'center' }); d.append(q); }
  if (m.deleted) d.append(h('i', 'gone', '🚫 This message was deleted'));
  else if (m.type === 'image') { const i = h('img', 'pic'); i.src = m.data; i.onclick = () => viewImg(m.data); d.append(i); }
  else if (m.type === 'voice') {
    const w = h('div', 'voice-msg'), a = h('audio'); a.controls = true; a.src = m.data;
    w.append(h('span', '', '🎤'), a); d.append(w);
    if (m.dur) d.append(h('small', '', `${Math.floor(m.dur / 60)}:${String(m.dur % 60).padStart(2, '0')}`));
  } else if (m.type === 'sticker') d.append(h('div', 'big', m.text));
  else if (m.type === 'location') {
    const w = h('div', 'loc'), f = h('iframe'), la = Number(m.lat), ln = Number(m.lng), x = 0.004;
    f.src = `https://www.openstreetmap.org/export/embed.html?bbox=${ln - x},${la - x / 1.6},${ln + x},${la + x / 1.6}&layer=mapnik&marker=${la},${ln}`;
    const a = h('a', '', '📍 Open in Maps'); a.href = `https://www.google.com/maps?q=${la},${ln}`; a.target = '_blank'; a.rel = 'noopener';
    w.append(f, a); d.append(w);
  } else d.append(h('span', '', m.text));
  const meta = h('span', 'mt');
  if (m.starredBy?.includes(me.uid)) meta.append(h('span', '', '⭐'));
  if (m.edited && !m.deleted) meta.append(h('span', '', 'edited'));
  meta.append(h('span', '', hm(tm)));
  if (mine && !m.deleted) { const o = cur.participants.filter((x) => x !== me.uid), seen = o.length && o.every((x) => m.seenBy?.includes(x)); meta.append(h('span', 'tk' + (seen ? ' seen' : ''), seen ? '✓✓' : '✓')); }
  d.append(meta);
  const rx = Object.values(m.react || {});
  if (rx.length && !m.deleted) { const c = {}; rx.forEach((x) => c[x] = (c[x] || 0) + 1); const w = h('div', 'rxs'); Object.entries(c).forEach(([e, n]) => w.append(h('span', 'rx' + (m.react[me.uid] === e ? ' mine' : ''), e + (n > 1 ? ' ' + n : '')))); d.append(w); }
  if (!m.deleted) {
    d.ondblclick = () => react(m, '❤️');
    const b = h('button', 'mm', '⋯');
    b.onclick = (e) => {
      e.stopPropagation();
      const top = h('div', 'emo'); ['👍', '❤️', '😂', '😮', '😢', '🙏'].forEach((x) => { const bt = h('button', '', x); bt.onclick = () => react(m, x); top.append(bt); });
      const st = m.starredBy?.includes(me.uid);
      menu(b, [['↩ Reply', () => setReply(m)], m.text && ['📋 Copy', () => navigator.clipboard?.writeText(m.text)], ['↪ Forward', () => forward(m)], [st ? '☆ Unstar' : '⭐ Star', () => upd(m, { starredBy: st ? arrayRemove(me.uid) : arrayUnion(me.uid) })], mine && m.type === 'text' && ['✏️ Edit', () => { const t = prompt('Edit message', m.text); if (t && t.trim()) upd(m, { text: t.trim(), edited: true }); }], ['🗑 Delete for me', () => upd(m, { deletedFor: arrayUnion(me.uid) })], mine && ['🗑 Delete for everyone', () => upd(m, { deleted: true, text: '', data: '', react: {} })]], top);
    };
    d.append(b);
  }
  return d;
}
function setReply(m) {
  reply = { id: m.id, name: m.name || 'User', text: preview(m) };
  const b = h('div', 'replybar'), x = h('button', 'ib', '✕');
  x.onclick = () => { reply = null; $('rep').replaceChildren(); };
  b.append(h('b', '', reply.name), h('span', '', reply.text), x); $('rep').replaceChildren(b); $('inp').focus();
}
async function post(d, t = cur) {
  if (!t) return;
  const o = t.isGroup ? null : t.participants.find((x) => x !== me.uid);
  if (o) {
    if (myDoc().blocked?.includes(o)) return toast('You blocked this person', 1);
    if (U(o).blocked?.includes(me.uid)) return toast("You can't message this person", 1);
  }
  const p = { from: me.uid, name: myName(), createdAt: serverTimestamp(), seenBy: [me.uid], ...d };
  if (reply && t === cur) { p.replyTo = reply; reply = null; $('rep').replaceChildren(); }
  await addDoc(collection(db, 'chats', t.id, 'messages'), p);
  const unread = {}; t.participants.forEach((x) => { if (x !== me.uid) unread[x] = increment(1); });
  await setDoc(doc(db, 'chats', t.id), { participants: t.participants, isGroup: !!t.isGroup, ...(t.isGroup ? { name: t.name, admin: t.admin } : {}), last: preview(d), lastAt: Date.now(), lastFrom: me.uid, unread, typing: { [me.uid]: 0 } }, { merge: true });
}
function forward(m) {
  const b = h('div', 'fl');
  const targets = [...chats.map((c) => ({ t: c, n: cname(c), p: cphoto(c) })), ...users.filter((u) => u.id !== me.uid && !chats.some((c) => !c.isGroup && other(c) === u.id)).map((u) => ({ t: dmChat(u.id), n: u.name, p: u.photo }))];
  const o = modal('Forward to…', b, [['Cancel', () => {}, 1]]);
  targets.forEach((x) => {
    const r = mkRow(avEl(x.n, x.p), x.n, '');
    r.onclick = async () => { const c = { type: m.type, fwd: true }; ['text', 'data', 'dur', 'lat', 'lng'].forEach((k) => { if (m[k] != null) c[k] = m[k]; }); await post(c, x.t); o.remove(); toast('Forwarded'); };
    b.append(r);
  });
}
function newGroup() {
  const nm = h('input'); nm.placeholder = 'Group name'; const l = h('div', 'fl'), sel = new Set();
  users.filter((u) => u.id !== me.uid).forEach((u) => {
    const c = h('input'); c.type = 'checkbox'; c.onchange = () => (c.checked ? sel.add(u.id) : sel.delete(u.id));
    const r = mkRow(avEl(u.name, u.photo), u.name, ''); r.prepend(c); l.append(r);
  });
  const b = h('div', 'col'); b.append(nm, l);
  modal('New group', b, [['Create', async () => {
    if (!nm.value.trim() || !sel.size) { toast('Add a name and members', 1); return false; }
    const ref = doc(collection(db, 'chats')), g = { id: ref.id, isGroup: true, name: nm.value.trim(), admin: me.uid, participants: [me.uid, ...sel] };
    await setDoc(ref, { participants: g.participants, isGroup: true, name: g.name, admin: me.uid, last: 'Group created', lastAt: Date.now(), unread: {} });
    openChat(g);
  }], ['Cancel', () => {}, 1]]);
}

/* ---------- composer: text, voice note, photo, location, emoji ---------- */
const sync = () => { $('bSend').textContent = rec || $('inp').value.trim() ? '➔' : '🎤'; };
$('inp').oninput = () => { sync(); typingPing(); };
$('inp').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendClick(); } };
$('bSend').onclick = () => sendClick();
function sendClick() {
  if (rec) return finishRec();
  const t = $('inp').value.trim();
  if (t) { post({ type: 'text', text: t }); $('inp').value = ''; sync(); } else startRec();
}
const bX = h('button', 'ib', '✕'); bX.style.display = 'none'; $('bSend').before(bX);
bX.onclick = () => { if (rec) { rec.send = false; rec.mr.stop(); } };
function recUI(on) { bX.style.display = on ? '' : 'none'; $('inp').disabled = on; if (!on) $('inp').placeholder = 'Type a message...'; sync(); }
function finishRec() { rec.send = true; rec.mr.stop(); }
async function startRec() {
  if (!cur) return;
  try {
    const st = await navigator.mediaDevices.getUserMedia({ audio: true });
    const mt = ['audio/webm;codecs=opus', 'audio/mp4'].find((t) => window.MediaRecorder && MediaRecorder.isTypeSupported(t));
    const mr = new MediaRecorder(st, { ...(mt ? { mimeType: mt } : {}), audioBitsPerSecond: 24000 }), ch = [];
    const r = { mr, t0: Date.now(), send: false, iv: 0 }; rec = r;
    mr.ondataavailable = (e) => ch.push(e.data);
    mr.onstop = async () => {
      clearInterval(r.iv); st.getTracks().forEach((t) => t.stop()); rec = null; recUI(false);
      if (!r.send) return;
      const b = new Blob(ch, { type: mr.mimeType });
      if (b.size > 700000) return toast('Voice note too long', 1);
      post({ type: 'voice', data: await toURL(b), dur: Math.max(1, Math.round((Date.now() - r.t0) / 1000)) });
    };
    mr.start(); recUI(true);
    r.iv = setInterval(() => { const s = Math.round((Date.now() - r.t0) / 1000); $('inp').placeholder = `🔴 Recording ${s}s · tap ➔ to send`; if (s >= 90) finishRec(); }, 400);
  } catch (e) { toast('Allow microphone access to send voice notes', 1); }
}
$('bAtt').onclick = (e) => { e.stopPropagation(); menu($('bAtt'), [['🖼 Photo', () => $('fileInput').click()], ['📍 Location', () => {
  if (!navigator.geolocation) return toast('Location not supported', 1);
  navigator.geolocation.getCurrentPosition((p) => post({ type: 'location', lat: p.coords.latitude, lng: p.coords.longitude }), () => toast('Allow location access', 1));
}]]); };
$('fileInput').onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (!f.type.startsWith('image/')) return toast('Only photos are supported on the free plan', 1);
  post({ type: 'image', data: await shrink(f, 900, .72) });
};
const EMO = '😀 😃 😄 😁 😆 😅 😂 🤣 😊 😇 🙂 😉 😍 🥰 😘 😋 😎 🤩 🥳 😏 😒 😞 😔 😢 😭 😤 😡 🤬 😱 😴 🤔 🤗 🤭 🙄 😬 🤤 😷 🤯 👍 👎 👏 🙌 🙏 💪 👋 🤝 ✌️ 🤞 👌 ❤️ 🧡 💛 💚 💙 💜 🖤 💔 💕 💯 🔥 ✨ ⭐ 🎉 🎁 🎂 🍕 🍔 ☕ 🌹 🌙 ☀️ 🌈 ⚽ 🎮 🎵 📸 🚀'.split(' ');
const STK = '🧸 🦄 🍕 🏆 ⭐ 🍩 ⚡ 🐱 🐶 🌻 🎨 🥳 😂 🥰 😎 😭 🔥 💯 🎉 ❤️ 👏 🤝 🙌 🤯'.split(' ');
function openPicker(m) {
  const p = $('pickerPopup'), b = $('pickerBody'); p.hidden = false; b.replaceChildren();
  document.querySelectorAll('.picker-tab').forEach((t) => t.classList.toggle('on', t.dataset.tab === m));
  (m === 'emojis' ? EMO : STK).forEach((x) => {
    const e = h('div', 'picker-item', x); if (m === 'stickers') e.style.fontSize = '34px';
    e.onclick = (ev) => { ev.stopPropagation(); if (m === 'emojis') { $('inp').value += x; sync(); } else { post({ type: 'sticker', text: x }); p.hidden = true; } };
    b.append(e);
  });
}
$('bEmo').onclick = (e) => { e.stopPropagation(); openPicker('emojis'); };
$('bSticker').onclick = (e) => { e.stopPropagation(); openPicker('stickers'); };
document.querySelectorAll('.picker-tab').forEach((t) => t.onclick = (e) => { e.stopPropagation(); openPicker(t.dataset.tab); });
document.addEventListener('click', (e) => { if (!$('pickerPopup').contains(e.target)) $('pickerPopup').hidden = true; });
$('msgs').onscroll = () => { const m = $('msgs'); $('bDown').style.display = m.scrollHeight - m.scrollTop - m.clientHeight > 300 ? 'grid' : 'none'; };
$('bDown').onclick = () => $('msgs').scrollTo({ top: 1e9, behavior: 'smooth' });
$('bBack').onclick = () => $('app').classList.remove('chat-open');

/* ---------- header menu, chat lock ---------- */
const bMore = h('button', 'ib', '⋮'); bMore.id = 'bMore'; $('bLock').after(bMore);
bMore.onclick = (e) => {
  e.stopPropagation(); if (!cur) return;
  const o = cur.isGroup ? null : other(cur), isB = o && myDoc().blocked?.includes(o);
  menu(bMore, [
    o && [isB ? '✅ Unblock' : '🚫 Block', async () => { await updateDoc(doc(db, 'users', me.uid), { blocked: isB ? arrayRemove(o) : arrayUnion(o) }); go(cur); }],
    [(myDoc().muted || []).includes(cur.id) ? '🔔 Unmute' : '🔕 Mute', () => upMy('muted', cur.id)],
    ['🔍 Search in chat', () => {
      const q = (prompt('Search messages') || '').toLowerCase(); if (!q) return;
      const m = [...msgs].reverse().find((x) => (x.text || '').toLowerCase().includes(q)), el = m && els.get(m.id);
      if (!el) return toast('No match', 1);
      el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.add('hl'); setTimeout(() => el.classList.remove('hl'), 2000);
    }],
    ['⭐ Starred messages', () => {
      const l = h('div', 'fl');
      msgs.filter((m) => m.starredBy?.includes(me.uid)).forEach((m) => { const r = h('div', 'row'); r.append(h('span', 'pv', `${m.name}: ${preview(m)}`)); r.onclick = () => els.get(m.id)?.scrollIntoView({ block: 'center' }); l.append(r); });
      if (!l.children.length) l.append(h('p', 'pv', 'No starred messages.'));
      modal('⭐ Starred', l, [['Close', () => {}, 1]]);
    }],
    ['🎨 Change wallpaper', () => { ls('wall', ((+ls('wall') || 0) + 1) % WALLS.length); applyWall(); }]
  ]);
};
function askPin(t, s, cb) { pinBuf = ''; pinCb = cb; $('pinTitle').textContent = t; $('pinSub').textContent = s; dots(); $('pin').classList.add('on'); }
const dots = () => document.querySelectorAll('#pinDots i').forEach((d, i) => { d.className = i < pinBuf.length ? 'f' : ''; });
document.querySelectorAll('.pad button').forEach((b) => b.onclick = () => {
  const k = b.dataset.k, a = b.dataset.a;
  if (k && pinBuf.length < 4) { pinBuf += k; dots(); if (pinBuf.length === 4) { const p = pinBuf; setTimeout(() => { $('pin').classList.remove('on'); pinCb && pinCb(p); }, 150); } }
  else if (a === 'del') { pinBuf = pinBuf.slice(0, -1); dots(); }
  else if (a === 'x') $('pin').classList.remove('on');
});
$('bLock').onclick = () => {
  if (!cur) return; const k = 'lock_' + cur.id;
  if (ls(k)) askPin('Enter PIN', 'Remove the chat lock', (p) => { if (p === ls(k)) { localStorage.removeItem(k); toast('Chat unlocked'); renderList(); } else toast('Wrong PIN', 1); });
  else askPin('Set a 4-digit PIN', 'This chat will ask for it every time', (p) => { ls(k, p); toast('🔒 Chat locked'); renderList(); });
};

/* ---------- settings ---------- */
let newPhoto = null;
const pf = h('input'); pf.type = 'file'; pf.accept = 'image/*';
pf.onchange = async () => { newPhoto = await shrink(pf.files[0], 128, .8); toast('Photo ready, tap Save'); };
$('sName').closest('label').before(pf);
$('bSet').onclick = () => { $('sName').value = myName(); $('sAbout').value = myDoc().about || 'Available on Gupshup'; $('sheet').classList.add('on'); };
$('sClose').onclick = () => $('sheet').classList.remove('on');
$('sSave').onclick = async () => {
  const n = $('sName').value.trim();
  if (n) await updateProfile(auth.currentUser, { displayName: n });
  await setDoc(doc(db, 'users', me.uid), { name: n || myName(), about: $('sAbout').value, ...(newPhoto ? { photo: newPhoto } : {}) }, { merge: true });
  newPhoto = null; $('sheet').classList.remove('on'); toast('Profile updated');
};
$('sOut').onclick = async () => { await updateDoc(doc(db, 'users', me.uid), { online: false }).catch(() => {}); await signOut(auth); location.reload(); };

/* ---------- status / stories ---------- */
function renderStories() {
  const box = $('storiesList'); box.replaceChildren();
  const by = {}; statuses.filter((s) => Date.now() - s.createdAt < 864e5).forEach((s) => (by[s.uid] = by[s.uid] || []).push(s));
  Object.entries(by).filter(([u]) => u !== me.uid).forEach(([u, arr]) => {
    const unseen = arr.some((s) => !s.viewers?.[me.uid]), it = h('div', 'story-item');
    it.append(avEl(U(u).name, U(u).photo, 'av story-ring' + (unseen ? '' : ' seen')), h('small', '', U(u).name));
    it.onclick = () => viewStories(arr); box.append(it);
  });
}
$('btnMyStory').onclick = () => { const mine = statuses.filter((s) => s.uid === me.uid && Date.now() - s.createdAt < 864e5); mine.length ? viewStories(mine) : addStatus(); };
function addStatus() {
  const ta = h('textarea'); ta.placeholder = "What's on your mind?";
  const col = h('input'); col.type = 'color'; col.value = '#6c4cff';
  const f = h('input'); f.type = 'file'; f.accept = 'image/*';
  const b = h('div', 'col'); b.append(ta, col, f);
  modal('New status', b, [['Post', async () => {
    const t = ta.value.trim(), fl = f.files[0];
    if (!t && !fl) { toast('Add text or a photo', 1); return false; }
    await addDoc(collection(db, 'statuses'), { uid: me.uid, type: fl ? 'image' : 'text', text: t, data: fl ? await shrink(fl, 800, .7) : '', bg: col.value, createdAt: Date.now(), viewers: {} });
    toast('Status posted');
  }], ['Cancel', () => {}, 1]]);
}
function viewStories(list) {
  const arr = [...list].sort((a, b) => a.createdAt - b.createdAt); let i = 0, tm;
  const o = h('div', 'ov on sv'); document.body.append(o);
  const close = () => { clearTimeout(tm); o.remove(); };
  const render = () => {
    clearTimeout(tm); const s = arr[i], mine = s.uid === me.uid; o.replaceChildren();
    const bars = h('div', 'bars'); arr.forEach((_, k) => bars.append(h('i', k <= i ? 'on' : '')));
    const top = h('div', 'stop'), x = h('button', 'ib', '✕'); x.style.color = '#fff'; x.onclick = close;
    top.append(avEl(U(s.uid).name, U(s.uid).photo), h('b', '', mine ? 'My status' : U(s.uid).name), h('span', '', hm(s.createdAt)), x);
    const body = h('div', 'sbody'); body.style.background = `linear-gradient(135deg,${s.bg || '#6c4cff'},#0e0a22)`;
    if (s.type === 'image') { const im = h('img'); im.src = s.data; body.append(im); }
    if (s.text) body.append(h('p', '', s.text));
    const foot = h('div', 'sfoot');
    if (mine) {
      const v = Object.values(s.viewers || {});
      foot.append(h('b', '', `👁 Seen by ${v.length}`), ...v.map((y) => h('div', 'seen-row', `${y.n}${y.liked ? ' ❤️' : ''} · ${hm(y.t)}`)));
      const add = h('button', 'btn rip', '+ Add status'); add.onclick = () => { close(); addStatus(); }; foot.append(add);
    } else {
      if (!s.viewers?.[me.uid]) updateDoc(doc(db, 'statuses', s.id), { [`viewers.${me.uid}`]: { n: myName(), t: Date.now(), liked: false } });
      const like = h('button', 'ib', s.viewers?.[me.uid]?.liked ? '❤️' : '🤍');
      like.onclick = () => { like.textContent = '❤️'; updateDoc(doc(db, 'statuses', s.id), { [`viewers.${me.uid}.liked`]: true }); };
      const ri = h('input'); ri.placeholder = 'Reply…';
      ri.onkeydown = (e) => { if (e.key === 'Enter' && ri.value.trim()) { post({ type: 'text', text: '↩ Status: ' + ri.value.trim() }, dmChat(s.uid)); ri.value = ''; toast('Reply sent'); } };
      ri.onclick = () => clearTimeout(tm);
      foot.append(like, ri);
    }
    o.append(bars, top, body, foot);
    const next = () => { i++; i < arr.length ? render() : close(); };
    body.onclick = next; if (!mine) tm = setTimeout(next, 5000);
  };
  render();
}

/* ---------- calls (WebRTC, signaling through Firestore) ---------- */
const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
document.querySelector('#callModal .pincard').innerHTML = '<div class="call-avatar" id="callAvatar"></div><h2 id="callUserName"></h2><p id="callStatus"></p><video id="rv" autoplay playsinline></video><video id="lv" autoplay playsinline muted></video><div class="call-actions"><button class="cb" id="bMute">🎙</button><button class="cb" id="bCam">📷</button><button class="cb ok" id="bAcc">📞</button><button class="cb end" id="btnEndCall">📵</button></div>';
function showCall(name, photo, status, vid, mode) {
  $('callUserName').textContent = name; $('callStatus').textContent = status;
  const a = avEl(name, photo, 'call-avatar'); a.id = 'callAvatar'; $('callAvatar').replaceWith(a);
  $('rv').style.display = $('lv').style.display = vid ? 'block' : 'none';
  $('bAcc').style.display = mode === 'in' ? '' : 'none'; $('bMute').style.display = mode === 'in' ? 'none' : '';
  $('bCam').style.display = vid && mode !== 'in' ? '' : 'none'; $('callModal').classList.add('on');
}
async function media(vid) {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: vid });
  $('lv').srcObject = stream; pc = new RTCPeerConnection(ICE);
  stream.getTracks().forEach((t) => pc.addTrack(t, stream));
  pc.ontrack = (e) => { $('rv').srcObject = e.streams[0]; };
  pc.onconnectionstatechange = () => {
    if (pc?.connectionState === 'connected') $('callStatus').textContent = 'Connected ✅';
    if (pc && ['failed', 'closed'].includes(pc.connectionState)) endCall(false);
  };
}
const addCand = (c) => c.type === 'added' && pc && pc.addIceCandidate(c.doc.data()).catch(() => {});
async function startCall(vid) {
  if (!cur || cur.isGroup) return toast('Open a personal chat to call', 1);
  const to = other(cur);
  if (myDoc().blocked?.includes(to) || U(to).blocked?.includes(me.uid)) return toast('Call not possible', 1);
  try { await media(vid); } catch { endCall(false); return toast('Allow microphone/camera access', 1); }
  showCall(cname(cur), cphoto(cur), 'Calling…', vid, 'live');
  callRef = doc(collection(db, 'calls'));
  pc.onicecandidate = (e) => e.candidate && addDoc(collection(callRef, 'offerCandidates'), e.candidate.toJSON());
  const o = await pc.createOffer(); await pc.setLocalDescription(o);
  await setDoc(callRef, { from: me.uid, fromName: myName(), to, participants: [me.uid, to], type: vid ? 'video' : 'voice', status: 'ringing', offer: { type: o.type, sdp: o.sdp }, createdAt: Date.now() });
  unCall.push(sub(callRef, async (s) => {
    const d = s.data(); if (!d || !pc) return;
    if (d.answer && !pc.currentRemoteDescription) await pc.setRemoteDescription(d.answer);
    if (['declined', 'ended', 'missed'].includes(d.status)) endCall(false);
  }), sub(collection(callRef, 'answerCandidates'), (s) => s.docChanges().forEach(addCand)));
  setTimeout(() => { if (pc && !pc.currentRemoteDescription) endCall(true, 'missed'); }, 45000);
}
async function endCall(notify = true, st = 'ended') {
  if (notify && callRef) await updateDoc(callRef, { status: st }).catch(() => {});
  unCall.forEach((f) => f()); unCall = []; pc && pc.close(); pc = null;
  stream && stream.getTracks().forEach((t) => t.stop()); stream = null; callRef = null; incoming = null;
  $('rv').srcObject = null; $('lv').srcObject = null; $('callModal').classList.remove('on');
}
function onCalls(s) {
  calls = s.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => b.createdAt - a.createdAt);
  if (tab === 'calls') renderList();
  const inc = calls.find((c) => c.to === me.uid && c.status === 'ringing' && Date.now() - c.createdAt < 45000);
  if (inc && !pc && (!incoming || incoming.id !== inc.id)) { incoming = inc; showCall(inc.fromName, U(inc.from).photo, (inc.type === 'video' ? 'Video' : 'Voice') + ' call…', false, 'in'); }
  else if (!inc && incoming && !pc) { incoming = null; $('callModal').classList.remove('on'); }
}
$('bAcc').onclick = async () => {
  const d = incoming; if (!d) return; const vid = d.type === 'video';
  try { await media(vid); } catch { endCall(false); return toast('Allow microphone/camera access', 1); }
  callRef = doc(db, 'calls', d.id); showCall(d.fromName, U(d.from).photo, 'Connecting…', vid, 'live');
  pc.onicecandidate = (e) => e.candidate && addDoc(collection(callRef, 'answerCandidates'), e.candidate.toJSON());
  await pc.setRemoteDescription(d.offer);
  const a = await pc.createAnswer(); await pc.setLocalDescription(a);
  await updateDoc(callRef, { answer: { type: a.type, sdp: a.sdp }, status: 'accepted' });
  unCall.push(sub(collection(callRef, 'offerCandidates'), (s) => s.docChanges().forEach(addCand)), sub(callRef, (s) => { if (['ended', 'missed'].includes(s.data()?.status)) endCall(false); }));
  incoming = null;
};
$('btnEndCall').onclick = () => {
  if (incoming && !pc) { updateDoc(doc(db, 'calls', incoming.id), { status: 'declined' }); incoming = null; $('callModal').classList.remove('on'); }
  else endCall(true);
};
$('bMute').onclick = () => { const t = stream?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; $('bMute').textContent = t.enabled ? '🎙' : '🔇'; } };
$('bCam').onclick = () => { const t = stream?.getVideoTracks()[0]; if (t) { t.enabled = !t.enabled; $('bCam').textContent = t.enabled ? '📷' : '🚫'; } };
$('bCall').onclick = () => startCall(false);
$('bVideo').onclick = () => startCall(true);

/* ===== v3 extras ===== */
const S = (k, d) => { const v = ls('s_' + k); return v == null ? d : v === '1'; };
const setS = (k, v) => ls('s_' + k, v ? '1' : '0');
const prefs = () => document.documentElement.style.setProperty('--fs', ls('s_fs') || '15px');
prefs();

/* wallpaper picker (dim + own photo) */
const WP = ['', '#ece5dd', '#d1f4cc', '#fde68a', '#fbcfe8', '#bfdbfe', '#0f172a', '#064e3b', '#4c1d95', 'linear-gradient(160deg,#ff9a9e,#fad0c4)', 'linear-gradient(160deg,#a18cd1,#fbc2eb)', 'linear-gradient(160deg,#0f2027,#2c5364)', 'linear-gradient(160deg,#f6d365,#fda085)'];
function paintWall() {
  const w = ls('wp') || '', dim = +(ls('wpdim') || 0), img = ls('wpimg');
  const base = w === 'img' && img ? `center/cover url("${img}")` : w;
  let st = $('wpStyle'); if (!st) { st = h('style'); st.id = 'wpStyle'; document.head.append(st); }
  st.textContent = base || dim ? `.msgs{background:linear-gradient(rgba(0,0,0,${dim}),rgba(0,0,0,${dim})),${base || 'var(--bg)'} !important}` : '';
}
paintWall();
function wallPicker() {
  const b = h('div', 'col'), g = h('div', 'wpg');
  WP.forEach((w) => { const s = h('button', 'wps'); s.type = 'button'; s.style.background = w || 'var(--bg)'; s.onclick = () => { ls('wp', w); paintWall(); }; g.append(s); });
  const f = h('input'); f.type = 'file'; f.accept = 'image/*';
  f.onchange = async () => { ls('wpimg', await shrink(f.files[0], 1200, .6)); ls('wp', 'img'); paintWall(); };
  const r = h('input'); r.type = 'range'; r.min = 0; r.max = .7; r.step = .05; r.value = ls('wpdim') || 0;
  r.oninput = () => { ls('wpdim', r.value); paintWall(); };
  b.append(h('small', '', 'Pick a wallpaper'), g, h('small', '', 'Or use your own photo'), f, h('small', '', 'Dim wallpaper'), r);
  modal('🖼 Wallpaper', b, [['Done', () => {}]]);
}

/* polls */
function pollDlg() {
  const q = h('input'), w = h('div', 'col'); q.placeholder = 'Ask a question'; w.append(q);
  const os = [1, 2, 3, 4].map((i) => { const o = h('input'); o.placeholder = 'Option ' + i; w.append(o); return o; });
  modal('📊 Create poll', w, [['Send', async () => {
    const opts = os.map((o) => o.value.trim()).filter(Boolean);
    if (!q.value.trim() || opts.length < 2) { toast('Add a question and at least 2 options', 1); return false; }
    await post({ type: 'poll', text: '📊 ' + q.value.trim(), q: q.value.trim(), opts, votes: {} });
  }], ['Cancel', () => {}, 1]]);
}
function pollEl(m) {
  const w = h('div', 'poll'), v = m.votes || {}, n = Object.values(v), tot = n.length || 1;
  w.append(h('b', '', m.q));
  m.opts.forEach((o, i) => {
    const c = n.filter((x) => x === i).length, b = h('button', 'popt' + (v[me.uid] === i ? ' mine' : '')), bar = h('i');
    bar.style.width = (c / tot) * 100 + '%'; b.append(bar, h('span', '', o), h('span', '', c));
    b.onclick = () => upd(m, { [`votes.${me.uid}`]: i }); w.append(b);
  });
  w.append(h('small', '', n.length + ' vote(s)')); return w;
}
const _bb = bubble;
bubble = (m) => { const d = _bb(m); d.dataset.id = m.id; if (m.type === 'poll' && !m.deleted) d.querySelector(':scope > span:not(.mt)')?.replaceWith(pollEl(m)); return d; };

/* extra menu items */
const clearChat = () => cur && confirm('Clear this chat for you?') && msgs.forEach((m) => upd(m, { deletedFor: arrayUnion(me.uid) }));
const _menu = menu;
menu = (a, items, top) => {
  if (a === bMore) items = [...items.filter((i) => !(i && i[0].includes('wallpaper'))), ['🖼 Wallpaper', wallPicker], ['🧹 Clear chat', clearChat], ['⚙️ Settings', openSettings]];
  if (a === $('bAtt')) items = [...items, ['📊 Poll', pollDlg]];
  return _menu(a, items, top);
};

/* right-click / long-press on a message opens its menu */
$('msgs').addEventListener('contextmenu', (e) => { const m = e.target.closest('.m'); if (m) { e.preventDefault(); m.querySelector('.mm')?.click(); } });
let lp;
$('msgs').addEventListener('touchstart', (e) => { const m = e.target.closest('.m'); if (m) lp = setTimeout(() => m.querySelector('.mm')?.click(), 500); }, { passive: true });
['touchend', 'touchmove'].forEach((t) => $('msgs').addEventListener(t, () => clearTimeout(lp), { passive: true }));

/* settings (WhatsApp style) */
function blockedList() {
  const l = h('div', 'setl'), bl = myDoc().blocked || [];
  if (!bl.length) l.append(h('p', 'pv', 'No blocked contacts.'));
  bl.forEach((id) => {
    const r = h('div', 'srow'), b = h('button', 'mini', 'Unblock');
    b.onclick = () => { updateDoc(doc(db, 'users', me.uid), { blocked: arrayRemove(id) }); r.remove(); };
    r.append(h('span', '', U(id).name), b); l.append(r);
  });
  modal('🚫 Blocked contacts', l, [['Close', () => {}, 1]]);
}
function openSettings() {
  const b = h('div', 'setl');
  const sec = (t) => b.append(h('h4', 'sec', t));
  const tog = (t, k, d) => { const r = h('label', 'srow'), i = h('input'); i.type = 'checkbox'; i.checked = S(k, d); i.onchange = () => setS(k, i.checked); r.append(h('span', '', t), i, h('i', 'sl')); b.append(r); };
  const act = (t, f) => { const r = h('button', 'srow', t); r.onclick = () => { o.remove(); f(); }; b.append(r); };
  sec('Account'); act('👤 Edit profile & photo', () => { $('sName').value = myName(); $('sAbout').value = myDoc().about || 'Available on Gupshup'; $('sheet').classList.add('on'); });
  sec('Chats'); tog('Enter key sends message', 'enter', true);
  act('🖼 Wallpaper', wallPicker);
  act('🔠 Text size (tap to change)', () => { const z = ['14px', '15px', '17px', '19px']; ls('s_fs', z[(z.indexOf(ls('s_fs') || '15px') + 1) % z.length]); prefs(); toast('Text size: ' + ls('s_fs')); });
  act('🌙 Dark / light mode', () => $('bTheme').click());
  sec('Privacy'); tog('Read receipts (blue ticks)', 'receipts', true); tog('Typing indicator', 'typing', true);
  act(`🚫 Blocked contacts (${(myDoc().blocked || []).length})`, blockedList);
  sec('Notifications'); tog('Message sound', 'sound', true); tog('Effects (confetti, hearts)', 'fx', true);
  sec('Help'); act('ℹ️ About Gupshup', () => toast('Gupshup v3 · made with Firebase'));
  act('🚪 Log out', () => $('sOut').click());
  const o = modal('⚙️ Settings', b, [['Close', () => {}, 1]]);
}
$('bSet').onclick = openSettings;
$('inp').onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey && S('enter', true)) { e.preventDefault(); sendClick(); } };

/* privacy switches */
const _ms = markSeen; markSeen = () => S('receipts', true) && _ms();
const _tp = typingPing; typingPing = () => S('typing', true) && _tp();

/* effects + sound on new messages */
const FX = [[/🎉|congrat|mubarak/i, ['🎉', '🎊', '✨']], [/❤️|💕|love/i, ['❤️', '💖']], [/🔥/, ['🔥']], [/happy birthday|🎂/i, ['🎂', '🎈']]];
function fx(t) {
  if (!S('fx', true)) return; const f = FX.find(([r]) => r.test(t)); if (!f) return;
  for (let i = 0; i < 28; i++) {
    const e = h('span', 'fx', f[1][i % f[1].length]);
    e.style.cssText = `left:${Math.random() * 100}vw;animation-delay:${Math.random() * .8}s;font-size:${18 + Math.random() * 22}px`;
    document.body.append(e); setTimeout(() => e.remove(), 3500);
  }
}
function beep() {
  try { const c = new (window.AudioContext || webkitAudioContext)(), o = c.createOscillator(), g = c.createGain(); o.connect(g); g.connect(c.destination); o.frequency.value = 880; g.gain.value = .08; o.start(); o.stop(c.currentTime + .12); } catch {}
}
const _om = onMsgs;
onMsgs = (s) => {
  s.docChanges().forEach((ch) => {
    const d = ch.doc.data({ serverTimestamps: 'estimate' });
    if (ch.type === 'added' && Date.now() - (d.createdAt?.toMillis?.() || 0) < 3000) { fx(d.text || ''); if (d.from !== me.uid && S('sound', true)) beep(); }
  });
  _om(s);
};

import { deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const myUp = (o) => setDoc(doc(db, 'users', me.uid), o, { merge: true });
const favs = () => myDoc().favs || [];
const LIM = 600000; // ~600KB (Firestore doc limit 1MB, base64 bada ho jata hai)
const mkIn = (acc) => { const i = h('input'); i.type = 'file'; i.accept = acc; i.hidden = true; document.body.append(i); return i; };

/* ---------- 1. LANGUAGE ---------- */
const I18N = {
  en: { chats: 'Chats', people: 'People', calls: 'Calls', channels: 'Channels', search: '🔍  Search chats or people...', msg: 'Type a message...', my: 'My Status', login: 'Login', signup: 'Sign up' },
  rur: { chats: 'Chats', people: 'Log', calls: 'Calls', channels: 'Channels', search: '🔍  Chats ya log dhoondein...', msg: 'Message likhein...', my: 'Mera Status', login: 'Login', signup: 'Sign up' },
  ur: { chats: 'چیٹس', people: 'لوگ', calls: 'کالز', channels: 'چینلز', search: '🔍  تلاش کریں...', msg: 'پیغام لکھیں...', my: 'میرا اسٹیٹس', login: 'لاگ اِن', signup: 'سائن اپ' },
  hi: { chats: 'चैट', people: 'लोग', calls: 'कॉल', channels: 'चैनल', search: '🔍  खोजें...', msg: 'संदेश लिखें...', my: 'मेरा स्टेटस', login: 'लॉगिन', signup: 'साइन अप' },
  ar: { chats: 'الدردشات', people: 'الأشخاص', calls: 'المكالمات', channels: 'القنوات', search: '🔍  بحث...', msg: 'اكتب رسالة...', my: 'حالتي', login: 'دخول', signup: 'تسجيل' }
};
const LNAME = { en: 'English', rur: 'Roman Urdu', ur: 'اردو', hi: 'हिन्दी', ar: 'العربية' };
function applyLang() {
  const l = ls('lang') || 'en', t = I18N[l] || I18N.en, set = (s, x) => { const e = document.querySelector(s); if (e) e.textContent = x; };
  document.documentElement.lang = l === 'rur' ? 'ur' : l;
  ['chats', 'people', 'calls', 'channels'].forEach((k) => set(`.tabs [data-t=${k}]`, t[k]));
  set('#btnMyStory small', t.my); set('#tabLogin', t.login); set('#tabSignup', t.signup);
  $('q').placeholder = t.search; if (!rec) $('inp').placeholder = t.msg; $('inp').dir = 'auto'; $('q').dir = 'auto';
}
function langDlg() {
  const b = h('div', 'mrow'); let o;
  Object.entries(LNAME).forEach(([k, n]) => { const x = h('button', 'btn rip alt', n + ((ls('lang') || 'en') === k ? ' ✓' : '')); x.onclick = () => { ls('lang', k); applyLang(); o.remove(); toast('🌐 ' + n); }; b.append(x); });
  o = modal('🌐 Language', b, [['Close', () => {}, 1]]);
}

/* ---------- 2. PYARAY WALLPAPERS ---------- */
const pat = (e, bg) => {
  const s = `<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><text x='8' y='38' font-size='26' opacity='.6'>${e[0]}</text><text x='68' y='62' font-size='22' opacity='.6'>${e[1]}</text><text x='28' y='108' font-size='24' opacity='.6'>${e[2]}</text></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(s)}") 0 0/110px 110px ${bg}`;
};
WP.push(
  pat(['🌸', '🎀', '💗'], '#ffe4ef'), pat(['🐱', '🐾', '🧶'], '#fff0d9'), pat(['🌙', '⭐', '✨'], '#2a2147'),
  pat(['🐳', '🌊', '🐚'], '#d6f1ff'), pat(['🍓', '🍒', '🍰'], '#ffdde3'), pat(['🐰', '🥕', '🌼'], '#e8ffe0'),
  pat(['☁️', '🌈', '💫'], '#e6e0ff'), pat(['🐼', '🎋', '🍃'], '#e4f5e4'), pat(['🦄', '🍭', '💖'], '#f6dcff'),
  pat(['🌻', '🐝', '🍯'], '#fff5b8'), pat(['🧸', '🎈', '🍪'], '#ffe9d2'), pat(['🦋', '🌷', '🌿'], '#e9f9f0')
);
paintWall();

/* ---------- 3. CAMERA ---------- */
function camera(cb, max = 900) {
  const v = h('video'); v.autoplay = true; v.playsInline = true; v.muted = true; v.style.cssText = 'width:100%;border-radius:14px;background:#000';
  let st, fm = 'user';
  const stop = () => st && st.getTracks().forEach((t) => t.stop());
  const start = async () => { stop(); try { st = await navigator.mediaDevices.getUserMedia({ video: { facingMode: fm } }); v.srcObject = st; } catch { o.remove(); toast('Camera ki permission do', 1); } };
  const o = modal('📷 Camera', v, [
    ['📸 Capture', () => {
      if (!v.videoWidth) { toast('Camera ready nahi hai', 1); return false; }
      const c = document.createElement('canvas'), k = Math.min(1, max / Math.max(v.videoWidth, v.videoHeight));
      c.width = v.videoWidth * k; c.height = v.videoHeight * k; c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
      stop(); cb(c.toDataURL('image/jpeg', .72));
    }],
    ['🔄 Flip camera', () => { fm = fm === 'user' ? 'environment' : 'user'; start(); return false; }, 1],
    ['Cancel', () => stop(), 1]
  ]);
  o.addEventListener('click', (e) => { if (e.target === o) stop(); });
  start();
}

/* ---------- 4. VIDEO + DOCUMENTS ---------- */
const inVid = mkIn('video/*'), inDoc = mkIn('.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip');
inVid.onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > LIM) return toast('Video bohat bari hai (max ~600KB). Chhoti clip bhejo', 1);
  post({ type: 'video', text: '🎥 Video', data: await toURL(f) });
};
inDoc.onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  if (f.size > LIM) return toast('File bohat bari hai (max ~600KB)', 1);
  post({ type: 'doc', text: '📄 ' + f.name, name: f.name, size: f.size, data: await toURL(f) });
};
const _b2 = bubble;
bubble = (m) => {
  const d = _b2(m), sp = ':scope > span:not(.mt)';
  if (!m.deleted) {
    if (m.type === 'video') { const v = h('video', 'pic'); v.controls = true; v.preload = 'metadata'; v.src = m.data; d.querySelector(sp)?.replaceWith(v); }
    else if (m.type === 'doc') {
      const a = h('a', 'docbox'); a.href = m.data; a.download = m.name || 'file';
      a.append(h('span', '', '📄'), h('span', 'dn', m.name || 'Document'), h('small', '', Math.max(1, Math.round((m.size || 0) / 1024)) + ' KB ⬇'));
      d.querySelector(sp)?.replaceWith(a);
    }
    if (m.expireAt) d.querySelector('.mt')?.prepend(h('span', '', '⏳'));
  }
  return d;
};

/* ---------- 5. DISAPPEARING MESSAGES ---------- */
function disDlg() {
  if (!cur) return;
  const b = h('div', 'mrow'); let o;
  [['Off', 0], ['24 hours', 864e5], ['7 days', 6048e5], ['90 days', 7776e6]].forEach(([t, v]) => {
    const x = h('button', 'btn rip alt', t + ((cur.disappear || 0) === v ? ' ✓' : ''));
    x.onclick = async () => { await setDoc(doc(db, 'chats', cur.id), { disappear: v, participants: cur.participants, isGroup: !!cur.isGroup }, { merge: true }); cur = { ...cur, disappear: v }; o.remove(); toast(v ? '⏳ Disappearing ON' : 'Disappearing OFF'); };
    b.append(x);
  });
  o = modal('⏳ Disappearing messages', b, [['Close', () => {}, 1]]);
}
const _post = post;
post = async (d, t = cur) => {
  if (!t) return;
  if (t.isChannel && t.admin !== me.uid) return toast('Sirf channel admin post kar sakta hai', 1);
  return _post({ ...d, ...(t.disappear ? { expireAt: Date.now() + t.disappear } : {}) }, t);
};
setInterval(() => {
  if (!cur) return; const now = Date.now();
  msgs.filter((m) => m.expireAt && m.expireAt < now).forEach((m) => {
    els.get(m.id)?.remove(); els.delete(m.id); msgs = msgs.filter((x) => x.id !== m.id);
    if (m.from === me.uid) deleteDoc(doc(db, 'chats', cur.id, 'messages', m.id)).catch(() => {});
  });
}, 2000);

/* ---------- 6. ABOUT + AVATAR + PROFILE CAMERA ---------- */
const ABOUTS = ['Available', 'Busy', 'At school', 'At work', 'In a meeting', 'Sleeping 😴', 'Battery about to die 🔋', 'Urgent calls only', 'At the gym 💪', 'Sirf chat, call nahi 💬'];
const AVS = [...'🦊🐼🐱🐶🐰🐻🦁🐯🐸🐵🦄🐧🐨🐙🦋🐳🌸🍓🚀👾🤖👻🎃🧸'];
const AVC = ['#ffd1e8', '#d1f0ff', '#e5ffd1', '#fff3b0', '#e2d1ff', '#ffd9b3'];
function avatarDlg() {
  const g = h('div', 'avg'); let o;
  AVS.forEach((e, i) => {
    const b = h('button', 'avi', e); b.style.background = AVC[i % AVC.length];
    b.onclick = () => {
      const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
      x.fillStyle = AVC[i % AVC.length]; x.fillRect(0, 0, 128, 128); x.font = '84px serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(e, 64, 72);
      newPhoto = c.toDataURL('image/jpeg', .85); o.remove(); toast('Avatar select ho gaya, ab Save dabao');
    };
    g.append(b);
  });
  o = modal('🎭 Choose avatar', g, [['Cancel', () => {}, 1]]);
}
(() => {
  const chips = h('div', 'chips');
  ABOUTS.forEach((t) => { const c = h('button', 'mini', t); c.type = 'button'; c.onclick = () => { $('sAbout').value = t; }; chips.append(c); });
  $('sAbout').closest('label').after(chips);
  const row = h('div', 'chips'), a = h('button', 'mini', '🎭 Avatar'), c = h('button', 'mini', '📷 Take photo');
  a.type = c.type = 'button'; a.onclick = avatarDlg; c.onclick = () => camera((u) => { newPhoto = u; toast('Photo ready, Save dabao'); }, 160);
  row.append(a, c); $('sSave').before(row);
})();
function infoDlg() {
  if (!cur) return; const b = h('div', 'col');
  if (cur.isGroup) { b.append(h('p', '', (cur.isChannel ? '📢 Channel' : '👥 Group') + ' · ' + cur.participants.length + ' members'), ...cur.participants.map((p) => h('small', '', '• ' + U(p).name))); }
  else {
    const u = U(other(cur)), av = avEl(u.name, u.photo, 'av'); av.style.cssText += ';width:90px;height:90px;font-size:36px;margin:auto';
    b.append(av, h('b', '', u.name), h('small', '', 'About: ' + (u.about || 'Hey there!')), h('small', '', u.hideSeen ? 'Last seen hidden' : isOn(u) ? 'Online' : u.lastSeen ? 'Last seen ' + hm(u.lastSeen) : ''));
  }
  modal(cur.isGroup ? 'Info' : 'Contact info', b, [['Close', () => {}, 1]]);
}

/* ---------- 7. STATUS: favourites / hide from / only share with ---------- */
const vis = (s) => { if (s.uid === me.uid) return true; const a = s.audience || 'all', l = s.list || []; return a === 'all' || (a === 'except' && !l.includes(me.uid)) || (a === 'only' && l.includes(me.uid)); };
renderStories = () => {
  const box = $('storiesList'); box.replaceChildren(); const fv = favs(), by = {};
  statuses.filter((s) => Date.now() - s.createdAt < 864e5 && vis(s)).forEach((s) => (by[s.uid] = by[s.uid] || []).push(s));
  Object.entries(by).filter(([u]) => u !== me.uid).sort(([a], [b]) => fv.includes(b) - fv.includes(a)).forEach(([u, arr]) => {
    const unseen = arr.some((s) => !s.viewers?.[me.uid]), it = h('div', 'story-item');
    it.append(avEl(U(u).name, U(u).photo, 'av story-ring' + (unseen ? '' : ' seen')), h('small', '', (fv.includes(u) ? '⭐' : '') + U(u).name));
    it.onclick = () => viewStories(arr); box.append(it);
  });
};
function pickList(sel) {
  const l = h('div', 'fl');
  users.filter((u) => u.id !== me.uid).forEach((u) => {
    const c = h('input'); c.type = 'checkbox'; c.checked = sel.has(u.id); c.onchange = () => (c.checked ? sel.add(u.id) : sel.delete(u.id));
    const r = mkRow(avEl(u.name, u.photo), u.name, ''); r.prepend(c); l.append(r);
  });
  return l;
}
function favDlg() {
  const sel = new Set(favs());
  modal('⭐ Favourites', pickList(sel), [['Save', async () => { await myUp({ favs: [...sel] }); toast('Favourites save ⭐'); }], ['Cancel', () => {}, 1]]);
}
addStatus = function () {
  const ta = h('textarea'); ta.placeholder = "What's on your mind?";
  const col = h('input'); col.type = 'color'; col.value = '#ff3d81';
  const f = h('input'); f.type = 'file'; f.accept = 'image/*'; let cam = null;
  const cb = h('button', 'mini', '📷 Camera se photo'); cb.type = 'button'; cb.onclick = () => camera((u) => { cam = u; toast('Photo ready 📸'); }, 800);
  const aud = h('select'); [['all', '👥 Everyone'], ['except', '🙈 Hide from… (everyone except)'], ['only', '🎯 Only share with…'], ['favs', '⭐ Favourites only']].forEach(([v, t]) => { const o = h('option', '', t); o.value = v; aud.append(o); });
  aud.value = ls('stAud') || 'all';
  let sel; try { sel = new Set(JSON.parse(ls('stList') || '[]')); } catch { sel = new Set(); }
  const pk = h('div'), fill = () => { pk.replaceChildren(); if (['except', 'only'].includes(aud.value)) pk.append(pickList(sel)); };
  aud.onchange = fill; fill();
  const fb = h('button', 'mini', '⭐ Manage favourites'); fb.type = 'button'; fb.onclick = favDlg;
  const b = h('div', 'col'); b.append(ta, col, f, cb, h('small', '', 'Ye status kaun dekh sakta hai?'), aud, pk, fb);
  modal('New status', b, [['Post', async () => {
    const t = ta.value.trim(), fl = f.files[0], a = aud.value;
    if (!t && !fl && !cam) { toast('Text ya photo daalo', 1); return false; }
    if (a === 'favs' && !favs().length) { toast('Pehle favourites chuno ⭐', 1); return false; }
    if ((a === 'only' || a === 'except') && !sel.size) { toast('Kam az kam 1 contact chuno', 1); return false; }
    const data = cam || (fl ? await shrink(fl, 800, .7) : '');
    await addDoc(collection(db, 'statuses'), { uid: me.uid, type: data ? 'image' : 'text', text: t, data, bg: col.value, createdAt: Date.now(), viewers: {}, audience: a === 'favs' ? 'only' : a, list: a === 'favs' ? favs() : [...sel] });
    ls('stAud', a); ls('stList', JSON.stringify([...sel])); toast('Status posted');
  }], ['Cancel', () => {}, 1]]);
};

/* ---------- 8. LINKED DEVICES ---------- */
let devId = ls('devId'); if (!devId) { devId = (crypto.randomUUID ? crypto.randomUUID() : Date.now() + '' + Math.random()).slice(0, 12); ls('devId', devId); }
const devName = () => { const u = navigator.userAgent, os = /Android/.test(u) ? 'Android' : /iPhone|iPad/.test(u) ? 'iOS' : /Windows/.test(u) ? 'Windows' : /Mac/.test(u) ? 'Mac' : /Linux/.test(u) ? 'Linux' : 'Device', br = /Edg/.test(u) ? 'Edge' : /Chrome/.test(u) ? 'Chrome' : /Firefox/.test(u) ? 'Firefox' : /Safari/.test(u) ? 'Safari' : 'Browser'; return br + ' · ' + os; };
function devicesDlg() {
  const l = h('div', 'setl'), body = h('div', 'col');
  const un = onSnapshot(collection(db, 'users', me.uid, 'devices'), (s) => {
    l.replaceChildren();
    s.docs.forEach((d) => {
      const x = d.data(), r = h('div', 'srow'); r.append(h('span', '', (d.id === devId ? '📍 Ye device — ' : '💻 ') + x.name + ' · ' + hm(x.lastActive || 0) + (x.revoked ? ' (logged out)' : '')));
      if (d.id !== devId && !x.revoked) { const b = h('button', 'mini', 'Log out'); b.onclick = () => updateDoc(d.ref, { revoked: true }); r.append(b); }
      l.append(r);
    });
  });
  const cp = h('button', 'mini', '🔗 App link copy karo'); cp.onclick = () => { navigator.clipboard?.writeText(location.href.split('#')[0]); toast('Link copy ho gaya'); };
  body.append(h('small', '', 'Naya device link karne ke liye: us device pe ye app kholo aur isi account se login karo. Woh yahan list mein aa jayega, aur yahan se kisi bhi device ko remotely log out kar sakte ho.'), cp, l);
  modal('🔗 Linked devices', body, [['Close', () => un(), 1]]);
}

/* ---------- 9. NOTIFICATIONS (browser) ---------- */
const lastN = {};
function notifyInit() {
  sub(query(collection(db, 'chats'), where('participants', 'array-contains', me.uid)), (s) => s.docChanges().forEach((ch) => {
    const c = { id: ch.doc.id, ...ch.doc.data() }, prev = lastN[c.id]; lastN[c.id] = c.lastAt || 0;
    if (prev == null || ch.type === 'removed') return;
    if (c.lastAt > prev && c.lastFrom && c.lastFrom !== me.uid && S('notif', false) && 'Notification' in window && Notification.permission === 'granted' && (document.hidden || !cur || cur.id !== c.id) && !(myDoc().muted || []).includes(c.id))
      new Notification(cname(c), { body: ls('lock_' + c.id) ? 'New message' : (c.last || 'New message'), tag: c.id });
  }));
}

/* ---------- 10. CHANNELS + COMMUNITIES ---------- */
let chanDir = [], comms = [];
const tb = h('button', '', 'Channels'); tb.dataset.t = 'channels'; $('q').closest('.sq').nextElementSibling.append(tb);
tb.onclick = () => { document.querySelectorAll('.tabs button').forEach((x) => x.classList.remove('on')); tb.classList.add('on'); tab = 'channels'; renderList(); };
const _rl = renderList; renderList = () => (tab === 'channels' ? renderChannels() : _rl());
const _go = go; go = (c) => { _go(c); $('composer').style.display = c.isChannel && c.admin !== me.uid ? 'none' : ''; };
function renderChannels() {
  const box = $('list'), q = $('q').value.toLowerCase(); box.replaceChildren();
  const a = mkRow(avEl('+'), 'New channel', 'Followers ko updates broadcast karo'); a.onclick = newChannel;
  const b = mkRow(avEl('🏘'), 'New community', 'Groups + channels ek jagah'); b.onclick = newCommunity;
  box.append(a, b, h('h4', 'sec', 'Channels'));
  chanDir.filter((c) => c.name.toLowerCase().includes(q)).forEach((c) => {
    const fol = chats.some((x) => x.id === c.id), r = mkRow(avEl(c.name), '📢 ' + c.name, (c.desc || '') + ' · ' + (c.followers || 0) + ' followers');
    const bt = h('button', 'mini', fol ? 'Unfollow' : 'Follow');
    bt.onclick = async (e) => {
      e.stopPropagation();
      await setDoc(doc(db, 'chats', c.id), { participants: fol ? arrayRemove(me.uid) : arrayUnion(me.uid) }, { merge: true });
      updateDoc(doc(db, 'channels', c.id), { followers: increment(fol ? -1 : 1) }).catch(() => {});
    };
    r.append(bt); r.onclick = () => { const ch = chats.find((x) => x.id === c.id); ch ? openChat(ch) : toast('Pehle Follow karo', 1); }; box.append(r);
  });
  box.append(h('h4', 'sec', 'Communities'));
  comms.filter((c) => c.name.toLowerCase().includes(q)).forEach((c) => { const r = mkRow(avEl(c.name), '🏘 ' + c.name, (c.desc || '') + ' · ' + (c.members || []).length + ' members'); r.onclick = () => commDlg(c); box.append(r); });
  if (!chanDir.length && !comms.length) box.append(h('p', 'pv', 'Abhi koi channel/community nahi. Pehla bana do! 🎉'));
}
function newChannel() {
  const n = h('input'), d = h('input'), b = h('div', 'col'); n.placeholder = 'Channel name'; d.placeholder = 'Description'; b.append(n, d);
  modal('📢 New channel', b, [['Create', async () => {
    const nm = n.value.trim(); if (!nm) { toast('Naam likho', 1); return false; }
    const ref = doc(collection(db, 'chats'));
    await setDoc(ref, { participants: [me.uid], isGroup: true, isChannel: true, name: nm, admin: me.uid, last: 'Channel created', lastAt: Date.now(), unread: {} });
    await setDoc(doc(db, 'channels', ref.id), { name: nm, desc: d.value.trim(), admin: me.uid, followers: 1, createdAt: Date.now() }); toast('Channel ban gaya ✅');
  }], ['Cancel', () => {}, 1]]);
}
function newCommunity() {
  const n = h('input'), d = h('input'), b = h('div', 'col'); n.placeholder = 'Community name'; d.placeholder = 'Description'; b.append(n, d);
  modal('🏘 New community', b, [['Create', async () => {
    const nm = n.value.trim(); if (!nm) { toast('Naam likho', 1); return false; }
    const ref = doc(collection(db, 'chats')), an = nm + ' · Announcements';
    await setDoc(ref, { participants: [me.uid], isGroup: true, isChannel: true, name: an, admin: me.uid, last: 'Community created', lastAt: Date.now(), unread: {} });
    await setDoc(doc(collection(db, 'communities')), { name: nm, desc: d.value.trim(), admin: me.uid, members: [me.uid], items: [{ id: ref.id, name: an, ann: true }], createdAt: Date.now() }); toast('Community ban gayi ✅');
  }], ['Cancel', () => {}, 1]]);
}
function commDlg(c) {
  const mem = (c.members || []).includes(me.uid), adm = c.admin === me.uid, l = h('div', 'fl'), btns = [];
  (c.items || []).forEach((i) => { const r = mkRow(avEl(i.name), i.name, i.ann ? '📢 Announcements' : '👥 Group'); r.onclick = () => { if (!mem) return toast('Pehle community join karo', 1); const ch = chats.find((x) => x.id === i.id); ch ? openChat(ch) : toast('Thori der baad try karo', 1); }; l.append(r); });
  if (!mem) btns.push(['Join community', async () => { await updateDoc(doc(db, 'communities', c.id), { members: arrayUnion(me.uid) }); for (const i of c.items || []) await setDoc(doc(db, 'chats', i.id), { participants: arrayUnion(me.uid) }, { merge: true }); toast('Joined ✅'); }]);
  else if (!adm) btns.push(['Leave', async () => { await updateDoc(doc(db, 'communities', c.id), { members: arrayRemove(me.uid) }); for (const i of c.items || []) await setDoc(doc(db, 'chats', i.id), { participants: arrayRemove(me.uid) }, { merge: true }); }, 1]);
  if (adm) btns.push(['➕ Add my group', () => {
    const g = h('div', 'fl'); let o;
    chats.filter((x) => x.isGroup && !x.isChannel && x.admin === me.uid && !(c.items || []).some((i) => i.id === x.id)).forEach((x) => {
      const r = mkRow(avEl(x.name), x.name, ''); r.onclick = async () => {
        await updateDoc(doc(db, 'communities', c.id), { items: arrayUnion({ id: x.id, name: x.name }) });
        if ((c.members || []).length) await setDoc(doc(db, 'chats', x.id), { participants: arrayUnion(...c.members) }, { merge: true });
        o.remove(); toast('Group add ho gaya');
      }; g.append(r);
    });
    if (!g.children.length) g.append(h('p', 'pv', 'Aap ka admin wala koi group nahi mila.'));
    o = modal('Add group', g, [['Cancel', () => {}, 1]]); return false;
  }]);
  btns.push(['Close', () => {}, 1]); modal('🏘 ' + c.name, l, btns);
}

/* ---------- 11. AI CHATBOT ---------- */
function offlineAI(t) {
  const s = t.toLowerCase();
  if (/salam|hello|\bhi\b|hey/.test(s)) return 'Walaikum Assalam! Kaise help karun? 😊';
  if (/time|waqt|baje/.test(s)) return '🕐 ' + new Date().toLocaleTimeString();
  if (/date|tareekh|aaj/.test(s)) return '📅 ' + new Date().toLocaleDateString();
  if (/joke|latifa|mazah/.test(s)) return ['Teacher: Tum late kyun ho? Student: Sir, board pe likha tha "School ahead, go slow" 😂', 'Doctor: Aap ko araam chahiye. Patient: Wahi to nahi mil raha 😅'][Math.floor(Math.random() * 2)];
  const m = s.replace(/[^0-9+\-*/(). ]/g, '').trim();
  if (/^[0-9+\-*/(). ]+$/.test(m) && /[+\-*/]/.test(m)) { try { return '= ' + Function('"use strict";return (' + m + ')')(); } catch {} }
  return 'AI server abhi available nahi 😅 — thori der baad phir try karo.';
}
async function aiReply(t, hist) {
  try {
    const ctx = hist.slice(-9, -1).map((x) => (x.r === 'me' ? 'User: ' : 'AI: ') + x.t).join('\n');
    const sys = 'You are Gupshup AI, a friendly short-answer chat assistant. Reply in the same language/script as the user (Roman Urdu if they write Roman Urdu).';
    const r = await fetch('https://text.pollinations.ai/' + encodeURIComponent((ctx ? ctx + '\n' : '') + 'User: ' + t) + '?system=' + encodeURIComponent(sys), { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw 0; const x = (await r.text()).trim(); if (x) return x;
  } catch {}
  return offlineAI(t);
}
function aiDlg() {
  const w = h('div', 'aiwin'), list = h('div', 'ailist'), inp = h('input'); inp.placeholder = 'Gupshup AI se kuch bhi poocho...';
  let hist; try { hist = JSON.parse(ls('ai_hist') || '[]'); } catch { hist = []; }
  const add = (r, t) => { const b = h('div', 'aib ' + r, t); list.append(b); list.scrollTop = list.scrollHeight; return b; };
  hist.forEach((x) => add(x.r, x.t)); if (!hist.length) add('bot', 'Assalam o Alaikum! 👋 Main Gupshup AI hoon. Mujhse kuch bhi poocho.');
  const send = async () => {
    const t = inp.value.trim(); if (!t) return; inp.value = ''; add('me', t); hist.push({ r: 'me', t });
    const b = add('bot', '…'), a = await aiReply(t, hist); b.textContent = a; hist.push({ r: 'bot', t: a }); hist = hist.slice(-30); ls('ai_hist', JSON.stringify(hist));
  };
  inp.onkeydown = (e) => { if (e.key === 'Enter') send(); };
  w.append(list, inp);
  modal('🤖 Gupshup AI', w, [['Send', () => { send(); return false; }], ['🧹 Clear', () => { hist = []; ls('ai_hist', '[]'); list.replaceChildren(); return false; }, 1], ['Close', () => {}, 1]]);
}

/* ---------- 12. OFFLINE GAMES ---------- */
function ttt(box, back) {
  box.replaceChildren(); const b = Array(9).fill(''), g = h('div', 'gg3'), st = h('p', 'pv', 'Aap: ❌ · Computer: ⭕'); let over = false;
  const L = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]], win = (p) => L.some((l) => l.every((i) => b[i] === p));
  const end = () => { if (win('❌')) { st.textContent = '🎉 Aap jeet gaye!'; over = true; } else if (win('⭕')) { st.textContent = '😎 Computer jeet gaya'; over = true; } else if (!b.includes('')) { st.textContent = '🤝 Draw'; over = true; } return over; };
  const pick = (p) => { for (const l of L) { const e = l.filter((k) => b[k] === ''), m = l.filter((k) => b[k] === p); if (e.length === 1 && m.length === 2) return e[0]; } return -1; };
  const draw = () => { g.replaceChildren(); b.forEach((v, i) => { const c = h('button', 'gc', v); c.onclick = () => play(i); g.append(c); }); };
  const play = (i) => {
    if (over || b[i]) return; b[i] = '❌';
    if (!end()) { let k = pick('⭕'); if (k < 0) k = pick('❌'); if (k < 0 && b[4] === '') k = 4; if (k < 0) { const e = b.map((v, x) => (v === '' ? x : -1)).filter((x) => x >= 0); k = e[Math.floor(Math.random() * e.length)]; } b[k] = '⭕'; end(); }
    draw();
  };
  draw(); const rs = h('button', 'mini', '🔄 Restart'); rs.onclick = () => ttt(box, back); box.append(st, g, rs, back);
}
function memGame(box, back) {
  box.replaceChildren(); const E = [...'🐱🐶🦊🐼🐸🦄🍓🍩'], d = [...E, ...E].sort(() => Math.random() - .5), st = h('p', 'pv', 'Moves: 0'), g = h('div', 'gg4'); let o = [], ok = 0, mv = 0, lock = false;
  d.forEach((e) => {
    const c = h('button', 'gc', '❓');
    c.onclick = () => {
      if (lock || c.dataset.o) return; c.textContent = e; c.dataset.o = 1; o.push([c, e]);
      if (o.length === 2) {
        mv++; st.textContent = 'Moves: ' + mv; lock = true;
        if (o[0][1] === o[1][1]) { ok++; o = []; lock = false; if (ok === 8) st.textContent = '🎉 Jeet gaye! Moves: ' + mv; }
        else setTimeout(() => { o.forEach(([x]) => { x.textContent = '❓'; delete x.dataset.o; }); o = []; lock = false; }, 700);
      }
    };
    g.append(c);
  });
  const rs = h('button', 'mini', '🔄 Restart'); rs.onclick = () => memGame(box, back); box.append(st, g, rs, back);
}
function snake(box, back) {
  box.replaceChildren(); const cv = document.createElement('canvas'); cv.width = cv.height = 260; const x = cv.getContext('2d'), N = 13, S2 = 20, st = h('p', 'pv', 'Score 0 · Arrow keys / buttons');
  let sn = [[6, 6]], dir = [1, 0], f = [3, 3], sc = 0, dead = false;
  const set = (m) => { if (m[0] + dir[0] || m[1] + dir[1]) dir = m; };
  const key = (e) => { const m = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[e.key]; if (m) { set(m); e.preventDefault(); } };
  document.addEventListener('keydown', key);
  const iv = setInterval(() => {
    if (!document.body.contains(cv)) { clearInterval(iv); document.removeEventListener('keydown', key); return; }
    if (dead) return; const hd = [sn[0][0] + dir[0], sn[0][1] + dir[1]];
    if (hd[0] < 0 || hd[1] < 0 || hd[0] >= N || hd[1] >= N || sn.some((p) => p[0] === hd[0] && p[1] === hd[1])) { dead = true; st.textContent = '💀 Game over · Score ' + sc; return; }
    sn.unshift(hd);
    if (hd[0] === f[0] && hd[1] === f[1]) { sc++; st.textContent = 'Score ' + sc; f = [Math.floor(Math.random() * N), Math.floor(Math.random() * N)]; } else sn.pop();
    x.fillStyle = '#fffaf0'; x.fillRect(0, 0, 260, 260); x.font = '18px serif'; x.fillText('🍎', f[0] * S2, f[1] * S2 + 17); x.fillStyle = '#ff3d81'; sn.forEach((p) => x.fillRect(p[0] * S2 + 1, p[1] * S2 + 1, S2 - 2, S2 - 2));
  }, 140);
  const pad = h('div', 'chips'); [['⬅️', [-1, 0]], ['⬆️', [0, -1]], ['⬇️', [0, 1]], ['➡️', [1, 0]]].forEach(([t, m]) => { const b = h('button', 'mini', t); b.onclick = () => set(m); pad.append(b); });
  const rs = h('button', 'mini', '🔄 Restart'); rs.onclick = () => snake(box, back); box.append(st, cv, pad, rs, back);
}
function gamesDlg() {
  const box = h('div', 'col'), back = h('button', 'mini', '← Games'); back.onclick = () => menu2();
  const menu2 = () => { box.replaceChildren(); [['❌⭕ Tic Tac Toe', ttt], ['🃏 Memory Match', memGame], ['🐍 Snake', snake]].forEach(([t, f]) => { const b = h('button', 'btn rip alt', t); b.onclick = () => f(box, back); box.append(b); }); };
  menu2(); modal('🎮 Games (offline)', box, [['Close', () => {}, 1]]);
}

/* ---------- 13. SETTINGS (naya, poora) ---------- */
openSettings = function () {
  const b = h('div', 'setl'), sec = (t) => b.append(h('h4', 'sec', t));
  const tog = (t, k, d, cb) => { const r = h('label', 'srow'), i = h('input'); i.type = 'checkbox'; i.checked = S(k, d); i.onchange = () => { setS(k, i.checked); cb && cb(i.checked); }; r.append(h('span', '', t), i, h('i', 'sl')); b.append(r); };
  const dbt = (t, f) => { const r = h('label', 'srow'), i = h('input'); i.type = 'checkbox'; i.checked = !!myDoc()[f]; i.onchange = () => myUp({ [f]: i.checked }); r.append(h('span', '', t), i, h('i', 'sl')); b.append(r); };
  const act = (t, f) => { const r = h('button', 'srow', t); r.onclick = () => { o.remove(); f(); }; b.append(r); };
  sec('Account');
  act('👤 Edit profile, About, avatar & photo', () => { $('sName').value = myName(); $('sAbout').value = myDoc().about || 'Available on Gupshup'; $('sheet').classList.add('on'); });
  act('🔗 Linked devices', devicesDlg); act('⭐ Favourites', favDlg);
  sec('Chats');
  tog('Enter key sends message', 'enter', true); act('🖼 Wallpaper & themes', wallPicker);
  act('🔠 Text size (tap to change)', () => { const z = ['14px', '15px', '17px', '19px']; ls('s_fs', z[(z.indexOf(ls('s_fs') || '15px') + 1) % z.length]); prefs(); toast('Text size: ' + ls('s_fs')); });
  act('🌙 Dark / light mode', () => $('bTheme').click()); act('🌐 Language: ' + LNAME[ls('lang') || 'en'], langDlg);
  sec('Privacy');
  dbt('🙈 Last seen & online ', 'hideSeen'); tog('Read receipts (blue ticks)', 'receipts', true); tog('Typing indicator', 'typing', true);
  act(`🚫 Blocked contacts (${(myDoc().blocked || []).length})`, blockedList);
  sec('Notifications');
  tog('Desktop notifications', 'notif', false, (on) => { if (on && 'Notification' in window) Notification.requestPermission().then((p) => p !== 'granted' && toast('Permission nahi mili', 1)); });
  tog('Message sound', 'sound', true); tog('Effects (confetti, hearts)', 'fx', true);
  sec('Fun'); act('🤖 Gupshup AI', aiDlg); act('🎮 Games', gamesDlg);
  sec('Help'); act('ℹ️ About Gupshup', () => toast('Gupshup v4 · made with Firebase')); act('🚪 Log out', () => $('sOut').click());
  const o = modal('⚙️ Settings', b, [['Close', () => {}, 1]]);
};
$('bSet').onclick = () => openSettings();

/* ---------- 14. MENUS + HEADER BUTTONS ---------- */
const bAi = h('button', 'ib', '🤖'); bAi.title = 'Gupshup AI'; bAi.onclick = aiDlg;
const bGm = h('button', 'ib', '🎮'); bGm.title = 'Games'; bGm.onclick = gamesDlg;
$('bTheme').before(bAi, bGm);
const _m2 = menu;
menu = (a, items, top) => {
  if (a === bMore && cur) { const o = cur.isGroup ? null : other(cur); items = [...items, ['⏳ Disappearing messages', disDlg], ['👤 Info', infoDlg], o && [favs().includes(o) ? ' remove from ☆ Favourites ' : '⭐ add to favourites', () => upMy('favs', o)]]; }
  if (a === $('bAtt')) items = [...items, ['📷 Camera', () => camera((d) => post({ type: 'image', data: d }))], ['🎥 Video', () => inVid.click()], ['📄 Document', () => inDoc.click()]];
  return _m2(a, items, top);
};

/* ---------- 15. START ---------- */
let v4On = 0;
function v4Init(u) {
  const dref = doc(db, 'users', u.uid, 'devices', devId);
  setDoc(dref, { name: devName(), createdAt: Date.now(), lastActive: Date.now(), revoked: false }, { merge: true }).then(() => {
    onSnapshot(dref, (s) => { if (s.data()?.revoked) signOut(auth).then(() => location.reload()); });
  }).catch(() => {});
  setInterval(() => updateDoc(dref, { lastActive: Date.now() }).catch(() => {}), 60000);
  sub(collection(db, 'channels'), (s) => { chanDir = s.docs.map((d) => ({ id: d.id, ...d.data() })); if (tab === 'channels') renderList(); });
  sub(collection(db, 'communities'), (s) => { comms = s.docs.map((d) => ({ id: d.id, ...d.data() })); if (tab === 'channels') renderList(); });
  notifyInit();
}
onAuthStateChanged(auth, (u) => { if (u && !v4On) { v4On = 1; v4Init(u); } });
applyLang();


import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

$('bForgot').onclick = async () => {
  const em = $('liEmail').value.trim();

  if (!em) return fail({ message: 'Please enter your email address above' });

  try {
    await sendPasswordResetEmail(auth, em);
    $('err').textContent = '';
    toast('📧 Reset link sent. Please check your inbox and spam folder');

  } catch (x) {
    fail({
      code: ({
        'auth/invalid-email': 'Invalid email address',
        'auth/user-not-found': 'No account found with this email',
        'auth/too-many-requests': 'Too many attempts. Please try again later'
      })[x.code] || x.code
    });
  }
};