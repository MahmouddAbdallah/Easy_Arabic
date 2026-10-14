import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_NOTIFICATION_CONFIG } from '../config';
import { NOTIFICATION_PAYLOAD_VERSION, type NotificationPayload } from '../contract';
import { DEFAULT_SETTINGS, type NotificationSettings } from '../settings';
import { createAlertCenter, takenInApp, type AlertOutcome } from './alerts';

const NOON_UTC = Date.UTC(2025, 9, 14, 12, 0);

function payload(overrides: Partial<NotificationPayload> = {}): NotificationPayload {
    return {
        v: NOTIFICATION_PAYLOAD_VERSION,
        id: 'send-1',
        type: 'chat_message',
        title: 'Ali',
        body: 'Sent you a message',
        link: '/chat?receiverId=ali',
        sentAt: NOON_UTC,
        ...overrides,
    };
}

/** A pretend page. The person is working in it with pop-ups and sound on, until a test says otherwise. */
function page() {
    const state = {
        settings: { ...DEFAULT_SETTINGS } as NotificationSettings,
        visible: true,
        focused: true,
        pushActive: false,
        viewing: undefined as string | undefined,
        now: NOON_UTC,
    };
    const popups: NotificationPayload[] = [];
    const sounds: string[] = [];
    const center = createAlertCenter({
        settings: () => state.settings,
        config: () => DEFAULT_NOTIFICATION_CONFIG,
        isVisible: () => state.visible,
        isFocused: () => state.focused,
        pushActive: () => state.pushActive,
        isViewing: (link) => link === state.viewing,
        showPopup: (shown) => void popups.push(shown),
        playSound: (id) => void sounds.push(id),
        now: () => state.now,
    });
    const offer = (offered: NotificationPayload = payload(), source: 'push' | 'inbox' = 'push') => center.offer({ payload: offered, source });
    return { state, popups, sounds, offer };
}

describe('a notification arrives while the app is open and in use', () => {
    test('it pops up and plays the sound', () => {
        const p = page();

        assert.equal(p.offer(), 'shown');
        assert.deepEqual(p.popups, [payload()]);
        assert.deepEqual(p.sounds, ['send-1']);
    });

    test('the pop-up and the sound follow the person\'s settings', () => {
        const noPopup = page();
        noPopup.state.settings = { ...DEFAULT_SETTINGS, popups: false };
        assert.equal(noPopup.offer(), 'shown');
        assert.equal(noPopup.popups.length, 0);
        assert.equal(noPopup.sounds.length, 1);

        const noSound = page();
        noSound.state.settings = { ...DEFAULT_SETTINGS, sound: false };
        assert.equal(noSound.offer(), 'shown');
        assert.equal(noSound.popups.length, 1);
        assert.equal(noSound.sounds.length, 0);

        const neither = page();
        neither.state.settings = { ...DEFAULT_SETTINGS, popups: false, sound: false };
        assert.equal(neither.offer(), 'silent');
        assert.equal(neither.popups.length + neither.sounds.length, 0);
    });

    test('paused, or the section muted: nothing is shown', () => {
        const paused = page();
        paused.state.settings = { ...DEFAULT_SETTINGS, enabled: false };
        assert.equal(paused.offer(), 'silent');

        const muted = page();
        muted.state.settings = { ...DEFAULT_SETTINGS, categories: { ...DEFAULT_SETTINGS.categories, messages: false } };
        assert.equal(muted.offer(), 'silent');
        assert.equal(muted.popups.length + muted.sounds.length, 0);
    });

    test('inside quiet hours the pop-up still appears, the sound does not', () => {
        const p = page();
        p.state.settings = { ...DEFAULT_SETTINGS, quietHours: { enabled: true, start: '00:00', end: '23:59', timeZone: 'UTC' } };

        assert.equal(p.offer(), 'shown');
        assert.equal(p.popups.length, 1);
        assert.equal(p.sounds.length, 0);
    });

    test('the push and the stored copy of one send make one pop-up, whichever comes first', () => {
        const pushFirst = page();
        assert.equal(pushFirst.offer(payload(), 'push'), 'shown');
        assert.equal(pushFirst.offer(payload(), 'inbox'), 'duplicate');
        assert.equal(pushFirst.popups.length, 1);

        const inboxFirst = page();
        assert.equal(inboxFirst.offer(payload(), 'inbox'), 'shown');
        assert.equal(inboxFirst.offer(payload(), 'push'), 'duplicate');
        assert.equal(inboxFirst.popups.length, 1);
    });

    test('a send id is forgotten after two minutes: a later send that reuses it is shown again', () => {
        const p = page();
        p.offer();

        p.state.now += 2 * 60_000 - 1;
        assert.equal(p.offer(), 'duplicate');

        p.state.now += 2 * 60_000;
        assert.equal(p.offer(), 'shown');
    });

    test('a notification about the page the person is on tells them nothing new', () => {
        const p = page();
        p.state.viewing = '/chat?receiverId=ali';

        assert.equal(p.offer(), 'viewing');
        assert.equal(p.popups.length + p.sounds.length, 0);
    });
});

describe('a tab the person is not working in', () => {
    test('a hidden tab shows nothing', () => {
        const p = page();
        p.state.visible = false;
        p.state.focused = false;

        assert.equal(p.offer(), 'hidden');
        assert.equal(p.popups.length + p.sounds.length, 0);
    });

    test('a tab that can be seen but is not in use leaves the alert to the system notification, when one is on its way', () => {
        const p = page();
        p.state.focused = false; // another app is in front of the window
        p.state.pushActive = true;

        assert.equal(p.offer(), 'background');
        assert.equal(p.popups.length + p.sounds.length, 0, 'no pop-up and no sound inside a window nobody is looking at');
    });

    test('without a system notification coming, the pop-up is the only alert there is, so it is shown', () => {
        const noPush = page();
        noPush.state.focused = false;
        noPush.state.pushActive = false; // no permission, no registered device, or push switched off here
        assert.equal(noPush.offer(), 'shown');
        assert.equal(noPush.popups.length, 1);

        const quiet = page();
        quiet.state.focused = false;
        quiet.state.pushActive = true;
        quiet.state.settings = { ...DEFAULT_SETTINGS, quietHours: { enabled: true, start: '00:00', end: '23:59', timeZone: 'UTC' } }; // the server sends no push now
        assert.equal(quiet.offer(), 'shown');
        assert.equal(quiet.popups.length, 1);
    });

    test('a paused person is not alerted in an unused tab either', () => {
        const p = page();
        p.state.focused = false;
        p.state.pushActive = true;
        p.state.settings = { ...DEFAULT_SETTINGS, enabled: false };

        assert.equal(p.offer(), 'silent');
        assert.equal(p.popups.length, 0);
    });

    test('a notification nothing was shown for is not remembered: the same send is shown once the person is back', () => {
        const away = page();
        away.state.focused = false;
        away.state.pushActive = true;
        assert.equal(away.offer(payload(), 'inbox'), 'background');
        away.state.focused = true; // the person comes back before the push reaches the page
        assert.equal(away.offer(payload(), 'push'), 'shown');
        assert.equal(away.popups.length, 1);

        const hidden = page();
        hidden.state.visible = false;
        hidden.state.focused = false;
        assert.equal(hidden.offer(payload(), 'inbox'), 'hidden');
        hidden.state.visible = true;
        hidden.state.focused = true;
        assert.equal(hidden.offer(payload(), 'push'), 'shown');
        assert.equal(hidden.popups.length, 1);
    });
});

describe('what the service worker is told', () => {
    const table: Array<[AlertOutcome, boolean]> = [
        ['shown', true],
        ['duplicate', true], // shown a moment ago, by the other route
        ['viewing', true], // the person is on that page
        ['silent', true], // the person chose no pop-up and no sound; a system notification would be the duplicate they opted out of
        ['hidden', false], // nobody could see anything
        ['background', false], // the system notification is the alert
    ];

    for (const [outcome, taken] of table) {
        test(`${outcome}: ${taken ? 'taken in the app' : 'the worker draws the system notification'}`, () => {
            assert.equal(takenInApp(outcome), taken);
        });
    }

    test('a push offered to a tab that went to the background a moment after the worker looked is not taken', () => {
        const p = page();
        p.state.focused = false;
        p.state.pushActive = true;

        assert.equal(takenInApp(p.offer(payload(), 'push')), false);
    });

    test('a push offered to a tab in use is taken, even when the settings leave nothing to show', () => {
        const p = page();
        p.state.settings = { ...DEFAULT_SETTINGS, popups: false, sound: false };

        assert.equal(takenInApp(p.offer(payload(), 'push')), true);
    });
});
