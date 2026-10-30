// What a player chose in the dressing room. Comes from the client, so only known options and #rrggbb colours survive.
// The client turns it into meshes (fitToOutfit in public/js/client/20-render.js). Kept small: it rides along in snapshots.
const HAIR = ['short', 'side', 'long', 'bun', 'bald', 'slick', 'messy', 'pony', 'allback', 'perm', 'buzz'], SHOE = ['loafer', 'sneaker', 'slipper'], TOP = ['shirt', 'jacket', 'cardigan', 'vest'], BOTTOM = ['pants', 'skirt'];
// 성과 rewards (docs/CAREER.md 2장, the same lists as RW_GEAR / RW_FX / RW_TITLES in public/js/client/20-render.js)
const GEAR = ['sleeves', 'goldBadge', 'eyebags', 'pillow', 'goldTie', 'shades', 'postit', 'gloves'], FX = ['gold', 'paper', 'wind'],
  TITLE_AW = ['days', 'night', 'promo', 'ceo', 'tasks', 'kills'];
const col = v => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null);
export function cleanFit(f) {
  if (!f || typeof f !== 'object') return null;
  const pick = (v, list) => (list.includes(v) ? v : list[0]);
  return {
    hair: pick(f.hair, HAIR), hairC: col(f.hairC) || '#3a2d28', skin: col(f.skin) || '#fbd8bb',
    top: pick(f.top, TOP), topC: col(f.topC) || '#2b6cb0', shirtC: col(f.shirtC) || '#f4f6f8',
    tie: col(f.tie), badge: !!f.badge, glasses: !!f.glasses,
    bottom: pick(f.bottom, BOTTOM), bottomC: col(f.bottomC) || '#2f3540', shoe: pick(f.shoe, SHOE), shoeC: col(f.shoeC) || '#1d2024',
    gear: Array.isArray(f.gear) ? [...new Set(f.gear.filter(g => GEAR.includes(g)))] : [], fx: FX.includes(f.fx) ? f.fx : null,
    title: typeof f.title === 'string' && /^[a-z]+:[1-5]$/.test(f.title) && TITLE_AW.includes(f.title.split(':')[0]) ? f.title : null,
  };
}
