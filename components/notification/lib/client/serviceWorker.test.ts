/**
 * The service worker (public/firebase-messaging-sw.js) run as written, on fakes of its windows and its screen
 * (see workerFakes.ts). These tests show what the worker DECIDES; they cannot show what Chrome, Firefox or Safari do
 * with those decisions — the browser rules they lean on are documented in the worker file and in the README, and a
 * real device is the only proof of them.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { settled } from './testFakes';
import { FakeClient, ORIGIN, USER_AGENTS, fcmEnvelope, loadWorker, samplePayload, type TestPayload } from './workerFakes';

const incoming = (overrides: Partial<TestPayload> = {}) => fcmEnvelope(samplePayload(overrides));

/** Browsers that let a push end without a notification while a page of the site is open. */
const MAY_SKIP = Object.entries({
    'Chrome on Windows': USER_AGENTS.chromeWindows,
    'Edge on Windows': USER_AGENTS.edgeWindows,
    'Chrome on Android': USER_AGENTS.chromeAndroid,
    'Firefox on Windows': USER_AGENTS.firefoxWindows,
});

/** Browsers that want a notification for every push (WebKit), and one we cannot tell: treated the same way. */
const MUST_SHOW = Object.entries({
    'Safari on a Mac': USER_AGENTS.safariMac,
    'a web app on the iPhone Home Screen': USER_AGENTS.safariIosApp,
    'Chrome on an iPhone': USER_AGENTS.chromeIos,
    'Firefox on an iPhone': USER_AGENTS.firefoxIos,
    'Edge on an iPhone': USER_AGENTS.edgeIos,
    'a browser the worker does not know': 'Mozilla/5.0 (X11; Linux x86_64) SomeBrowser/1.0',
    'no user agent at all': '',
});

describe('a push arrives and the person is not working in the app', () => {
    test('the page is closed: a system notification is shown, as sendNotification() described it', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });

        await w.push(incoming());

        assert.equal(w.registration.onScreen.length, 1);
        const { title, options } = w.registration.log[0];
        assert.equal(title, 'Ali');
        assert.equal(options.body, 'Sent you a message');
        assert.equal(options.tag, 'chat:ali');
        assert.equal(options.renotify, true);
        assert.equal(options.silent, undefined);
        assert.equal(options.timestamp, 1_760_000_000_000);
        assert.deepEqual(options.data, { link: '/chat?receiverId=ali', id: 'send-1', type: 'chat_message', key: 'a'.repeat(64), count: 1 });
    });

    test('a minimized window, or a tab in the background, is not asked: the system notification is shown', async () => {
        const hidden = new FakeClient({ visible: false });
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [hidden] });

        await w.push(incoming());

        assert.equal(hidden.received.length, 0);
        assert.equal(w.registration.onScreen.length, 1);
    });

    for (const [name, userAgent] of [...MAY_SKIP, ...MUST_SHOW]) {
        test(`${name}: a window that can be seen but is not the one in use (another app is in front) gets the system notification, not a pop-up`, async () => {
            const behind = new FakeClient({ visible: true, focused: false });
            const w = loadWorker({ userAgent, clients: [behind] });

            await w.push(incoming());

            assert.equal(behind.received.length, 0, 'a pop-up inside a window nobody is looking at goes unseen');
            assert.equal(w.registration.onScreen.length, 1);
            assert.equal(w.registration.onScreen[0].title, 'Ali');
        });
    }

    test('a page that answers "not me" leaves the notification to the system', async () => {
        const page = new FakeClient({ reply: 'declined' });
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [page] });

        await w.push(incoming());

        assert.equal(page.received.length, 1);
        assert.equal(w.registration.onScreen.length, 1);
    });

    test('a page that never answers is given a second, then the system notification is shown', async () => {
        const page = new FakeClient({ reply: 'none' });
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [page] });

        const done = w.push(incoming());
        await settled();
        assert.equal(w.registration.log.length, 0, 'still waiting for the page');
        w.timers.advance(999);
        await settled();
        assert.equal(w.registration.log.length, 0, 'still waiting for the page');
        w.timers.advance(1);
        await done;

        assert.equal(w.registration.onScreen.length, 1);
    });

    test('a page that cannot be reached at all is treated like one that did not answer', async () => {
        const page = new FakeClient();
        page.postMessage = () => {
            throw new Error('the window is gone');
        };
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [page] });

        await w.push(incoming());

        assert.equal(w.registration.onScreen.length, 1);
    });

    test('a declined push on WebKit is a normal notification that stays on screen', async () => {
        const page = new FakeClient({ reply: 'declined' });
        const w = loadWorker({ userAgent: USER_AGENTS.safariMac, clients: [page] });

        await w.push(incoming());

        assert.equal(w.registration.log.length, 1);
        assert.equal(w.registration.onScreen.length, 1);
        assert.equal(w.registration.closed.length, 0);
        assert.notEqual(w.registration.onScreen[0].options.silent, true);
    });
});

describe('a push arrives while the person is working in the app', () => {
    for (const [name, userAgent] of MAY_SKIP) {
        test(`${name}: the page takes it as a pop-up and the worker draws nothing`, async () => {
            const page = new FakeClient({ url: `${ORIGIN}/lessons` });
            const w = loadWorker({ userAgent, clients: [page] });

            await w.push(incoming());

            assert.deepEqual(page.received, [{ type: 'NOTIFICATION_RECEIVED', payload: samplePayload() }]);
            assert.equal(w.registration.log.length, 0);
        });
    }

    for (const [name, userAgent] of MUST_SHOW) {
        test(`${name}: the page takes it, and a notification is still drawn and taken straight back`, async () => {
            const page = new FakeClient({ url: `${ORIGIN}/lessons` });
            const w = loadWorker({ userAgent, clients: [page] });

            await w.push(incoming());

            assert.equal(page.received.length, 1, 'the page was given the notification');
            assert.equal(w.registration.log.length, 1, 'the push still ended in a notification, which is what WebKit insists on');
            assert.equal(w.registration.log[0].options.silent, true, 'without a sound: the page has alerted the person already');
            assert.equal(w.registration.onScreen.length, 0, 'and nothing stays on screen');
            assert.equal(w.registration.closed.length, 1);
        });
    }

    test('taking the notification back does not remove an unread one of the same conversation', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.safariMac });
        await w.push(incoming({ id: 'send-0' })); // nobody is in the app: this one is shown and stays
        w.clients.push(new FakeClient());

        await w.push(incoming({ id: 'send-1' })); // the page takes this one

        assert.equal(w.registration.onScreen.length, 1);
        assert.equal(w.registration.onScreen[0].data?.id, 'send-0');
    });

    test('with several windows only the one in use is asked', async () => {
        const hidden = new FakeClient({ visible: false });
        const behind = new FakeClient({ focused: false });
        const inUse = new FakeClient();
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [hidden, behind, inUse] });

        await w.push(incoming());

        assert.equal(hidden.received.length, 0);
        assert.equal(behind.received.length, 0);
        assert.equal(inUse.received.length, 1);
        assert.equal(w.registration.log.length, 0);
    });

    test('if the window in use does not take it, the other windows are not asked in its place', async () => {
        const inUse = new FakeClient({ reply: 'declined' });
        const behind = new FakeClient({ focused: false });
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [inUse, behind] });

        await w.push(incoming());

        assert.equal(behind.received.length, 0);
        assert.equal(w.registration.onScreen.length, 1);
    });
});

describe('notifications about the same thing', () => {
    test('a second message of a conversation replaces the first, alerts again and says how many there are', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });

        await w.push(incoming({ id: 'send-1' }));
        await w.push(incoming({ id: 'send-2' }));
        await w.push(incoming({ id: 'send-3' }));

        assert.equal(w.registration.onScreen.length, 1);
        assert.equal(w.registration.onScreen[0].title, 'Ali (3)');
        assert.equal(w.registration.onScreen[0].options.renotify, true);
        assert.equal(w.registration.onScreen[0].data?.count, 3);
    });

    test('the same send delivered twice is not counted twice', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });

        await w.push(incoming({ id: 'send-1' }));
        await w.push(incoming({ id: 'send-1' }));

        assert.equal(w.registration.onScreen.length, 1);
        assert.equal(w.registration.onScreen[0].title, 'Ali');
    });

    test('without a tag, an identical repeat (same key) replaces the earlier one quietly and anything else stands alone', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });
        const untagged = { tag: undefined, key: 'b'.repeat(64) };

        await w.push(incoming({ ...untagged, id: 'send-1' }));
        await w.push(incoming({ ...untagged, id: 'send-2' }));
        assert.equal(w.registration.onScreen.length, 1);
        assert.equal(w.registration.onScreen[0].options.renotify, false);

        await w.push(incoming({ tag: undefined, key: undefined, id: 'send-3' }));
        await w.push(incoming({ tag: undefined, key: undefined, id: 'send-4' }));
        assert.equal(w.registration.onScreen.length, 3);
    });

    test('a push for a recipient whose sound is off is shown silently', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });

        await w.push(incoming({ silent: true }));

        assert.equal(w.registration.log[0].options.silent, true);
    });
});

describe('what the worker can read', () => {
    test('a plain FCM notification message (a test sent from the Firebase console) is shown too', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });

        await w.push({ notification: { title: 'Hello', body: 'From the console' }, fcmMessageId: 'm1', fcmOptions: { link: '/lessons' } });

        assert.equal(w.registration.onScreen[0].title, 'Hello');
        assert.equal(w.registration.onScreen[0].data?.link, '/lessons');
        assert.equal(w.registration.onScreen[0].data?.type, 'general');
    });

    test('a push that is not ours draws nothing and does not make the worker throw', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });

        await w.pushEmpty();
        await w.push('just text');
        await w.push(() => {
            throw new SyntaxError('not json');
        });
        await w.push({ data: { payload: '{"v":2,"id":"x","title":"t","body":"b"}' } });
        await w.push({ data: { payload: 'not json' } });

        assert.equal(w.registration.log.length, 0);
    });

    test('a browser that refuses an option gets a plainer notification instead of none', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });
        w.registration.refuse = (options) => (options.image ? new TypeError('the image is refused') : undefined);

        await w.push(incoming({ image: `${ORIGIN}/banner.png` }));

        assert.equal(w.registration.onScreen.length, 1);
        const { title, options } = w.registration.log[0];
        assert.equal(title, 'Ali');
        assert.equal(options.body, 'Sent you a message');
        assert.equal(options.tag, 'chat:ali');
        assert.equal(options.image, undefined);
        assert.equal(options.data?.link, '/chat?receiverId=ali');
    });
});

describe('the person clicks a system notification', () => {
    test('the app opens at the notification\'s link, the notification closes and the server is told it was handled', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });
        await w.push(incoming());

        await w.click(w.registration.onScreen[0]);

        assert.deepEqual(w.opened, [`${ORIGIN}/chat?receiverId=ali`]);
        assert.equal(w.registration.onScreen.length, 0);
        assert.equal(w.requests.length, 1);
        assert.equal(w.requests[0].url, '/api/notification/handled');
        assert.equal(w.requests[0].init?.method, 'POST');
        assert.equal(w.requests[0].init?.credentials, 'same-origin');
        assert.deepEqual(JSON.parse(w.requests[0].init?.body ?? 'null'), { key: 'a'.repeat(64) });
    });

    test('a window already showing the link is brought forward, nothing else opens', async () => {
        const page = new FakeClient({ url: `${ORIGIN}/chat?receiverId=ali`, visible: false });
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [page] });
        await w.push(incoming());

        await w.click(w.registration.onScreen[0]);

        assert.equal(page.focusCalls, 1);
        assert.equal(w.opened.length, 0);
        assert.equal(page.navigations.length, 0);
        assert.equal(page.received.length, 0);
    });

    test('another window of the app is asked to go to the link with its own router', async () => {
        const page = new FakeClient({ url: `${ORIGIN}/lessons`, visible: false });
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [page] });
        await w.push(incoming());

        await w.click(w.registration.onScreen[0]);

        assert.equal(page.focusCalls, 1);
        assert.deepEqual(page.received, [{ type: 'NOTIFICATION_CLICK', link: '/chat?receiverId=ali' }]);
        assert.equal(w.opened.length, 0);
    });

    test('a window that does not answer is navigated when the worker may, and a new window is opened when it may not', async () => {
        const navigable = new FakeClient({ url: `${ORIGIN}/lessons`, visible: false, reply: 'none', canNavigate: true });
        const first = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [navigable] });
        await first.push(incoming());
        const clicked = first.click(first.registration.onScreen[0]);
        await settled();
        first.timers.advance(1000);
        await clicked;
        assert.deepEqual(navigable.navigations, [`${ORIGIN}/chat?receiverId=ali`]);
        assert.equal(first.opened.length, 0);

        const fixed = new FakeClient({ url: `${ORIGIN}/lessons`, visible: false, reply: 'none' });
        const second = loadWorker({ userAgent: USER_AGENTS.chromeWindows, clients: [fixed] });
        await second.push(incoming());
        const clickedAgain = second.click(second.registration.onScreen[0]);
        await settled();
        second.timers.advance(1000);
        await clickedAgain;
        assert.deepEqual(second.opened, [`${ORIGIN}/chat?receiverId=ali`]);
    });

    test('a link to another site, or no link, leads to the app\'s home page', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });
        await w.push(incoming({ id: 'a', tag: undefined, link: 'https://evil.test/phish' }));
        await w.push(incoming({ id: 'b', tag: undefined, key: 'c'.repeat(64), link: undefined }));

        for (const notification of [...w.registration.onScreen]) await w.click(notification);

        assert.deepEqual(w.opened, [`${ORIGIN}/`, `${ORIGIN}/`]);
    });

    test('a notification without a stored copy (no key) reports nothing to the server', async () => {
        const w = loadWorker({ userAgent: USER_AGENTS.chromeWindows });
        await w.push(incoming({ key: undefined }));

        await w.click(w.registration.onScreen[0]);

        assert.equal(w.requests.length, 0);
        assert.equal(w.opened.length, 1);
    });
});
