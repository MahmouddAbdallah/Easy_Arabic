import { afterEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NOTIFICATION_CONFIG, type NotificationConfig } from '../config';
import { CONFIG_RETRY_MS, CONFIG_STALE_MS, ConfigStore } from './configStore';
import { FakeLockManager, MemoryStorage, installBrowser, settled } from './testFakes';

const CACHE_KEY = 'notification:config';
const FETCHED_AT_KEY = 'notification:config-fetched-at';
const T0 = 1_700_000_000_000;
const MINUTE = 60_000;

/** The built-in configuration at a given revision — the revision is all these tests tell configurations apart by. */
const configAt = (revision: number): NotificationConfig => ({ ...DEFAULT_NOTIFICATION_CONFIG, revision });

let restoreBrowser: (() => void) | undefined;

/** A pretend browser: the storage, locks, window and document every tab of these tests shares. */
function browser(storage = new MemoryStorage()) {
    const locks = new FakeLockManager();
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: 'visible' });
    restoreBrowser = installBrowser({ localStorage: storage, navigator: { locks }, window: win, document: doc });
    return { storage, locks, win };
}

/** What a previous visit (or another tab) left behind. */
function seed(storage: MemoryStorage, revision: number, fetchedAt: number) {
    storage.setItem(CACHE_KEY, JSON.stringify(configAt(revision)));
    storage.setItem(FETCHED_AT_KEY, String(fetchedAt));
}

/** A store whose server answers with `answers` in turn (the last one repeats); an Error makes that request fail. */
function tab(clock: { now: number }, answers: Array<number | Error> = [99]) {
    const requests = { count: 0 };
    const store = new ConfigStore({
        now: () => clock.now,
        fetchConfig: async () => {
            const answer = answers[Math.min(requests.count, answers.length - 1)];
            requests.count += 1;
            if (answer instanceof Error) throw answer;
            return configAt(answer);
        },
    });
    return { store, requests };
}

const view = (store: ConfigStore) => [store.getSnapshot().status, store.getSnapshot().config.revision];

afterEach(() => {
    mock.restoreAll();
    restoreBrowser?.();
    restoreBrowser = undefined;
});

describe('ConfigStore', () => {
    test('a copy fetched within the last 5 minutes is used as it is: nothing is requested', async () => {
        const { storage } = browser();
        seed(storage, 3, T0 - MINUTE);
        const { store, requests } = tab({ now: T0 });

        assert.deepEqual(view(store), ['ready', 3]);
        store.retain();
        await settled();

        assert.equal(requests.count, 0);
    });

    test('a stale copy is fetched once, stored for every tab, and counts as fresh afterwards', async () => {
        const { storage } = browser();
        seed(storage, 3, T0 - CONFIG_STALE_MS - 1);
        const { store, requests } = tab({ now: T0 }, [4]);

        assert.deepEqual(view(store), ['loading', 3]);
        store.retain();
        store.retain(); // two holders on one page: still one request
        await settled();

        assert.equal(requests.count, 1);
        assert.deepEqual(view(store), ['ready', 4]);
        assert.equal(JSON.parse(storage.getItem(CACHE_KEY) ?? 'null').revision, 4);
        assert.equal(storage.getItem(FETCHED_AT_KEY), String(T0));

        // A page opened afterwards (a reload, another tab) starts from that copy and asks nothing.
        const later = tab({ now: T0 + MINUTE });
        assert.deepEqual(view(later.store), ['ready', 4]);
        later.store.retain();
        await settled();
        assert.equal(later.requests.count, 0);
    });

    test('tabs that find the copy stale at the same moment make one request between them', async () => {
        const { storage } = browser();
        seed(storage, 3, T0 - 10 * MINUTE);
        const tabs = [tab({ now: T0 }, [4]), tab({ now: T0 }, [4]), tab({ now: T0 }, [4])];

        tabs.forEach(({ store }) => store.retain());
        await settled();

        assert.equal(tabs.reduce((sum, { requests }) => sum + requests.count, 0), 1);
        tabs.forEach(({ store }) => assert.deepEqual(view(store), ['ready', 4]));
    });

    test('a failed fetch keeps the copy, reports the error and is not repeated for 30 seconds', async () => {
        const { storage, win } = browser();
        mock.method(console, 'error', () => {});
        seed(storage, 3, T0 - 10 * MINUTE);
        const clock = { now: T0 };
        const { store, requests } = tab(clock, [new Error('503'), 5]);

        store.retain();
        await settled();
        assert.equal(requests.count, 1);
        assert.deepEqual(view(store), ['error', 3]);

        clock.now = T0 + CONFIG_RETRY_MS - 1;
        win.dispatchEvent(new Event('focus')); // the person comes back to the tab, but it is too soon
        await settled();
        assert.equal(requests.count, 1);

        clock.now = T0 + CONFIG_RETRY_MS;
        win.dispatchEvent(new Event('focus'));
        await settled();
        assert.equal(requests.count, 2);
        assert.deepEqual(view(store), ['ready', 5]);
    });

    test('a newer copy stored by another tab is adopted at once, an older one never replaces it', async () => {
        const { storage, win } = browser();
        seed(storage, 5, T0 - 1_000);
        const { store, requests } = tab({ now: T0 });
        store.retain();
        await settled();
        const storedByAnotherTab = (revision: number, key = CACHE_KEY) => {
            storage.setItem(CACHE_KEY, JSON.stringify(configAt(revision)));
            win.dispatchEvent(Object.assign(new Event('storage'), { key }));
        };

        storedByAnotherTab(6);
        assert.equal(store.getSnapshot().config.revision, 6);

        storedByAnotherTab(4); // a slow fetch in another tab lands late
        assert.equal(store.getSnapshot().config.revision, 6);

        storedByAnotherTab(9, 'some-other-key'); // not about the configuration
        assert.equal(store.getSnapshot().config.revision, 6);
        assert.equal(requests.count, 0);
    });

    test('coming back to a tab that missed the storage event picks up the stored copy without a request', async () => {
        const { storage, win } = browser();
        seed(storage, 5, T0 - 1_000);
        const { store, requests } = tab({ now: T0 });
        store.retain();
        await settled();

        storage.setItem(CACHE_KEY, JSON.stringify(configAt(6))); // stored while this tab was frozen: no event reached it
        win.dispatchEvent(new Event('focus'));
        await settled();

        assert.equal(store.getSnapshot().config.revision, 6);
        assert.equal(requests.count, 0);
    });

    test('apply() uses the configuration at once and stores it for the other tabs', async () => {
        const { storage } = browser();
        const { store } = tab({ now: T0 });

        store.apply(configAt(7));

        assert.deepEqual(view(store), ['ready', 7]);
        assert.equal(JSON.parse(storage.getItem(CACHE_KEY) ?? 'null').revision, 7);
        assert.equal(storage.getItem(FETCHED_AT_KEY), String(T0));
        assert.deepEqual(view(tab({ now: T0 + MINUTE }).store), ['ready', 7]);
    });

    test('a fetch time in the future (the clock was set back) does not count as fresh', async () => {
        const { storage } = browser();
        seed(storage, 3, T0 + 60 * MINUTE);
        const { store, requests } = tab({ now: T0 }, [4]);

        assert.deepEqual(view(store), ['loading', 3]);
        store.retain();
        await settled();

        assert.equal(requests.count, 1);
        assert.deepEqual(view(store), ['ready', 4]);
    });

    test('without usable storage a page still asks only once per 5 minutes', async () => {
        const { win } = browser(new MemoryStorage({ broken: true }));
        const clock = { now: T0 };
        const { store, requests } = tab(clock, [2]);

        store.retain();
        await settled();
        assert.equal(requests.count, 1);
        assert.deepEqual(view(store), ['ready', 2]);

        clock.now = T0 + CONFIG_STALE_MS - 1;
        win.dispatchEvent(new Event('focus'));
        await settled();
        assert.equal(requests.count, 1);

        clock.now = T0 + CONFIG_STALE_MS;
        win.dispatchEvent(new Event('focus'));
        await settled();
        assert.equal(requests.count, 2);
    });

    test('letting go of the store stops it listening', async () => {
        const { storage, win } = browser();
        seed(storage, 5, T0 - 1_000);
        const { store } = tab({ now: T0 });
        const release = store.retain();
        await settled();

        release();
        storage.setItem(CACHE_KEY, JSON.stringify(configAt(6)));
        win.dispatchEvent(Object.assign(new Event('storage'), { key: CACHE_KEY }));

        assert.equal(store.getSnapshot().config.revision, 5);
    });

    test('the store keeps listening until the last holder lets go, however often one of them does', async () => {
        const { storage, win } = browser();
        seed(storage, 5, T0 - 1_000);
        const { store } = tab({ now: T0 });
        const first = store.retain();
        const second = store.retain();
        await settled();
        const storedByAnotherTab = (revision: number) => {
            storage.setItem(CACHE_KEY, JSON.stringify(configAt(revision)));
            win.dispatchEvent(Object.assign(new Event('storage'), { key: CACHE_KEY }));
        };

        first();
        first(); // letting go twice must not count as the other holder letting go
        storedByAnotherTab(6);
        assert.equal(store.getSnapshot().config.revision, 6);

        second();
        storedByAnotherTab(7);
        assert.equal(store.getSnapshot().config.revision, 6);
    });

    test('a stored fetch time whose copy is gone does not count: the page fetches', async () => {
        const { storage } = browser();
        storage.setItem(FETCHED_AT_KEY, String(T0 - MINUTE)); // recent, but there is no copy it belongs to
        const { store, requests } = tab({ now: T0 }, [4]);

        assert.deepEqual(view(store), ['loading', DEFAULT_NOTIFICATION_CONFIG.revision]);
        store.retain();
        await settled();

        assert.equal(requests.count, 1);
        assert.deepEqual(view(store), ['ready', 4]);
    });

    test('a clock set back after a failed fetch does not hold the next one off for longer than the pause', async () => {
        const { storage } = browser();
        mock.method(console, 'error', () => {});
        seed(storage, 3, T0 - 10 * MINUTE);
        const clock = { now: T0 };
        const { store, requests } = tab(clock, [new Error('503'), 5]);
        store.retain();
        await settled();
        assert.equal(requests.count, 1);

        clock.now = T0 - 60 * MINUTE; // an hour back: "30 seconds from the failure" would be an hour and a half away
        store.retain(); // someone needs the configuration again
        await settled();

        assert.equal(requests.count, 2);
        assert.deepEqual(view(store), ['ready', 5]);
    });

    test('refresh() fetches although the copy is fresh', async () => {
        const { storage } = browser();
        seed(storage, 3, T0 - MINUTE);
        const { store, requests } = tab({ now: T0 }, [4]);

        await store.refresh();

        assert.equal(requests.count, 1);
        assert.deepEqual(view(store), ['ready', 4]);
    });

    test('dispose() goes back to the defaults and forgets when anything was fetched', async () => {
        const { storage } = browser();
        seed(storage, 3, T0 - MINUTE);
        const { store, requests } = tab({ now: T0 }, [4]);
        assert.deepEqual(view(store), ['ready', 3]);

        store.dispose();

        assert.deepEqual(view(store), ['loading', DEFAULT_NOTIFICATION_CONFIG.revision]);
        assert.equal(storage.getItem(FETCHED_AT_KEY), null);
        store.retain(); // nothing counts as fetched any more, so the page asks
        await settled();
        assert.equal(requests.count, 1);
        assert.deepEqual(view(store), ['ready', 4]);
    });
});
