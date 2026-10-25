import test from 'node:test';
import assert from 'node:assert/strict';
import { makeLayout, distanceToRoute } from '../public/world-layout.js';
import { CHALLENGES, validateCompletion, challengePattern } from '../public/world-challenges.js';
import { completionFixture, worldProviderFixture } from './world-fixtures.js';
import { handleAPI } from '../backend/api.js';
test('seeded district plans are reproducible, varied, connected, bounded, and keep northern objectives behind the gate', () => {
    const signatures = new Set();
    for (let i = 0; i < 80; i++) {
        const l = makeLayout('test-' + i, 'forest');
        assert.deepEqual(makeLayout('test-' + i, 'forest'), l);
        assert.equal(Object.keys(l.positions).length, 8);
        for (const [id, p] of Object.entries(l.positions)) {
            assert.ok(Math.abs(p.x) < 45 && Math.abs(p.z) < 45);
            assert.equal(p.z < l.gate.z, ['sanctum', 'vault', 'relay'].includes(id));
            assert.ok(l.paths.some(path => path.some(n => n.x === p.x && n.z === p.z)));
        }
        signatures.add(JSON.stringify(l.positions));
        assert.equal(distanceToRoute(0, 0, l.paths), 0);
    }
    assert.equal(signatures.size, 80);
});
test('every story action has a playable completion contract; partial jumps, wrong patterns and unfinished escorts are rejected', () => {
    const world = { layout: makeLayout('mechanics', 'forest') };
    for (const id of Object.keys(CHALLENGES)) {
        assert.equal(validateCompletion(id, completionFixture(id, world), world), true);
        assert.throws(() => validateCompletion(id, null, world));
    }
    assert.throws(() => validateCompletion('stabilize_source', { kind: 'power', collected: [0, 1, 1], seconds: 9, dodges: 3 }, world));
    assert.throws(() => validateCompletion('activate_relay', { kind: 'defend', seconds: 10, dodges: 0 }, world));
    assert.throws(() => validateCompletion('rescue_ally', { kind: 'escort', rescued: true, distance: 1 }, world));
    assert.throws(() => validateCompletion('decode_signal', { kind: 'pattern', sequence: [9, 8, 7] }, world));
    assert.deepEqual(challengePattern('open_vault', world), [...world.layout.pattern].reverse());
});
test('active worlds reject the previous click-to-complete request without advancing their campaign', async () => {
    const env = { GEMINI_API_KEY: 'mechanics-api-' + crypto.randomUUID() }, request = (path, payload) => new Request('https://game.test/api/world/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) });
    const created = await handleAPI(request('start', { setup: { premise: 'A gardener restores a strange forest city.', tone: 'mysterious', artStyle: 'watercolor' }, requestId: crypto.randomUUID() }), env, worldProviderFixture());
    assert.equal(created.status, 200);
    const j = await created.json();
    assert.equal(j.state.world.playMode, 'active');
    assert.ok(j.state.world.layout.paths.length > 8);
    const payload = { token: j.token, landmarkId: 'ally', actionId: 'rescue_ally' };
    const rejected = await handleAPI(request('act', payload), env);
    assert.equal(rejected.status, 409);
    assert.equal((await rejected.json()).code, 'INCOMPLETE_CHALLENGE');
    const completed = await handleAPI(request('act', { ...payload, challenge: completionFixture('rescue_ally', j.state.world) }), env);
    assert.equal(completed.status, 200);
    assert.equal((await completed.json()).state.campaign.turn, 1);
});
