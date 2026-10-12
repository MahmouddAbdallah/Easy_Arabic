import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { withCrossTabLock } from './locks';
import { FakeLockManager, deferred, installBrowser, settled, sleep } from './testFakes';

describe('withCrossTabLock', () => {
    test('tasks that ask for the same lock run one after another, in the order they asked', async () => {
        const locks = new FakeLockManager();
        const log: string[] = [];
        let active = 0;
        let mostAtOnce = 0;
        const job = (name: string, ms: number) =>
            withCrossTabLock(
                'shared',
                async () => {
                    active += 1;
                    mostAtOnce = Math.max(mostAtOnce, active);
                    log.push(`start ${name}`);
                    await sleep(ms);
                    log.push(`end ${name}`);
                    active -= 1;
                    return name;
                },
                { locks }
            );

        const results = await Promise.all([job('a', 15), job('b', 5), job('c', 1)]);

        assert.deepEqual(results, ['a', 'b', 'c']);
        assert.equal(mostAtOnce, 1);
        assert.deepEqual(log, ['start a', 'end a', 'start b', 'end b', 'start c', 'end c']);
    });

    test('different locks do not wait for each other', async () => {
        const locks = new FakeLockManager();
        const release = deferred();
        const held = withCrossTabLock('one', () => release.promise, { locks });

        assert.equal(await withCrossTabLock('two', async () => 'done', { locks }), 'done');

        release.resolve();
        await held;
    });

    test('hands back what the task returns and what it throws, and frees the lock either way', async () => {
        const locks = new FakeLockManager();
        const failure = new Error('boom');

        await assert.rejects(
            withCrossTabLock('x', async () => { throw failure; }, { locks }),
            (error) => error === failure
        );
        assert.equal(await withCrossTabLock('x', async () => 42, { locks }), 42);
        assert.equal(locks.grants.length, 2, 'the second task was granted the lock, it did not give up waiting for it');
    });

    test('runs the task without a lock where Web Locks do not exist', async () => {
        const restore = installBrowser({ navigator: {} });
        try {
            assert.equal(await withCrossTabLock('x', async () => 'ran'), 'ran');
        } finally {
            restore();
        }
    });

    test('stops waiting for a lock that stays held and runs the task without it', async () => {
        const locks = new FakeLockManager();
        const release = deferred();
        const held = withCrossTabLock('x', () => release.promise, { locks });
        await settled(); // the first task has the lock

        const startedAt = Date.now();
        const result = await withCrossTabLock('x', async () => 'went ahead', { locks, waitMs: 30 });

        assert.equal(result, 'went ahead');
        assert.ok(Date.now() - startedAt >= 20, 'it did wait for the lock first');
        assert.equal(locks.waiting('x'), 0, 'the request it gave up left the queue');

        release.resolve();
        await held;
        await settled();
        assert.equal(locks.grants.length, 1, 'the request it gave up was never granted afterwards');
    });

    test('a task that takes longer than waitMs is not cut short once it holds the lock', async () => {
        const locks = new FakeLockManager();

        const result = await withCrossTabLock(
            'x',
            async () => {
                await sleep(60);
                return 'finished';
            },
            { locks, waitMs: 20 }
        );

        assert.equal(result, 'finished');
        assert.equal(locks.lastSignal?.aborted, false, 'the wait timer was cleared when the lock was granted');
    });

    test('runs the task without a lock when the browser refuses the request', async () => {
        let runs = 0;
        const refusing = { request: () => Promise.reject(new DOMException('not allowed here', 'SecurityError')) };

        const result = await withCrossTabLock('x', async () => { runs += 1; return 'ran'; }, { locks: refusing });

        assert.deepEqual([result, runs], ['ran', 1]);
    });

    test('a task that fails with an AbortError is the task failing: it is not run a second time', async () => {
        const locks = new FakeLockManager();
        const abort = new DOMException('the task was aborted', 'AbortError');
        let runs = 0;

        await assert.rejects(
            withCrossTabLock('x', async () => { runs += 1; throw abort; }, { locks }),
            (error) => error === abort
        );

        assert.equal(runs, 1);
    });
});
