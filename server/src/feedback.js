// 사내 게시판 댓글: reviews, bug reports and wishes left under a board post (post 0 = the always-open 자유 의견 card).
// Shared by the local dev server and the Durable Object, kept in the '__rank' object's storage like the ranking.
// Anyone can write (a name and up to 200 characters, one every 20 s per device) and delete their own; /admin can hide any.
const MAX = 600, LEN = 200, GAP = 20e3, SHOW = 300;
const clean = s => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();

export class FeedbackCore {
  constructor(store) { this.store = store; this.list = null; this.last = new Map(); }
  async load() { return this.list ??= (await this.store.get('fb:list')) || []; }
  async save() { await this.store.put('fb:list', this.list); }
  /* the newest SHOW visible ones, oldest first; `mine` marks the asker's own so they can delete them */
  async view(uid) {
    const l = (await this.load()).filter(c => !c.hid).slice(-SHOW);
    return { items: l.map(c => ({ id: c.id, at: c.at, post: c.post, name: c.name, text: c.text, mine: c.uid === uid })) };
  }
  async add(uid, name, post, text) {
    name = clean(name).slice(0, 12) || '익명 사원'; text = clean(text).slice(0, LEN);
    if (!Number.isInteger(post) || post < 0 || post > 999) return { err: '잘못된 요청' };
    if (text.length < 2) return { err: '두 글자 이상 적어 주세요' };
    const now = Date.now();
    if (now - (this.last.get(uid) || 0) < GAP) return { err: '조금 뒤에 다시 남겨 주세요' };
    const l = await this.load();
    const c = { id: (l.length ? l[l.length - 1].id : 0) + 1, at: now, uid, post, name, text };
    l.push(c); if (l.length > MAX) l.splice(0, l.length - MAX);
    this.last.set(uid, now); await this.save();
    return { ok: true, item: { id: c.id, at: c.at, post, name, text, mine: true } };
  }
  async remove(uid, id) {
    const c = (await this.load()).find(c => c.id === id && c.uid === uid && !c.hid);
    if (!c) return { err: '지울 수 없어요' };
    c.hid = true; await this.save(); return { ok: true };
  }
  /* admin */
  async all() { return (await this.load()).slice().reverse(); }
  async hide(id, on = true) { const c = (await this.load()).find(c => c.id === id); if (c) { c.hid = on; await this.save(); } }
}
