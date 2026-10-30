// What a player chose in the dressing room. Comes from the client, so only known options and #rrggbb colours survive.
// The client turns it into meshes (fitToOutfit in public/js/client/20-render.js). Kept small: it rides along in snapshots.
import '../../public/js/shared/rewards.js'; // globalThis.REWARDS: the 성과 rewards, the same list the game loads
const RW = globalThis.REWARDS;
const EYE = ['normal', 'sparkle', 'sleepy', 'smile', 'dead'];
const HAIR = ['short', 'side', 'long', 'bun', 'bald', 'twin', ...Object.keys(RW.hair)], SHOE = ['loafer', 'sneaker', 'slipper'], TOP = ['shirt', 'jacket', 'cardigan', 'vest', 'hoodie', 'check', 'tee', 'pj'], BOTTOM = ['pants', 'skirt', 'shorts', 'pj'];
const GEAR = Object.keys(RW.gear), FX = Object.keys(RW.fx), THR = Object.keys(RW.thr), TITLE_AW = Object.keys(RW.titles);
const col = v => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null);
/* whatever a career doesn't own goes back to the ordinary choice. A piece on a 성과 step, or any 성과 colour, needs owning; a piece on no step is free.
   own: the career's list as a Set (career.js `grant`). Keys are `kind:id` and `title:aw:step` */
const locked = (kind, id, own) => { const r = RW[kind] && RW[kind][id]; return !!r && (!!r.aw || !!r.temp || kind === 'color') && !own.has(`${kind}:${id}`); };
function keepOwned(f, own) {
  for (const [kind, plain] of [['hair', 'short'], ['eye', 'normal'], ['top', 'shirt'], ['bottom', 'pants'], ['shoe', 'loafer']]) if (locked(kind, f[kind], own)) f[kind] = plain;
  for (const k of ['freckles', 'stamp']) if (f[k] && locked('face', k, own)) f[k] = false;
  f.gear = f.gear.filter(g => !locked('gear', g, own));
  if (f.fx && locked('fx', f.fx, own)) f.fx = null;
  if (f.thr && locked('thr', f.thr, own)) f.thr = null;
  if (f.title && !own.has(`title:${f.title}`)) f.title = null;
  f.haloT = [1, 2, 3].find(n => own.has(`halo:${n}`)) || 0;   // the colour of the 후광 is the rank, not a choice
  for (const [k, plain] of [['hairC', '#3a2d28'], ['topC', '#2b6cb0'], ['bottomC', '#2f3540'], ['shoeC', '#1d2024'], ['tie', null]]) { const c = RW.color[f[k]]; if (c && c.key === k && locked('color', f[k], own)) f[k] = plain; }
  return f;
}
/* own: a Set to hold the fit to what it covers; left out, nothing is checked */
export function cleanFit(f, own) {
  if (!f || typeof f !== 'object') return null;
  const pick = (v, list) => (list.includes(v) ? v : list[0]);
  const fit = {
    hair: pick(f.hair, HAIR), hairC: col(f.hairC) || '#3a2d28', skin: col(f.skin) || '#fbd8bb',
    top: pick(f.top, TOP), topC: col(f.topC) || '#2b6cb0', shirtC: col(f.shirtC) || '#f4f6f8',
    tie: col(f.tie), badge: !!f.badge, glasses: !!f.glasses, eye: pick(f.eye, EYE), freckles: !!f.freckles, stamp: !!f.stamp,
    bottom: pick(f.bottom, BOTTOM), bottomC: col(f.bottomC) || '#2f3540', shoe: pick(f.shoe, SHOE), shoeC: col(f.shoeC) || '#1d2024',
    gear: Array.isArray(f.gear) ? [...new Set(f.gear.filter(g => GEAR.includes(g)))] : [], haloT: [1, 2, 3].includes(+f.haloT) ? +f.haloT : 0, fx: FX.includes(f.fx) ? f.fx : null, thr: THR.includes(f.thr) ? f.thr : null,
    title: typeof f.title === 'string' && /^[a-z]+:[1-5]$/.test(f.title) && TITLE_AW.includes(f.title.split(':')[0]) ? f.title : null,
  };
  return own ? keepOwned(fit, own) : fit;
}
