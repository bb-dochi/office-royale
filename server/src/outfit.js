// What a player chose in the dressing room. Comes from the client, so only known options and #rrggbb colours survive.
// The client turns it into meshes (fitToOutfit in public/js/client/20-render.js). Kept small: it rides along in snapshots.
const HAIR = ['short', 'side', 'long', 'bun', 'bald'], TOP = ['shirt', 'jacket', 'cardigan', 'vest'], BOTTOM = ['pants', 'skirt'];
const col = v => (typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v.toLowerCase() : null);
export function cleanFit(f) {
  if (!f || typeof f !== 'object') return null;
  const pick = (v, list) => (list.includes(v) ? v : list[0]);
  return {
    hair: pick(f.hair, HAIR), hairC: col(f.hairC) || '#3a2d28', skin: col(f.skin) || '#fbd8bb',
    top: pick(f.top, TOP), topC: col(f.topC) || '#2b6cb0', shirtC: col(f.shirtC) || '#f4f6f8',
    tie: col(f.tie), badge: !!f.badge, glasses: !!f.glasses,
    bottom: pick(f.bottom, BOTTOM), bottomC: col(f.bottomC) || '#2f3540',
  };
}
