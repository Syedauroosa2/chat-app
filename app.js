import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, addDoc, query, orderBy, onSnapshot, serverTimestamp, doc, updateDoc, setDoc, arrayUnion, arrayRemove, where, deleteField } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyBCxJcg4CAfosmbaxKOScvpEBN-qOSPOus",
    authDomain: "chat-application-adc83.firebaseapp.com",
    projectId: "chat-application-adc83",
    storageBucket: "chat-application-adc83.firebasestorage.app",
    messagingSenderId: "894720031152",
    appId: "1:894720031152:web:1f2f70bec40c4424333e75",
    measurementId: "G-R8K95327ZY"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app), db = getFirestore(app);
const $ = (id) => document.getElementById(id);
const MSGS = "global_messages";

/* ---------- AUTH (index.html) ---------- */
if ($('authForm')) {
    let signUp = false;
    $('toggleAuth').addEventListener('click', (e) => {
        e.preventDefault(); signUp = !signUp;
        $('authTitle').innerText = signUp ? "Create an account" : "Welcome to NexusChat";
        $('authSubtitle').innerText = signUp ? "Sign up to start chatting" : "Log in to continue chatting";
        $('submitBtn').innerText = signUp ? "Sign up" : "Log in";
        $('username').style.display = signUp ? "block" : "none";
        $('username').toggleAttribute('required', signUp);
        $('toggleMsg').innerText = signUp ? "Already have an account?" : "Don't have an account?";
        $('toggleAuth').innerText = signUp ? "Log in" : "Sign up";
    });
    $('authForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
            if (signUp) {
                const c = await createUserWithEmailAndPassword(auth, $('email').value, $('password').value);
                await updateProfile(c.user, { displayName: $('username').value });
            } else await signInWithEmailAndPassword(auth, $('email').value, $('password').value);
            location.href = "chat.html";
        } catch (err) { alert(err.message); }
    });
}

/* ---------- CHAT (chat.html) ---------- */
if ($('messageForm')) {
    let myPhoto = '', me = null, watchId = null, liveDocId = null, liveTimer = null, pos = null;
    const list = $('chatMessages');
    let known = {}, chat = 'global', unM = null, unC = null, users = [], archived = [], showArch = false, typing = {}, lastT = 0, sts = [];
    const col = () => chat === 'global' ? collection(db, MSGS) : collection(db, 'chats', chat, 'messages');
    const show = (id, on = true) => $(id).style.display = on ? '' : 'none';
    const sender = () => ({ senderId: me.uid, senderName: me.displayName || "User", senderPhoto: myPhoto, createdAt: serverTimestamp() });
    const send = (data) => addDoc(col(), { ...sender(), ...data });

    onAuthStateChanged(auth, (user) => {
        if (!user) return location.href = "index.html";
        me = user;
        const name = user.displayName || user.email.split('@')[0];
        $('currentUserName').innerText = name;
        $('currentUserAvatar').innerText = name[0].toUpperCase();
        init();
    });

    /* profile */
    $('editProfileBtn').onclick = () => show('profileModal');
    $('closeModalBtn').onclick = () => show('profileModal', false);
    $('logoutBtn').onclick = () => signOut(auth).then(() => location.href = "index.html");
    $('saveProfileBtn').onclick = async () => {
        const file = $('profileFileInput').files[0];
        if (!file) return alert("Select an image first");
        try {
            $('uploadStatus').style.display = 'block'; $('uploadStatus').innerText = "Uploading…";
            const url = await shrink(file, 128, .8);
            await setDoc(doc(db, 'users', me.uid), { photo: url }, { merge: true });
            $('uploadStatus').innerText = "Saved";
            setTimeout(() => show('profileModal', false), 800);
        } catch (e) { console.error(e); $('uploadStatus').innerText = "Upload failed: " + (e.code || e.message); }
    };

    /* attach menu */
    $('attachBtn').onclick = (e) => { e.stopPropagation(); $('attachMenu').classList.toggle('open'); };
    document.addEventListener('click', () => $('attachMenu').classList.remove('open'));

    /* text / media */
    $('messageForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = $('messageInput').value.trim();
        if (!text) return;
        $('messageInput').value = "";
        await send({ type: "text", text });
    });
    $('chatImageInput').addEventListener('change', async (e) => {
        const f = e.target.files[0]; if (!f) return;
        await send({ type: 'image', imageUrl: await shrink(f, 900, .72) });
        e.target.value = '';
    });

    /* poll */
    $('createPollModalBtn').onclick = () => show('pollModal');
    $('closePollModalBtn').onclick = () => show('pollModal', false);
    $('submitPollBtn').onclick = async () => {
        const q = $('pollQuestion').value.trim(), a = $('pollOption1').value.trim(), b = $('pollOption2').value.trim();
        if (!q || !a || !b) return alert("Fill in all fields");
        await send({ type: "poll", question: q, options: [a, b], voters: {} });
        ['pollQuestion', 'pollOption1', 'pollOption2'].forEach(i => $(i).value = "");
        show('pollModal', false);
    };

    /* ---------- LOCATION ---------- */
    const embed = (lat, lng) => {
        const d = 0.004;
        return `https://www.openstreetmap.org/export/embed.html?bbox=${lng - d},${lat - d / 1.6},${lng + d},${lat + d / 1.6}&layer=mapnik&marker=${lat},${lng}`;
    };
    const mapsLink = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;

    $('locationBtn').onclick = () => {
        show('locationModal');
        $('sendCurrentBtn').disabled = $('startLiveBtn').disabled = true;
        $('accuracyText').innerText = "Waiting for GPS";
        $('mapPreview').innerHTML = '<span class="hint">Finding your position…</span>';
        if (!navigator.geolocation) { $('accuracyText').innerText = "Location is not supported"; return; }
        navigator.geolocation.getCurrentPosition((p) => {
            pos = p.coords;
            $('mapPreview').innerHTML = `<iframe title="Your location" src="${embed(pos.latitude, pos.longitude)}"></iframe>`;
            $('accuracyText').innerText = `Accurate to about ${Math.round(pos.accuracy)} m`;
            $('sendCurrentBtn').disabled = $('startLiveBtn').disabled = !!watchId;
        }, () => { $('accuracyText').innerText = "Allow location access in your browser and try again"; },
        { enableHighAccuracy: true, timeout: 15000 });
    };
    $('closeLocationBtn').onclick = () => show('locationModal', false);

    $('sendCurrentBtn').onclick = async () => {
        await send({ type: "location", live: false, lat: pos.latitude, lng: pos.longitude });
        show('locationModal', false);
    };

    $('startLiveBtn').onclick = async () => {
        const mins = +$('liveDuration').value;
        const expiresAt = Date.now() + mins * 60000;
        const d = await send({ type: "location", live: true, lat: pos.latitude, lng: pos.longitude, expiresAt, updatedAt: Date.now() });
        liveDocId = d;
        watchId = navigator.geolocation.watchPosition((p) => {
            updateDoc(liveDocId, { lat: p.coords.latitude, lng: p.coords.longitude, updatedAt: Date.now() });
        }, console.error, { enableHighAccuracy: true, maximumAge: 5000 });
        liveTimer = setTimeout(stopLive, mins * 60000);
        show('locationModal', false); show('liveBar');
    };
    async function stopLive() {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(liveTimer);
        if (liveDocId) await updateDoc(liveDocId, { live: false });
        watchId = liveDocId = null; show('liveBar', false);
    }
    $('stopLiveBtn').onclick = stopLive;
    window.addEventListener('beforeunload', () => { if (liveDocId) updateDoc(liveDocId, { live: false }); });

    /* ---------- RENDER ---------- */
    const els = new Map();
    const h = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };

    function build(id, d) {
        const mine = d.senderId === me.uid;
        const row = h('div', `row ${mine ? 'sent' : 'received'}`);
        const av = h('div', 'avatar');
        if (d.senderPhoto) { const i = h('img'); i.src = d.senderPhoto; av.appendChild(i); }
        else av.textContent = (d.senderName || 'U')[0].toUpperCase();
        const b = h('div', 'bubble');
        if (!mine) b.appendChild(h('div', 'who', d.senderName));

        if (d.deleted) b.appendChild(h('em', 'gone', 'This message was deleted'));
        else if (d.type === "image") { const i = h('img', 'media'); i.src = d.imageUrl; b.appendChild(i); }
        else if (d.type === "video") { const v = h('video', 'media'); v.src = d.videoUrl; v.controls = true; b.appendChild(v); }
        else if (d.type === "location") b.appendChild(locationCard(d));
        else if (d.type === "poll") b.appendChild(pollCard(id, d));
        else b.appendChild(h('span', '', d.text));

        const t = d.createdAt?.toDate?.();
        if (t) b.appendChild(h('span', 'time', t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })));
        if (!d.deleted) {
            addReactions(b, id, d);
            const m = h('button', 'mbtn'); m.type = 'button'; m.innerHTML = '<i class="fa-solid fa-face-smile"></i>';
            m.onclick = (e) => { e.stopPropagation(); openMenu(m, id, mine, d); };
            b.appendChild(m);
        }
        row.append(av, b);
        return row;
    }

    function locationCard(d) {
        const isLive = d.live && d.expiresAt > Date.now();
        const c = h('div', 'loc');
        const f = h('iframe'); f.src = embed(d.lat, d.lng); f.title = "Shared location"; f.loading = "lazy";
        const meta = h('div', 'loc-meta');
        const badge = h('span', `badge ${isLive ? 'live' : ''}`);
        if (isLive) badge.appendChild(h('span', 'pulse'));
        badge.append(isLive ? "Live location" : "Location");
        const a = h('a', '', "Open map"); a.href = mapsLink(d.lat, d.lng); a.target = "_blank"; a.rel = "noopener";
        meta.append(badge, a);
        c.append(f, meta);
        return c;
    }

    function pollCard(id, d) {
        const c = h('div', 'poll');
        c.appendChild(h('b', '', d.question));
        const voters = d.voters || {};
        const counts = d.options.map((_, i) => Object.values(voters).filter(v => v === i).length);
        const total = counts.reduce((a, b) => a + b, 0) || 1;
        d.options.forEach((o, i) => {
            const btn = h('button', `pv ${voters[me.uid] === i ? 'mine' : ''}`);
            btn.type = "button";
            const bar = h('i'); bar.style.width = `${counts[i] / total * 100}%`;
            btn.append(bar, h('span', '', o), h('span', '', String(counts[i])));
            btn.onclick = () => updateDoc(doc(col(), id), { [`voters.${me.uid}`]: i });
            c.appendChild(btn);
        });
        return c;
    }

    /* ---------- private chats, status, typing, archive, theme ---------- */
    const root = document.documentElement;
    const ls = (k, v) => { try { return v === undefined ? localStorage.getItem(k) : localStorage.setItem(k, v); } catch {} };
    const dmId = (o) => [me.uid, o].sort().join('_');
    const av = (n, p, c = 'avatar') => { const e = h('div', c); if (p) { const i = h('img'); i.src = p; e.append(i); } else e.textContent = (n || 'U')[0].toUpperCase(); return e; };
    const rowEl = (a, t, s) => { const r = h('div', 'room'), i = h('div', 'info'); i.append(h('h4', '', t), h('p', '', s)); r.append(a, i); return r; };
    const hm = (t) => new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    function init() {
        const name = me.displayName || me.email.split('@')[0];
        setDoc(doc(db, 'users', me.uid), { name, email: me.email }, { merge: true });
        onSnap(collection(db, 'users'), (s) => {
            users = s.docs.map(d => ({ id: d.id, ...d.data() }));
            archived = users.find(u => u.id === me.uid)?.archived || [];
            const mp = users.find(u => u.id === me.uid)?.photo || ''; if (mp !== myPhoto) { myPhoto = mp; setMyAvatar(); }
            renderChats();
        });
        onSnap(query(collection(db, 'statuses'), orderBy('createdAt', 'desc')), (s) => {
            sts = s.docs.map(d => ({ id: d.id, ...d.data() })).filter(x => Date.now() - x.createdAt < 864e5);
            renderSts();
        });
        listenCalls(); applyTheme();
        openChat('global', 'Global room', '');
    }

    function openChat(id, name, photo) {
        chat = id; unM && unM(); unC && unC(); els.clear(); list.replaceChildren(); typing = {};
        $('roomTitle').textContent = name;
        $('roomAv').replaceChildren(); $('roomAv').append(...av(name, photo).childNodes);
        $('app').classList.add('in-chat'); $('callBtns').style.display = 'flex'; renderChats(); renderSub();
        unM = onSnap(query(col(), orderBy('createdAt', 'asc')), (snap) => {
            let newPeople = false;
            snap.docChanges().forEach((ch) => {
                if (ch.type === 'removed') { els.get(ch.doc.id)?.remove(); els.delete(ch.doc.id); return; }
                const dd = ch.doc.data(), old = els.get(ch.doc.id);
                if (chat === 'global' && dd.senderId && dd.senderId !== me.uid && !known[dd.senderId]) { known[dd.senderId] = { id: dd.senderId, name: dd.senderName, photo: dd.senderPhoto }; newPeople = true; }
                if (dd.hiddenFor?.includes(me.uid)) { old?.remove(); els.delete(ch.doc.id); return; }
                const row = build(ch.doc.id, dd);
                old ? old.replaceWith(row) : list.appendChild(row);
                els.set(ch.doc.id, row);
            });
            if (newPeople) renderChats();
            list.scrollTop = list.scrollHeight;
        });
        unC = onSnap(doc(db, 'chats', id), (s) => { typing = s.data()?.typing || {}; renderSub(); });
    }
    $('backBtn').onclick = () => $('app').classList.remove('in-chat');

    /* typing */
    function renderSub() {
        const now = Date.now();
        const t = Object.entries(typing).filter(([u, v]) => u !== me?.uid && now - v.t < 5000).map(([, v]) => v.n);
        $('roomSub').textContent = t.length ? (chat === 'global' ? t.join(', ') + ' typing…' : 'typing…') : (chat === 'global' ? 'Everyone' : 'Private chat');
        $('roomSub').classList.toggle('typing', !!t.length);
    }
    setInterval(renderSub, 1500);
    $('messageInput').addEventListener('input', () => {
        if (Date.now() - lastT < 2500) return; lastT = Date.now();
        setDoc(doc(db, 'chats', chat), { typing: { [me.uid]: { t: Date.now(), n: me.displayName || 'User' } } }, { merge: true });
    });

    /* chat list + archive */
    $('searchChatsInput').oninput = () => renderChats();
    function renderChats() {
        const q = $('searchChatsInput').value.toLowerCase(), box = $('chatList'); box.replaceChildren();
        const all = [{ id: 'global', name: 'Global room' }, ...others().map(u => ({ id: dmId(u.id), name: u.name || u.email || 'User', photo: u.photo }))];
        const nA = all.filter(c => archived.includes(c.id)).length;
        if (nA) { const r = rowEl(av('A'), showArch ? 'Back to chats' : 'Archived', nA + ' chat(s)'); r.onclick = () => { showArch = !showArch; renderChats(); }; box.append(r); }
        all.filter(c => archived.includes(c.id) === showArch && c.name.toLowerCase().includes(q)).forEach((c) => {
            const r = rowEl(av(c.name, c.photo), c.name, c.id === 'global' ? 'Everyone' : 'Private chat');
            if (c.id === chat) r.classList.add('active');
            const b = h('button', 'arch'); b.title = showArch ? 'Unarchive' : 'Archive';
            b.innerHTML = `<i class="fa-solid fa-${showArch ? 'box-open' : 'box-archive'}"></i>`;
            b.onclick = (e) => { e.stopPropagation(); updateDoc(doc(db, 'users', me.uid), { archived: showArch ? arrayRemove(c.id) : arrayUnion(c.id) }); };
            r.append(b); r.onclick = () => openChat(c.id, c.name, c.photo); box.append(r);
        });
        if (!showArch && !others().length) box.append(h('p', 'hint pad', 'No other people yet. Sign up a second account, or ask a friend to send a message in the Global room. They will appear here.'));
    }
    document.querySelectorAll('.tab').forEach(t => t.onclick = () => {
        document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
        ['chatsPane', 'statusPane', 'callsPane'].forEach(p => $(p).style.display = p === t.dataset.pane ? 'flex' : 'none');
    });

    /* status */
    function renderSts() {
        const box = $('statusList'); box.replaceChildren();
        const mine = sts.filter(s => s.uid === me.uid);
        const r0 = rowEl(av(me.displayName, myPhoto), 'My status', mine.length ? `${mine.length} update(s), tap to see who viewed` : 'Share text or a photo');
        const plus = h('button', 'arch'); plus.style.opacity = 1; plus.innerHTML = '<i class="fa-solid fa-circle-plus"></i>';
        plus.onclick = (e) => { e.stopPropagation(); show('statusModal'); };
        r0.append(plus); r0.onclick = () => mine[0] ? viewSt(mine[0]) : show('statusModal'); box.append(r0);
        sts.filter(s => s.uid !== me.uid).forEach((s) => {
            const a = av(s.name, s.photo); if (!s.viewers?.[me.uid]) a.classList.add('ring');
            const r = rowEl(a, s.name, hm(s.createdAt)); r.onclick = () => viewSt(s); box.append(r);
        });
    }
    function viewSt(s) {
        const m = $('stBody'); m.replaceChildren(); m.style.background = `linear-gradient(135deg,${s.bg || '#3b4bd6'},#0d1017)`;
        if (s.type === 'image') { const i = h('img'); i.src = s.imageUrl; m.append(i); }
        if (s.text) m.append(h('p', '', s.text));
        $('stWho').textContent = s.uid === me.uid ? 'My status' : s.name;
        const seen = $('stSeen'); seen.replaceChildren();
        if (s.uid === me.uid) {
            const v = Object.values(s.viewers || {});
            seen.append(h('b', '', `Seen by ${v.length}`), ...v.map(x => h('div', 'seen-row', `${x.n}  ·  ${hm(x.t)}`)));
        } else updateDoc(doc(db, 'statuses', s.id), { [`viewers.${me.uid}`]: { n: me.displayName || 'User', t: Date.now() } });
        show('statusView');
    }
    $('closeViewBtn').onclick = () => show('statusView', false);
    $('closeStatusBtn').onclick = () => show('statusModal', false);
    $('postStatusBtn').onclick = async () => {
        const text = $('stText').value.trim(), f = $('stFile').files[0];
        if (!text && !f) return alert('Add text or a photo');
        let imageUrl = '';
        if (f) imageUrl = await shrink(f, 800, .7);
        await addDoc(collection(db, 'statuses'), { uid: me.uid, name: me.displayName || 'User', photo: myPhoto, type: f ? 'image' : 'text', text, imageUrl, bg: $('stColor').value, createdAt: Date.now(), viewers: {} });
        $('stText').value = ''; $('stFile').value = ''; show('statusModal', false);
    };

    /* theme: dark/light, bubble colour, wallpaper (saved on this device) */
    const ACC = { indigo: '#7b8cff', green: '#34d399', pink: '#f472b6', orange: '#fb923c' };
    const WALL = { 0: 'var(--panel2)', 1: 'linear-gradient(160deg,#0f2027,#2c5364)', 2: 'linear-gradient(160deg,#41295a,#2f0743)', 3: 'linear-gradient(160deg,#134e5e,#71b280)', 4: 'linear-gradient(160deg,#fceabb,#f8b500)' };
    function applyTheme() {
        root.dataset.theme = ls('theme') || 'dark'; root.dataset.accent = ls('accent') || 'indigo';
        const w = ls('wall') || '0';
        list.style.background = w === 'img' ? `url(${ls('wallimg')}) center/cover` : (w === '0' ? '' : WALL[w]);
        $('themeBtn').innerHTML = `<i class="fa-solid fa-${root.dataset.theme === 'dark' ? 'sun' : 'moon'}"></i>`;
    }
    $('themeBtn').onclick = () => { ls('theme', root.dataset.theme === 'dark' ? 'light' : 'dark'); applyTheme(); };
    $('paletteBtn').onclick = () => show('themeModal');
    $('closeThemeBtn').onclick = () => show('themeModal', false);
    $('accSw').append(...Object.entries(ACC).map(([k, c]) => { const b = h('button', 'sw'); b.type = 'button'; b.style.background = c; b.onclick = () => { ls('accent', k); applyTheme(); }; return b; }));
    $('wallSw').append(...Object.entries(WALL).map(([k, c]) => { const b = h('button', 'sw'); b.type = 'button'; b.style.background = c; b.onclick = () => { ls('wall', k); applyTheme(); }; return b; }));
    $('wallFile').onchange = (e) => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { ls('wallimg', r.result); ls('wall', 'img'); applyTheme(); }; r.readAsDataURL(f); };

    /* ---------- errors + CALLS (WebRTC, Firestore signaling) ---------- */
    const toast = (m) => { const t = $('toast'); t.textContent = m; t.style.display = 'block'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', 7000); };
    const onSnap = (q, fn) => onSnapshot(q, fn, (e) => toast(`Firestore: ${e.code}. Check your Firestore rules.`));
    window.addEventListener('unhandledrejection', (e) => toast(String(e.reason?.code || e.reason?.message || 'Something went wrong')));

    const ICE = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
    let pc = null, stream = null, callRef = null, unCall = [], incoming = null, calls = [];
    const nameOf = (uid) => (users.find(u => u.id === uid) || known[uid])?.name || 'User';
    const photoOf = (uid) => (users.find(u => u.id === uid) || known[uid])?.photo || '';
    const gotRemote = (c) => c.type === 'added' && pc && pc.addIceCandidate(c.doc.data());

    async function setupCall(type) {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === 'video' });
        $('localVid').srcObject = stream;
        pc = new RTCPeerConnection(ICE);
        stream.getTracks().forEach(t => pc.addTrack(t, stream));
        pc.ontrack = (e) => { $('remoteVid').srcObject = e.streams[0]; };
        show('callModal');
    }
    async function startCall(type) {
        const to = chat.split('_').find(x => x !== me.uid);
        if (chat === 'global' || !to) return toast('Calls are one-to-one. Open a person from the Chats list first, then tap the call icon.');
        await setupCall(type); $('callStatus').textContent = 'Calling ' + nameOf(to) + '…';
        callRef = doc(collection(db, 'calls'));
        pc.onicecandidate = (e) => e.candidate && addDoc(collection(callRef, 'offerCandidates'), e.candidate.toJSON());
        const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
        await setDoc(callRef, { from: me.uid, fromName: me.displayName || 'User', to, participants: [me.uid, to], type, status: 'ringing', offer: { type: offer.type, sdp: offer.sdp }, createdAt: Date.now() });
        unCall.push(onSnap(callRef, async (s) => {
            const d = s.data(); if (!d || !pc) return;
            if (d.answer && !pc.currentRemoteDescription) { await pc.setRemoteDescription(d.answer); $('callStatus').textContent = 'Connected'; }
            if (d.status === 'declined' || d.status === 'ended') cleanup();
        }));
        unCall.push(onSnap(collection(callRef, 'answerCandidates'), (s) => s.docChanges().forEach(gotRemote)));
    }
    $('voiceBtn').onclick = () => startCall('voice');
    $('videoBtn').onclick = () => startCall('video');

    function listenCalls() {
        onSnap(query(collection(db, 'calls'), where('to', '==', me.uid), where('status', '==', 'ringing')), (s) => {
            incoming = s.docs.find(d => Date.now() - d.data().createdAt < 6e4) || null;
            if (incoming && !pc) { const d = incoming.data(); $('inWho').textContent = `${d.fromName} is ${d.type === 'video' ? 'video' : 'voice'} calling`; show('incomingModal'); }
            else show('incomingModal', false);
        });
        onSnap(query(collection(db, 'calls'), where('participants', 'array-contains', me.uid)), (s) => {
            calls = s.docs.map(d => ({ id: d.id, ...d.data() })).sort((x, y) => y.createdAt - x.createdAt); renderCalls();
        });
    }
    $('acceptBtn').onclick = async () => {
        if (!incoming) return;
        const d = incoming.data(); callRef = incoming.ref; show('incomingModal', false);
        await setupCall(d.type); $('callStatus').textContent = 'Connecting…';
        pc.onicecandidate = (e) => e.candidate && addDoc(collection(callRef, 'answerCandidates'), e.candidate.toJSON());
        await pc.setRemoteDescription(d.offer);
        const ans = await pc.createAnswer(); await pc.setLocalDescription(ans);
        await updateDoc(callRef, { answer: { type: ans.type, sdp: ans.sdp }, status: 'accepted' });
        unCall.push(onSnap(collection(callRef, 'offerCandidates'), (s) => s.docChanges().forEach(gotRemote)));
        unCall.push(onSnap(callRef, (s) => { if (s.data()?.status === 'ended') cleanup(); }));
        $('callStatus').textContent = 'Connected';
    };
    $('declineBtn').onclick = () => { incoming && updateDoc(incoming.ref, { status: 'declined' }); show('incomingModal', false); };
    $('hangBtn').onclick = async () => { if (callRef) await updateDoc(callRef, { status: 'ended' }).catch(() => {}); cleanup(); };
    $('muteBtn').onclick = () => { const t = stream?.getAudioTracks()[0]; if (t) { t.enabled = !t.enabled; $('muteBtn').classList.toggle('off', !t.enabled); } };
    function cleanup() {
        unCall.forEach(f => f()); unCall = []; pc && pc.close(); pc = null;
        stream && stream.getTracks().forEach(t => t.stop()); stream = null; callRef = null;
        $('remoteVid').srcObject = null; $('localVid').srcObject = null; show('callModal', false);
    }
    function renderCalls() {
        const box = $('callList'); box.replaceChildren();
        if (!calls.length) { box.append(h('p', 'hint pad', 'No calls yet. Open a private chat and tap the phone or video icon.')); return; }
        calls.forEach((c) => {
            const out = c.from === me.uid, other = out ? c.to : c.from;
            const r = rowEl(av(nameOf(other), photoOf(other)), nameOf(other), `${out ? 'Outgoing' : 'Incoming'} ${c.type} · ${c.status} · ${hm(c.createdAt)}`);
            r.onclick = () => { openChat(dmId(other), nameOf(other), photoOf(other)); }; box.append(r);
        });
    }

    /* ---------- free image storage: compress and keep inside Firestore ---------- */
    function shrink(file, max, q) {
        return new Promise((res, rej) => {
            const i = new Image();
            i.onload = () => {
                const k = Math.min(1, max / Math.max(i.width, i.height)), c = document.createElement('canvas');
                c.width = i.width * k; c.height = i.height * k;
                c.getContext('2d').drawImage(i, 0, 0, c.width, c.height);
                URL.revokeObjectURL(i.src); res(c.toDataURL('image/jpeg', q));
            };
            i.onerror = () => rej(new Error('Please choose an image file'));
            i.src = URL.createObjectURL(file);
        });
    }
    function setMyAvatar() {
        const i = $('currentUserImg');
        if (myPhoto) { i.src = myPhoto; i.style.display = 'block'; $('currentUserAvatar').style.display = 'none'; }
    }

    /* ---------- reactions + delete ---------- */
    const react = (id, e, cur) => updateDoc(doc(col(), id), { [`reactions.${me.uid}`]: cur === e ? deleteField() : e });
    function addReactions(b, id, d) {
        const r = d.reactions || {}, cnt = {};
        Object.values(r).forEach(e => cnt[e] = (cnt[e] || 0) + 1);
        if (!Object.keys(cnt).length) return;
        const w = h('div', 'rx-row');
        Object.entries(cnt).forEach(([e, n]) => {
            const c = h('button', `rx ${r[me.uid] === e ? 'mine' : ''}`, `${e} ${n}`); c.type = 'button';
            c.onclick = () => react(id, e, r[me.uid]); w.append(c);
        });
        b.appendChild(w);
    }
    function openMenu(btn, id, mine, d) {
        $('msgMenu')?.remove();
        const m = h('div', 'msg-menu'); m.id = 'msgMenu';
        const er = h('div', 'emoji-row');
        ['👍', '❤️', '😂', '😮', '😢', '🙏'].forEach((e) => {
            const b = h('button', '', e); b.type = 'button';
            b.onclick = () => { react(id, e, d.reactions?.[me.uid]); m.remove(); }; er.append(b);
        });
        m.append(er);
        const item = (t, fn) => { const b = h('button', 'mi', t); b.type = 'button'; b.onclick = () => { fn(); m.remove(); }; m.append(b); };
        item('Delete for me', () => updateDoc(doc(col(), id), { hiddenFor: arrayUnion(me.uid) }));
        if (mine) item('Delete for everyone', () => updateDoc(doc(col(), id), { deleted: true, text: '', imageUrl: '', reactions: {} }));
        else { const x = h('button', 'mi dim', 'Delete for everyone (only your own messages)'); x.type = 'button'; m.append(x); }
        document.body.append(m);
        const r = btn.getBoundingClientRect();
        m.style.top = Math.max(10, Math.min(r.bottom + 6, innerHeight - m.offsetHeight - 10)) + 'px';
        m.style.left = Math.max(10, Math.min(r.left - 100, innerWidth - m.offsetWidth - 10)) + 'px';
    }
    document.addEventListener('click', () => $('msgMenu')?.remove());

    /* ---------- people list (users collection + anyone seen in Global room) ---------- */
    const others = () => [...users.filter(u => u.id !== me.uid), ...Object.values(known).filter(k => !users.some(u => u.id === k.id))];
    $('chatsPane').parentElement.append(h('div', 'ver', 'App version 6 loaded'));
}