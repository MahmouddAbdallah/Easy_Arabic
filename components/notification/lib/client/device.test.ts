import { afterEach, before, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import type * as DeviceModule from './device';
import { FakeLockManager, MemoryStorage, deferred, installBrowser, settled } from './testFakes';

const MARKER_KEY = 'notification:registered-device';

let device: typeof DeviceModule;

before(async () => {
    // lib/config/firebase-client builds the Firebase web app the moment it is imported; any values will do for that.
    process.env.NEXT_PUBLIC_FIREBASE_API_KEY ??= 'test-key';
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ??= 'test-project';
    process.env.NEXT_PUBLIC_FIREBASE_APP_ID ??= '1:1:web:1';
    device = await import('./device');
});

describe('registerDeviceOnce', () => {
    let storage: MemoryStorage;
    let locks: FakeLockManager;
    let restoreBrowser: () => void;
    let requests: Array<{ url: string; body: unknown }>;
    let respond: () => Promise<unknown>;

    beforeEach(() => {
        storage = new MemoryStorage();
        locks = new FakeLockManager();
        restoreBrowser = installBrowser({ localStorage: storage, navigator: { locks, userAgent: 'test-agent' } });
        requests = [];
        respond = async () => ({ data: {} });
        mock.method(axios, 'post', (async (url: string, body: unknown) => {
            requests.push({ url, body });
            return respond();
        }) as unknown as typeof axios.post);
    });

    afterEach(() => {
        mock.restoreAll();
        restoreBrowser();
    });

    test('tabs that need to register at the same moment make one request between them', async () => {
        const results = await Promise.all(Array.from({ length: 5 }, () => device.registerDeviceOnce('u1', 'tok')));

        assert.deepEqual(results, [true, true, true, true, true]);
        assert.equal(requests.length, 1);
        assert.equal(locks.grants.length, 5, 'every tab took its turn on the lock');
        assert.equal(JSON.parse(storage.getItem(MARKER_KEY) ?? 'null').device, 'u1:tok');
    });

    test('the request carries the token and this browser', async () => {
        await device.registerDeviceOnce('u1', 'tok');

        assert.deepEqual(requests[0].body, { fcmToken: 'tok', deviceType: 'test-agent' });
    });

    test('without Web Locks every tab registers for itself, as it always did', async () => {
        restoreBrowser();
        restoreBrowser = installBrowser({ localStorage: storage, navigator: { userAgent: 'test-agent' } });

        await Promise.all(Array.from({ length: 5 }, () => device.registerDeviceOnce('u1', 'tok')));

        assert.equal(requests.length, 5);
    });

    test('a browser that is already registered for this user and token asks nothing', async () => {
        await device.registerDeviceOnce('u1', 'tok');
        await device.registerDeviceOnce('u1', 'tok');

        assert.equal(requests.length, 1);
    });

    test('another user, or a new token, is registered again', async () => {
        await device.registerDeviceOnce('u1', 'tok');
        await device.registerDeviceOnce('u2', 'tok');
        await device.registerDeviceOnce('u2', 'tok-renewed');

        assert.equal(requests.length, 3);
    });

    test('force registers although the marker says this browser already is', async () => {
        await device.registerDeviceOnce('u1', 'tok');
        await device.registerDeviceOnce('u1', 'tok', true);

        assert.equal(requests.length, 2);
    });

    test('a failed save leaves no marker and frees the lock, so the next attempt tries again', async () => {
        respond = async () => {
            throw new Error('server down');
        };
        await assert.rejects(device.registerDeviceOnce('u1', 'tok'), /server down/);
        assert.equal(storage.getItem(MARKER_KEY), null);

        respond = async () => ({ data: {} });
        assert.equal(await device.registerDeviceOnce('u1', 'tok'), true);
        assert.equal(requests.length, 2);
    });

    test('push turned off in another tab while this one waited for the lock: nothing is sent', async () => {
        const firstSave = deferred<never>();
        respond = () => firstSave.promise;

        const first = device.registerDeviceOnce('u1', 'tok');
        await settled(); // the first tab holds the lock and its request is on the way
        const second = device.registerDeviceOnce('u1', 'tok'); // waits its turn
        device.setPushOptOut('u1', true); // meanwhile the person switches push off on this device
        firstSave.reject(new Error('server down')); // the first save fails, so no marker tells the second tab it is done

        await assert.rejects(first, /server down/);
        assert.equal(await second, false);
        assert.equal(requests.length, 1);
    });
});
