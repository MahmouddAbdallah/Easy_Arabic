import { afterEach, beforeEach, describe, mock, test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVE_CONTEXT_ENDPOINT, ACTIVE_CONTEXT_REFRESH_MS } from '../contract';
import { trackActiveContext } from './presence';
import { installBrowser } from './testFakes';

const SETTLE_MS = 300;
const HIDE_GRACE_MS = 3_000;
const LINK = '/chat?receiverId=ali';

type Listener = (event: { type: string }) => void;

class FakeTarget {
    private readonly listeners = new Map<string, Set<Listener>>();

    addEventListener(type: string, listener: Listener) {
        this.listeners.set(type, (this.listeners.get(type) ?? new Set()).add(listener));
    }

    removeEventListener(type: string, listener: Listener) {
        this.listeners.get(type)?.delete(listener);
    }

    dispatch(type: string) {
        for (const listener of [...(this.listeners.get(type) ?? [])]) listener({ type });
    }

    get listenerCount() {
        return [...this.listeners.values()].reduce((total, set) => total + set.size, 0);
    }
}

class FakeDocument extends FakeTarget {
    visibilityState: 'visible' | 'hidden' = 'visible';
    focused = true;

    hasFocus() {
        return this.focused;
    }
}

class FakeWindow extends FakeTarget {
    touchFirst = false;

    matchMedia = (query: string) => ({ matches: this.touchFirst && query.includes('pointer: coarse') });
}

interface Report {
    url: string;
    sessionId: string;
    link: string | null;
}

/** One browser tab and the person using it: what they do to the window, and what the server was told. */
function openTab() {
    const document = new FakeDocument();
    const window = new FakeWindow();
    const reports: Report[] = [];
    const restore = installBrowser({
        document,
        window,
        fetch: async (url: string, init: { body: string }) => {
            reports.push({ url, ...JSON.parse(init.body) });
            return {};
        },
    });

    return {
        document,
        window,
        reports,
        restore,
        /** The links the server was told about, in order (null: "no longer here"). */
        get links() {
            return reports.map((report) => report.link);
        },
        /** Another app comes to the front: the window can still be seen, but it no longer has the focus. */
        switchToAnotherApp() {
            document.focused = false;
            window.dispatch('blur');
        },
        switchBack() {
            document.focused = true;
            window.dispatch('focus');
        },
        /** Minimized, or another tab selected: the page can no longer be seen. */
        hide() {
            document.visibilityState = 'hidden';
            document.focused = false;
            document.dispatch('visibilitychange');
        },
        show() {
            document.visibilityState = 'visible';
            document.focused = true;
            document.dispatch('visibilitychange');
            window.dispatch('focus');
        },
    };
}

type Tab = ReturnType<typeof openTab>;

let tab: Tab;
const stops: Array<() => void> = [];

function track(userId: string, location: string = LINK): () => void {
    const stop = trackActiveContext(userId, location);
    stops.push(stop);
    return stop;
}

beforeEach(() => {
    mock.timers.enable({ apis: ['setTimeout', 'Date'], now: 1_760_000_000_000 });
    tab = openTab();
});

afterEach(() => {
    // What the module remembers about the server outlives a test: a closing tab takes it back.
    const cleanup = trackActiveContext('cleanup', '/');
    tab.window.dispatch('pagehide');
    cleanup();
    while (stops.length) stops.pop()?.();
    tab.restore();
    mock.timers.reset();
});

describe('a tab the person is working in', () => {
    test('reports the page it shows once it has settled, to the notification endpoint', () => {
        track('u1');

        mock.timers.tick(SETTLE_MS - 1);
        assert.equal(tab.reports.length, 0);

        mock.timers.tick(1);
        assert.equal(tab.reports.length, 1);
        assert.equal(tab.reports[0].url, ACTIVE_CONTEXT_ENDPOINT);
        assert.equal(tab.reports[0].link, LINK);
        assert.equal(typeof tab.reports[0].sessionId, 'string');
    });

    test('says nothing more while nothing happens (no heartbeat)', () => {
        track('u1');
        mock.timers.tick(10 * 60_000);

        assert.deepEqual(tab.links, [LINK]);
    });

    test('renews the report when the person acts after it has aged, and only then', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.document.dispatch('pointermove');
        assert.equal(tab.reports.length, 1, 'a fresh report needs no renewal');

        mock.timers.tick(ACTIVE_CONTEXT_REFRESH_MS);
        tab.document.dispatch('keydown');
        assert.equal(tab.reports.length, 2);

        tab.document.dispatch('keydown');
        assert.equal(tab.reports.length, 2);
    });

    test('moving to another page replaces the report, without a goodbye in between', () => {
        const first = track('u1', '/lessons');
        mock.timers.tick(SETTLE_MS);

        first();
        track('u1', LINK);
        mock.timers.tick(SETTLE_MS);

        assert.deepEqual(tab.links, ['/lessons', LINK]);
    });

    test('closing the tab says goodbye at once', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.window.dispatch('pagehide');

        assert.deepEqual(tab.links, [LINK, null]);
    });

    test('stopping removes every listener it added', () => {
        const stop = track('u1');
        assert.ok(tab.document.listenerCount > 0);
        assert.ok(tab.window.listenerCount > 0);

        stop();

        assert.equal(tab.document.listenerCount, 0);
        assert.equal(tab.window.listenerCount, 0);
    });
});

describe('a window that can be seen but is not in use (another app is in front of it)', () => {
    test('is not reported as being looked at', () => {
        tab.document.focused = false;
        track('u1');

        mock.timers.tick(HIDE_GRACE_MS * 2);

        assert.deepEqual(tab.links, [], 'nothing reported, and nothing to take back');
    });

    test('is reported once the person comes back to it', () => {
        tab.document.focused = false;
        track('u1');

        tab.switchBack();
        mock.timers.tick(SETTLE_MS);

        assert.deepEqual(tab.links, [LINK]);
    });

    test('is reported as left after a short grace, so the server stops holding the notification back', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.switchToAnotherApp();
        mock.timers.tick(HIDE_GRACE_MS - 1);
        assert.deepEqual(tab.links, [LINK]);

        mock.timers.tick(1);
        assert.deepEqual(tab.links, [LINK, null]);
    });

    test('a quick look at another app costs nothing', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.switchToAnotherApp();
        mock.timers.tick(1_000);
        tab.switchBack();
        mock.timers.tick(HIDE_GRACE_MS * 2);

        assert.deepEqual(tab.links, [LINK]);
    });

    test('focus that returns without an event (it moved into an iframe of the page) is noticed when the grace ends', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.switchToAnotherApp();
        tab.document.focused = true;
        mock.timers.tick(HIDE_GRACE_MS * 2);

        assert.deepEqual(tab.links, [LINK]);
    });

    test('a pointer moving over it does not bring the person back', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);
        tab.switchToAnotherApp();
        mock.timers.tick(HIDE_GRACE_MS);
        assert.deepEqual(tab.links, [LINK, null]);

        for (const type of ['pointermove', 'pointerdown', 'scroll', 'keydown']) tab.document.dispatch(type);
        mock.timers.tick(SETTLE_MS * 2);
        assert.deepEqual(tab.links, [LINK, null], 'hovering is not a person at the keyboard');

        tab.switchBack();
        mock.timers.tick(SETTLE_MS);
        assert.deepEqual(tab.links, [LINK, null, LINK]);
    });
});

describe('a tab that cannot be seen', () => {
    test('on a computer the goodbye waits out the grace, so flipping to another tab and back costs nothing', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.hide();
        assert.deepEqual(tab.links, [LINK], 'not at once');
        mock.timers.tick(HIDE_GRACE_MS);
        assert.deepEqual(tab.links, [LINK, null]);
    });

    test('on a computer, coming back within the grace costs nothing', () => {
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.hide();
        mock.timers.tick(1_000);
        tab.show();
        mock.timers.tick(HIDE_GRACE_MS * 2);

        assert.deepEqual(tab.links, [LINK]);
    });

    test('on a phone or tablet the goodbye goes out at once: the page may be frozen before any timer fires', () => {
        tab.window.touchFirst = true;
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.hide();

        assert.deepEqual(tab.links, [LINK, null]);
    });

    test('on a phone or tablet, coming back reports the page again', () => {
        tab.window.touchFirst = true;
        track('u1');
        mock.timers.tick(SETTLE_MS);
        tab.hide();

        tab.show();
        mock.timers.tick(SETTLE_MS);

        assert.deepEqual(tab.links, [LINK, null, LINK]);
    });

    test('on a phone or tablet, a window that only lost the focus still gets the grace', () => {
        tab.window.touchFirst = true;
        track('u1');
        mock.timers.tick(SETTLE_MS);

        tab.switchToAnotherApp();
        assert.deepEqual(tab.links, [LINK]);
        mock.timers.tick(HIDE_GRACE_MS);
        assert.deepEqual(tab.links, [LINK, null]);
    });

    test('a tab that opened in the background and never reported has nothing to take back', () => {
        tab.window.touchFirst = true;
        tab.document.visibilityState = 'hidden';
        tab.document.focused = false;
        track('u1');

        mock.timers.tick(HIDE_GRACE_MS * 2);

        assert.deepEqual(tab.links, []);
    });
});
