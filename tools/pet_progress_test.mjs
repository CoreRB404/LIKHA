import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const STORE = 'likhaDashboardPrototype_v1';
function session(initial = {}) {
  const data = new Map(Object.entries(initial).map(([key, value]) => [key, JSON.stringify(value)]));
  const storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const window = { addEventListener() {}, dispatchEvent() {} };
  vm.runInNewContext(fs.readFileSync(new URL('../pet-progress.js', import.meta.url), 'utf8'), {
    window, localStorage: storage, console: { ...console, warn() {} }, Event: class {}
  });
  return { api: window.LikhaPetProgress, storage, state: () => JSON.parse(data.get(STORE)) };
}
const artworks = n => Array.from({ length: n }, (_, i) => ({ id: `art-${i}`, title: `Art ${i}` }));

// A pre-existing dashboard must not hide studio artwork or count its legacy points twice.
for (const [count, expected] of [[0, 'baby'], [1, 'baby'], [2, 'growing'], [4, 'growing'], [5, 'young'], [7, 'young'], [8, 'grown']]) {
  const s = session({ [STORE]: { pet: { growthPoints: 0 }, completedActivities: [] }, likhaArtworks: artworks(count), likhaPet: { points: count } });
  assert.equal(s.api.stage(s.state()).level, expected);
  assert.equal(s.api.metrics(s.state()).units, count);
  const before = s.storage.getItem(STORE);
  s.api.sync(); s.api.sync();
  assert.equal(s.storage.getItem(STORE), before, 'Reloads must not award growth again');
}
// Quiz growth, legacy progress, and registered artwork use the same thresholds.
for (const [points, expected] of [[3, 'baby'], [4, 'growing'], [10, 'young'], [16, 'grown']]) {
  const s = session({ [STORE]: { pet: { growthPoints: points } } });
  assert.equal(s.api.stage(s.state()).level, expected);
}
const mixed = session({ [STORE]: { pet: { growthPoints: 6 }, artworks: artworks(2), completedActivities: ['artwork:art-0', 'artwork:art-0'] }, likhaArtworks: artworks(2), likhaPet: { points: 2 } });
assert.equal(mixed.api.metrics(mixed.state()).units, 5);
assert.equal(mixed.api.stage(mixed.state()).level, 'young');
mixed.storage.setItem('likhaArtworks', '[]'); mixed.api.sync();
assert.equal(mixed.api.metrics(mixed.state()).units, 5, 'Deleting artwork must not revoke earned growth');
const legacy = session({ [STORE]: { pet: { growthPoints: 0, name: 'Mimi', type: 'dog' } }, likhaPet: { name: 'Old name', points: 8 } });
assert.equal(legacy.api.stage(legacy.state()).level, 'grown');
assert.equal(legacy.state().pet.name, 'Mimi');
assert.equal(legacy.state().pet.type, 'dog');
const brokenId = 'art-Date.now()-{Math.random().toString(16).slice(2, 8)}';
const repaired = session({ [STORE]: { artworks: artworks(5).map(a => ({ ...a, id: brokenId })), completedActivities: [`artwork:${brokenId}`] } });
assert.equal(repaired.api.metrics(repaired.state()).units, 5, 'Old duplicate artwork IDs must be repaired');
assert.equal(new Set(repaired.state().artworks.map(a => a.id)).size, 5);
const quiz = session({ [STORE]: { pet: { growthPoints: 0 }, quizResults: {
  week1: [{ attemptId: 'quiz-1', petPoints: 10, rewarded: true }, { attemptId: 'quiz-1', petPoints: 10, rewarded: true }, { attemptId: 'practice', petPoints: 10, rewarded: false }]
} } });
assert.equal(quiz.state().pet.growthPoints, 10, 'Restore earned quiz points without counting duplicate or practice attempts');
assert.equal(quiz.api.stage(quiz.state()).level, 'young');
const invalid = session(); invalid.storage.setItem(STORE, '{invalid');
assert.equal(invalid.api.sync(), false);
assert.equal(invalid.storage.getItem(STORE), '{invalid', 'Corrupt saved data must not be overwritten');
console.log('PASS pet thresholds, studio progress recovery, mixed rewards, deduplication, reload persistence, deleted artwork, legacy points, duplicate ID repair, and corrupt-data preservation.');
