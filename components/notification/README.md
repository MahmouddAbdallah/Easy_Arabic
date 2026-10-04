# Notifications

Push notifications (FCM + service worker), the in-app notification list, and the unread counter.
Everything the rest of the app needs is two things: call `sendNotification()` on the server, and render
`<NotificationBody />` / `<NotificationProvider>` on the client.

Related code outside this folder: `app/api/notification/*` (HTTP endpoints) and
`public/firebase-messaging-sw.js` (service worker — plain JS, cannot import from here; keep it in step
with `lib/contract.ts`).

## Layout

```
components/notification/
├── NotificationProvider.tsx   app-wide: composes the three pieces below (+ permission button)
├── NotificationBody.tsx       the in-app list (works without push permission)
├── NotificationItem.tsx / NotificationToast.tsx / typeIcons.ts
├── ActiveContextReporter.tsx  reports the current page of this tab
├── hooks/
│   ├── useNotifications.ts        live list: one Firestore listener + cursor paging
│   ├── usePushRegistration.ts     support, permission, FCM token registration
│   └── useServiceWorkerBridge.ts  service worker -> toast / navigation
└── lib/
    ├── contract.ts          shared constants, wire format, types (no server/browser imports)
    ├── schema.ts            zod schemas for sendNotification() and the API bodies
    ├── sendNotification.ts  PUBLIC server API: validate -> suppress -> push + store
    ├── server/              server only (`import 'server-only'` guards the build)
    │   ├── push.ts            FCM delivery + dead-token cleanup
    │   ├── devices.ts         UserFCMToken table (Prisma)
    │   ├── inbox.ts           `Notification` documents + unread counter writes
    │   ├── unreadCounter.ts   counter read/write helpers used inside transactions
    │   ├── identity.ts        what makes two notifications "the same one"
    │   ├── presence.ts        which page each tab shows (for suppression)
    │   ├── firestore.ts       lazy firebase-admin access
    │   └── chunk.ts
    └── client/              browser only
        ├── api.ts             every request to /api/notification
        ├── device.ts          FCM token + registration marker
        └── presence.ts        heartbeat reporter
```

Dependencies point one way: `sendNotification` -> `server/*` -> `contract`; hooks/components -> `lib/client/*`
-> `contract`. Routes in `app/api/notification` are thin: `_lib/route.ts` handles auth, body validation and
errors once, so a route is only its endpoint-specific line(s).

## Flows

**Send.** `sendNotification()` validates the input, builds one payload, drops users who are already viewing
the notification's `link` (`presence`), then — independently and in parallel — pushes to the recipients'
devices (`devices` -> `push`) and stores/updates one `Notification` document per recipient (`inbox`).
It never throws.

**Receive.** FCM data message -> service worker. A visible page gets it as an in-app toast
(`useServiceWorkerBridge`); otherwise the worker draws a system notification. Clicking either one tells
the server (`POST /handled`), which deletes the stored copy.

**List.** `useNotifications` reads Firestore directly (reads only). Changes go through `PATCH /read`.

**Suppression.** Every visible tab reports its page (`presence.ts`); `sendNotification` skips users whose
live tab shows the notification's `link`. A suppressed notification is not pushed, stored or counted.

## Firestore data

| Collection | Document | Written by | Read by |
|---|---|---|---|
| `Notification` | `sha256(userId + key)` -> `{ userId, type, title, body, link?, data?, isRead, createdAt }` | `inbox.ts` | browser (list) |
| `unreadNotificationCount` | `{userId}` -> `{ count }` | `inbox.ts`, in the same transaction as the change | browser (badge) |
| `activeNotificationContext` | `{userId}` -> `{ sessions: { [tabId]: { link, expiresAt } } }` | `presence.ts` | server only |

## What things cost

| Operation | Cost |
|---|---|
| Heartbeat (per visible tab, every 60 s) | 1 request, 1 Firestore write — no read, no transaction |
| Tab hidden/closed | 1 request, 1 transaction; writes only if there is an entry to remove or sweep |
| Page change | 1 request, after the page has stayed put 300 ms (bursts collapse to one) |
| Send, same notification again while unread (e.g. chat) | notification doc: 1 read + 1 write; the counter is not touched |
| Send, new or read-again notification | adds 1 counter read + 1 counter write, in the same transaction |
| New tab for a signed-in user | 0 requests (registration marker lasts 7 days) |

Tuning: `ACTIVE_CONTEXT_HEARTBEAT_MS` / `ACTIVE_CONTEXT_TTL_MS` in `lib/contract.ts` are the main load knob
(the file explains the trade-off). Not handled here: `Notification` documents are kept until clicked and
never expire; a retention policy (e.g. a Firestore TTL on read notifications only, so the counter stays
correct) would be the next scaling step.

## Extending

- **New notification type:** add it to `NOTIFICATION_TYPES` and `NOTIFICATION_TYPE_CONFIG` (the compiler
  forces the second), add its icon in `typeIcons.ts`, then call `sendNotification({ type, ... })`.
- **Changing the wire format** (payload shape, message names, endpoint paths): edit `lib/contract.ts` and
  mirror the change in `public/firebase-messaging-sw.js`.
- **Moving from token multicast to Firebase Installation IDs:** only `server/push.ts` changes.
