# Notifications

Push notifications (FCM + service worker), the in-app notification list and its settings, in-app pop-ups and
sound, and the unread counter. Everything the rest of the app needs is two things: call `sendNotification()` on
the server, and render `<NotificationBody />` (the app root already mounts `<NotificationProvider>`).

Related code outside this folder: `app/api/notification/*` (HTTP endpoints) and
`public/firebase-messaging-sw.js` (service worker — plain JS, cannot import from here; keep it in step
with `lib/contract.ts`).

## Layout

```
components/notification/
├── NotificationProvider.tsx          app-wide: composes the hooks below, renders the permission prompt
├── NotificationBody.tsx              the list (works without push permission) + the settings screen
├── NotificationSettingsPanel.tsx     the settings UI          ── Switch.tsx
├── NotificationPermissionPrompt.tsx  our "turn on notifications" card
├── NotificationItem.tsx / NotificationToast.tsx / typeIcons.ts
├── ActiveContextReporter.tsx         reports the current page of this tab
├── hooks/
│   ├── useNotifications.ts              list facade over the shared inbox store
│   ├── useNotificationSettingsState.ts  settings: one doc listener, optimistic, debounced saves
│   ├── usePushRegistration.ts           support, browser permission, FCM token, "off on this device"
│   ├── usePermissionPrompt.ts           when to show the prompt (7-day rule)
│   ├── useInAppAlerts.ts                pop-up + sound for notifications that arrive while the app is open
│   └── useServiceWorkerBridge.ts        service worker -> page: pushes, click navigation
└── lib/
    ├── contract.ts          shared constants, wire format, types (no server/browser imports)
    ├── settings.ts          the settings shape, defaults, normalise/merge (shared)
    ├── policy.ts            settings -> "may this alert?" incl. quiet hours (shared: server + browser agree)
    ├── location.ts          "same page?" comparison (shared)
    ├── schema.ts            zod schemas for sendNotification() and the API bodies
    ├── sendNotification.ts  PUBLIC server API: validate -> dedupe -> suppress -> push + store
    ├── server/              server only (`import 'server-only'` guards the build)
    │   ├── recipients.ts      per-recipient presence + settings in ONE batched read
    │   ├── settings.ts        settings writes + a short per-instance read cache
    │   ├── presence.ts        which page each tab shows (for suppression)
    │   ├── recentSends.ts     drops an accidental identical repeat before any I/O
    │   ├── push.ts            FCM delivery + dead-token cleanup
    │   ├── devices.ts         UserFCMToken table (Prisma)
    │   ├── inbox.ts           `Notification` documents + unread counter writes
    │   ├── unreadCounter.ts   counter read/write helpers used inside transactions
    │   ├── identity.ts        what makes two notifications "the same one"
    │   ├── firestore.ts       lazy firebase-admin access
    │   └── chunk.ts
    └── client/              browser only
        ├── inboxStore.ts      THE one Firestore listener on the list (shared by bell, page, alerts)
        ├── alerts.ts          pop-up/sound decisions + push/stored de-duplication (no browser APIs: testable)
        ├── sound.ts           Web Audio chime, autoplay-safe, rate-limited, one tab per alert
        ├── promptGate.ts      the 7-day rule for our prompt
        ├── presence.ts        event-driven page reporter (no heartbeat)
        ├── device.ts          FCM token, registration marker, per-device opt-out
        └── api.ts             every request to /api/notification
```

Dependencies point one way: `sendNotification` -> `server/*` -> `contract`/`settings`/`policy`; hooks and
components -> `lib/client/*` -> the shared modules. Routes in `app/api/notification` are thin:
`_lib/route.ts` handles auth, body validation and errors once.

## Two kinds of "notification", kept apart

- **In the list (inbox).** Stored in Firestore for every recipient, whatever their settings or push
  permission. This is the record; it and the unread badge never depend on push.
- **Alerts.** A system **push** (works with the app closed; needs browser permission and a registered
  device) and, while the app is open, an in-app **pop-up** and **sound**. Alerts are what settings control.

## Flows

**Send.** `sendNotification()` validates, builds one payload (with a send `id`, and the `key`/`tag` that say
which notification it is), drops an identical repeat from the last 3 s, then reads each recipient's presence
and settings in one batch. Recipients on the notification's page get nothing at all. The rest are stored
in the list; of those, the ones whose settings allow it are pushed to — people with sound off get a *silent*
push. Push and storage run in parallel and never fail each other. It never throws; the result reports
`suppressed`, `muted`, `duplicate` next to the old fields.

**Receive.** FCM data message -> service worker. A visible page gets it (`useServiceWorkerBridge` ->
`useInAppAlerts`) and decides on pop-up/sound; otherwise the worker draws a system notification. Pushes
with a `tag` replace each other and are counted ("Ali (3)"). Clicking either kind tells the server
(`POST /handled`), which deletes the stored copy.

**In-app alerts without push.** `useInAppAlerts` also watches the shared inbox store for new unread
arrivals, so people who never enabled push still get pop-ups and sound. A push and its stored copy of the
same send carry the same id and produce one pop-up and one sound, whichever arrives first.

**Settings.** `notificationSettings/{userId}` is read live by the browser (one document listener) and
written only by `PATCH /api/notification/settings`. Edits apply instantly, are saved after 400 ms as one
request (never two in flight), and roll back with a message if the server refuses. The server enforces them
when sending (pause, muted categories, quiet hours, silent push); the browser enforces pop-up and sound.

| Setting | Effect |
|---|---|
| Notifications (master) | Off = no push, pop-up or sound. The list still fills and the badge still counts. |
| Pop-ups / Sound | In-app only. Sound off also sends this person's pushes *silent* where the browser honours it. |
| Categories (messages, lessons, account, announcements) | A muted kind is listed but never alerts. Every notification type maps to one category (`contract.ts`). |
| Quiet hours | No push, no sound in the window (the person's own time zone); pop-ups still appear. |
| Push on this device | **Per browser**, not per account: the browser's permission plus an opt-out kept in localStorage. |

**Permission prompt.** Our own card appears 8 s after the app opens, only if the browser has not been asked
yet (`permission === 'default'`), push is not switched off on this device and notifications are not paused.
"Not now", ×, Escape (when the card has focus), closing or refusing the browser dialog all start a **7-day rest** counted from that
moment (`promptGate`). A browser that said *block* is never asked again — the settings screen explains how
to unblock, and the app notices the change by itself (permissions API + tab focus).

**Suppression.** A visible tab reports its page when it settles on it, and again only when the person
interacts after 2.5 minutes of quiet. The server trusts a report for 5 minutes. No heartbeat: an idle tab
simply lapses and its owner is notified as usual.

## Firestore data

| Collection | Document | Written by | Read by |
|---|---|---|---|
| `Notification` | `sha256(userId + key)` -> `{ userId, type, title, body, link?, data?, key, sendId, count, isRead, createdAt, expireAt? }` | `inbox.ts` | browser (list) |
| `unreadNotificationCount` | `{userId}` -> `{ count }` | `inbox.ts`, in the same transaction as the change | browser (badge) |
| `notificationSettings` | `{userId}` -> settings (see `lib/settings.ts`), `updatedAt` | `server/settings.ts` | browser (settings screen), server (sends) |
| `activeNotificationContext` | `{userId}` -> `{ sessions: { [tabId]: { link, expiresAt } }, expireAt }` | `presence.ts` | server only |

`count` is how many times an unread notification was sent again ("x3" in the list). `expireAt` is set on
a notification when it is marked read (now + 30 days) and removed if it is sent again.

## One-time setup (Firebase console — not code)

1. **Security rules.** The browser reads `notificationSettings/{userId}` the same way it already reads
   `Notification` and `unreadNotificationCount`; add it to whatever rule covers those. Writes stay
   server-only (the Admin SDK bypasses rules). Without a read rule the screen shows a notice and uses the
   last known settings; sending is unaffected.
2. **Optional TTL policies** (Firestore -> TTL) keep the database tidy, nothing breaks without them:
   - `Notification.expireAt` — deletes notifications 30 days after they were read (unread ones never expire,
     and the unread counter is unaffected because read notifications are not counted).
   - `activeNotificationContext.expireAt` — removes presence documents of users who vanished.
3. The composite index `Notification: userId ASC, createdAt DESC` is the one the list already needed.

## What things cost

| Operation | Cost |
|---|---|
| Idle tab | 0 requests (no heartbeat, no polling) |
| Page change | 1 request after the page stays put 300 ms (bursts collapse); 1 Firestore write, no read |
| Interaction after >2.5 min since the last report | 1 request, 1 write — at most one per 2.5 min per active tab |
| Tab hidden > 3 s / closed | 1 request, 1 transaction (writes only if there is something to remove or sweep) |
| Opening/closing the bell | 0 reads: the list listener is shared and lives 60 s past the last user |
| App session | 1 listener on the newest 20 notifications, 1 on the settings document, 1 on the counter (navbar) |
| Settings change | 1 request per 400 ms burst, 1 write |
| `sendNotification` to N users | 1 batched read for presence + uncached settings; nothing for settings seen in the last 20 s |
| Send, same notification again while unread (chat) | 1 read + 1 write on the notification; the counter is not touched |
| Send, new or read-again notification | the above + 1 counter read + 1 write, in the same transaction |
| Identical send within 3 s | dropped before any I/O |
| New tab for a signed-in user | 0 requests (registration marker lasts 7 days) |

Settings changes reach sends on *other* server instances within 20 s (the read cache); the instance that
saved them applies them at once.

## Service worker notes

`public/firebase-messaging-sw.js` mirrors `contract.ts` (message names, payload key/version, handled
endpoint). It uses `tag` (conversation) else `key` (identical repeat) else `id` to replace notifications on
the device, counts tagged ones, and passes `silent` to `showNotification`. Browsers decide whether a
system notification makes sound and `silent: true` is a request, not a guarantee: where a browser or OS
ignores it, the device's own notification-sound setting applies and the app's sound setting cannot override it.

## Not done on purpose

- `unregisterDevice()` is never called when the user signs out (the sign-out code lives outside this
  folder). Until it is, a signed-out browser can keep receiving that user's pushes. The fix is one call
  before the session ends: `const { unregisterDevice } = useNotification(); await unregisterDevice();`.
- The navbar badge (`components/dashboard/Navbar`) still keeps its own listener on the counter document; it
  is a single tiny document, so it was left alone.

## Extending

- **New notification type:** add it to `NOTIFICATION_TYPES` and `NOTIFICATION_TYPE_CONFIG` (the compiler
  forces the second, including its settings category), add its icon in `typeIcons.ts`, then call
  `sendNotification({ type, ... })`.
- **New category / setting:** add it to `lib/settings.ts` (+ the zod patch in `schema.ts`, + a row in
  `NotificationSettingsPanel`); `policy.ts` is the only place that interprets settings.
- **Changing the wire format** (payload shape, message names, endpoint paths): edit `lib/contract.ts` and
  mirror the change in `public/firebase-messaging-sw.js`.
- **Moving from token multicast to Firebase Installation IDs:** only `server/push.ts` changes.
