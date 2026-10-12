import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import type { DocumentSnapshot } from 'firebase-admin/firestore';
import { cachedChoices, rememberChoices } from './settings';

/** The two things rememberChoices reads from a snapshot. */
const snapshot = (id: string, data?: Record<string, unknown>) => ({ id, data: () => data }) as unknown as DocumentSnapshot;

// Keep in step with SETTINGS_CACHE_MAX and SETTINGS_CACHE_MS in ./settings.ts.
const CAPACITY = 5_000;
const FRESH_MS = 20_000;
const NOW = 1_000_000;

/**
 * Reads `CAPACITY` distinct users, `${prefix}0` first. The cache is shared by every test in this file, and that many new
 * users push out whatever was in it before — so each test that needs a full cache starts by calling this with its own prefix.
 */
function fillToCapacity(prefix: string) {
    for (let i = 0; i < CAPACITY; i += 1) rememberChoices(snapshot(`${prefix}${i}`), NOW);
}

describe('the settings cache', () => {
    test('remembers what a user chose for 20 seconds, then asks for a fresh read', () => {
        const stored = rememberChoices(snapshot('fresh-user', { enabled: false, unrelated: 'dropped' }), NOW);

        assert.deepEqual(stored, { enabled: false });
        assert.deepEqual(cachedChoices('fresh-user', NOW + FRESH_MS - 1), { enabled: false });
        assert.equal(cachedChoices('fresh-user', NOW + FRESH_MS), undefined);
        assert.equal(cachedChoices('never-read-user', NOW), undefined);
    });

    test('a user who has no settings document is remembered as having chosen nothing', () => {
        rememberChoices(snapshot('no-document-user'), NOW);

        assert.deepEqual(cachedChoices('no-document-user', NOW), {});
    });

    test('reading a user who is already cached makes room for nobody: no other entry is pushed out', () => {
        fillToCapacity('full-a-');

        rememberChoices(snapshot('full-a-1', { enabled: false }), NOW + 1);

        assert.deepEqual(cachedChoices('full-a-1', NOW + 1), { enabled: false });
        assert.deepEqual(cachedChoices('full-a-0', NOW + 1), {}, 'the oldest entry was not needed for the room');
        assert.deepEqual(cachedChoices(`full-a-${CAPACITY - 1}`, NOW + 1), {});
    });

    test('when the cache is full, the entries read longest ago go — never one that has just been read again', () => {
        fillToCapacity('full-b-');

        rememberChoices(snapshot('full-b-1', { enabled: false }), NOW + 1); // the second oldest, read again: now the newest
        rememberChoices(snapshot('newcomer-1'), NOW + 2); // each newcomer pushes out the entry read longest ago
        rememberChoices(snapshot('newcomer-2'), NOW + 3);

        assert.deepEqual(cachedChoices('full-b-1', NOW + 3), { enabled: false }, 'the user read again is still cached');
        assert.equal(cachedChoices('full-b-0', NOW + 3), undefined, 'the oldest went first');
        assert.equal(cachedChoices('full-b-2', NOW + 3), undefined, 'the next oldest went second');
        assert.deepEqual(cachedChoices('full-b-3', NOW + 3), {});
        assert.deepEqual(cachedChoices('newcomer-1', NOW + 3), {});
        assert.deepEqual(cachedChoices('newcomer-2', NOW + 3), {});
    });
});
