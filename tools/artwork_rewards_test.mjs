import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

let artworks = [];
const window = {};
vm.runInNewContext(fs.readFileSync(new URL('../artwork-rewards.js', import.meta.url), 'utf8'), {
  window, localStorage: { getItem: () => JSON.stringify(artworks) }, console
});
const reconcile = window.LikhaArtworkRewards.reconcile;
let state = reconcile({ stars: 0, totalStarsEarned: 0, artworks: [] });
for (const [index, expected] of [[1, 20], [2, 35], [3, 50], [4, 75], [5, 90]]) {
  artworks.push({ id: `studio-${index}`, title: 'Test artwork' });
  state = reconcile(state);
  assert.equal(state.stars, expected, `Incorrect balance after artwork ${index}`);
  assert.equal(state.totalStarsEarned, expected);
  assert.equal(reconcile(state).stars, expected, 'Reload awarded stars twice');
}
// Dropping visible history, spending stars, editing or deleting art must not reaward it.
state = { ...state, stars: 0, rewardHistory: [] };
assert.equal(reconcile(state).stars, 0);
artworks[0].title = 'Edited';
assert.equal(reconcile(state).stars, 0);
artworks = [];
assert.equal(reconcile(state).stars, 0);
artworks = [{ id: 'studio-1' }, { id: 'studio-1' }];
assert.equal(reconcile(state).stars, 0);
// Recover old studio saves while preserving paid dashboard artwork and milestone bonuses.
artworks = [{ id: 'studio-a' }, { id: 'studio-b' }];
const migrated = reconcile({ stars: 35, totalStarsEarned: 35, artworks: [{ id: 'dashboard-a' }, { id: 'dashboard-b' }] });
assert.equal(migrated.stars, 75);
assert.equal(reconcile(migrated).stars, 75);
const mixed = reconcile({ ...migrated, artworks: [...migrated.artworks, { id: 'dashboard-c' }] });
assert.equal(mixed.stars, 90, 'A new dashboard artwork must use the same rewards');
artworks = [{ id: 'shared' }, { id: 'shared' }];
assert.equal(reconcile({ stars: 0 }).stars, 20, 'Duplicate gallery IDs must only count once');
const quiz = reconcile({ stars: 40, totalStarsEarned: 50 });
assert.equal(quiz.stars, 60);
assert.equal(quiz.totalStarsEarned, 70);
console.log('PASS artwork rewards, first/fourth bonuses, recovery, mixed save flows, permanent deduplication, spent balances, and preserved quiz earnings.');
