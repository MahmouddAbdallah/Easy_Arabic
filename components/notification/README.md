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
├── categoryIcons.ts                  icon name (from the configuration) -> component
├── ActiveContextReporter.tsx         reports the current page of this tab
├── dashboard/                        the admin's configuration form (standalone: render <NotificationDashboard /> anywhere)
│   ├── NotificationDashboard.tsx        shell: tabs, preview, save bar; loading / forbidden / error / conflict states
│   ├── SectionsTab.tsx                  add / edit / reorder / switch off / remove the sections users can mute
│   ├── DeliveryTab.tsx                  route each notification type to a section; urgency, time-to-live, pop-up, icon
│   ├── SoundTab.tsx                     the master switch, volume, the chime (or an audio file), politeness
│   ├── UserSettingsTab.tsx              which controls users get, and the defaults of people who never chose
│   ├── PreviewPanel.tsx                 the REAL settings screen, fed the draft
│   └── fields.tsx                       form primitives (no notification knowledge)
├── hooks/
│   ├── useNotifications.ts              list facade over the shared inbox store
│   ├── useNotificationConfig.ts         the configuration for signed-in users (shared copy, refreshed on return)
│   ├── useNotificationConfigEditor.ts   the dashboard's form state: load, draft, validate, save, conflicts
│   ├── useNotificationSettingsState.ts  settings: one doc listener, optimistic, debounced saves
│   ├── usePushRegistration.ts           support, browser permission, FCM token, "off on this device"
│   ├── usePermissionPrompt.ts           when to show the prompt (7-day rule)
│   ├── useInAppAlerts.ts                pop-up + sound for notifications that arrive while the app is open
│   └── useServiceWorkerBridge.ts        service worker -> page: pushes, click navigation
└── lib/
    ├── contract.ts          shared constants, wire format, types (no server/browser imports)
    ├── config.ts            the CONFIGURATION shape, limits, built-in defaults, lookups (shared)
    ├── configParse.ts       parseConfig: strict for saves + the dashboard, self-healing for reads (shared)
    ├── configEdit.ts        pure edits of a draft (add / rename / remove a section keep routes valid)
    ├── settings.ts          the per-user settings shape; stored choices -> effective settings under a config (shared)
    ├── time.ts              quiet-hours type + clock validators (shared by settings and config)
    ├── policy.ts            settings + config -> "may this alert?" incl. quiet hours (shared: server + browser agree)
    ├── location.ts          "same page?" comparison (shared)
    ├── schema.ts            zod schemas for sendNotification() and the API bodies
    ├── sendNotification.ts  PUBLIC server API: validate -> dedupe -> suppress -> push + store
    ├── server/              server only (`import 'server-only'` guards the build)
    │   ├── recipients.ts      per-recipient presence + settings in ONE batched read
    │   ├── config.ts          the configuration document: cached never-throwing load, revision-checked save
    │   ├── settings.ts        settings writes + a short per-instance read cache (of what people CHOSE)
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
        ├── configStore.ts     THE one shared copy of the configuration (cache -> fetch -> refresh on return)
        ├── alerts.ts          pop-up/sound decisions + push/stored de-duplication (no browser APIs: testable)
        ├── sound.ts           Web Audio chime (or an audio file) per the configured sound; autoplay-safe, rate-limited
        ├── promptGate.ts      the 7-day rule for our prompt
        ├── presence.ts        event-driven page reporter (no heartbeat)
        ├── device.ts          FCM token, registration marker, per-device opt-out
        └── api.ts             every request to /api/notification
```

(`app/api/notification/config/route.ts` is the configuration's endpoint; `_lib/route.ts` takes an optional `roles`.)

Dependencies point one way: `sendNotification` -> `server/*` -> `contract`/`settings`/`policy`; hooks and
components -> `lib/client/*` -> the shared modules. Routes in `app/api/notification` are thin:
`_lib/route.ts` handles auth, body validation and errors once.

## Two kinds of "notification", kept apart

- **In the list (inbox).** Stored in Firestore for every recipient, whatever their settings or push
  permission. This is the record; it and the unread badge never depend on push.
- **Alerts.** A system **push** (works with the app closed; needs browser permission and a registered
  device) and, while the app is open, an in-app **pop-up** and **sound**. Alerts are what settings control.

## Configuration vs. settings (read this before changing either)

Two layers that look alike and must stay apart:

|             | **Configuration** (`lib/config.ts`)                                                                              | **Settings** (`lib/settings.ts`)                        |
| ----------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| Scope       | one for the whole app                                                                                            | one per user                                            |
| Who sets it | an admin, in `dashboard/NotificationDashboard.tsx`                                                               | each person, on their settings screen                   |
| Stored in   | `notificationConfig/main` (one document)                                                                         | `notificationSettings/{userId}`                         |
| Written via | `PUT /api/notification/config` (**admin only**)                                                                  | `PATCH /api/notification/settings` (the session's user) |
| Says        | which sections exist, how it sounds, which controls people get, what they default to, how each type is delivered | what _this person_ chose, within that                   |

The configuration never rewrites a person's stored choices; it decides which of them _apply_. A control the
admin hides is locked to its default, a switched-off section alerts nobody, a mandatory section cannot be
muted — and switching any of that back restores exactly what each person had chosen. Resolving
choices + configuration into the settings everything else reads is one function, `normalizeSettings(stored, config)`.

**What the configuration holds**

| Part                             | Effect                                                                                                                                                                                                                                                                                                                                                                                         |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sections (`categories`)          | The rows of "What to be notified about", in order: id (permanent), title, description, icon, **on/off for everyone**, default for new people, whether people may mute it. Add, rename, reorder, switch off, remove. Switched off = hidden from users and their notifications raise no alert (they are still stored in the list, like a muted section; a send to raw device tokens is dropped). |
| Type routing (`types`)           | Which section each notification type belongs to, plus its urgency and time-to-live. They start from `NOTIFICATION_TYPE_CONFIG`; `identity` stays in code (changing it would orphan stored notifications). A removed section's types go to `fallbackCategory`.                                                                                                                                  |
| Sound (`sound`)                  | Master switch (off = no chime, every push silent, no "Sound" control), volume, tone, the notes (pitch + delay), note length, minimum gap, one-tab-per-alert, or an audio file instead of the chime.                                                                                                                                                                                            |
| Controls + defaults (`settings`) | Which of pop-ups / sound / push / quiet hours people see, and what people who never chose get (including quiet hours and their time zone).                                                                                                                                                                                                                                                     |
| Delivery + wording               | Pop-up duration, the default system-notification icon, the heading and hint of the sections block.                                                                                                                                                                                                                                                                                             |

**Defaults.** `DEFAULT_NOTIFICATION_CONFIG` is exactly what used to be hard-coded (the four sections, the two-note
chime at its original gain, 6 s pop-ups, the per-type urgency/TTL). While no configuration document exists it is what
applies, so nothing changes until an admin saves one.

**How it reaches each part**

- **Server** (`sendNotification`): `server/config.ts` loads it once per send (cached 20 s per instance, concurrent
  loads share one read, **never throws** — on a Firestore failure it uses the last known copy, then the defaults). It
  gates by section, resolves each recipient's settings under it, applies per-type urgency/TTL and injects the default icon.
- **Browser**: `GET /api/notification/config` (any signed-in user), kept in one shared copy (`lib/client/configStore.ts`):
  the last visit's copy or the defaults at once, refreshed on load and when the tab is revisited after 5 minutes. No
  polling, no Firestore listener — so **no Firestore rule is needed** for it. The settings screen, pop-up duration and sound are drawn from it.
- **Service worker**: untouched on purpose. It has no Firebase SDK and no access to the configuration, so what it
  needs (`icon`, `silent`) is decided on the server and travels in the payload, which the worker already honours.

**The dashboard** is a standalone component; render it on any page you control:

```tsx
import NotificationDashboard from "@/components/notification/dashboard/NotificationDashboard";

export default function NotificationAdminPage() {
  return <NotificationDashboard />;
}
```

It needs no props and nothing else refers to it. The server is the authority: only a signed-in `admin` can read it for editing
(`GET ?manage=1`) or save it; anyone else gets a notice. The form validates with the _same_ `parseConfig` the server applies,
saves everything at once, and refuses to overwrite a configuration it has not seen: a save names the revision it was
based on and a stale one is a `409`, after which the admin reloads. A "Restore defaults" fills the form with the built-in
values (nothing is stored until Save), and a live preview renders the real settings screen from the draft.

**Adding a category** is done entirely in the dashboard. A category receives notifications when a _type_ is routed
to it (Types & delivery tab). Types are code (they carry an icon and an identity), so a brand-new _kind_ of
notification still needs the three steps under _Extending_; the dashboard then decides where it is filed.

## Flows

**Send.** `sendNotification()` validates, builds one payload (with a send `id`, and the `key`/`tag` that say
which notification it is), drops an identical repeat from the last 3 s, then reads each recipient's presence
and settings in one batch. Recipients on the notification's page get nothing at all. The rest are stored
in the list; of those, the ones whose settings allow it are pushed to — people with sound off get a _silent_
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
when sending (pause, muted or disabled sections, quiet hours, silent push); the browser enforces pop-up and sound.
The document holds only what the person _chose_; the settings the app uses are those choices resolved under the
configuration (see above), which is why a configuration change applies at once without touching anyone's document.
A section id in a patch must exist in the current configuration or the request is refused.

| Setting                                                           | Effect                                                                                                                             |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Notifications (master)                                            | Off = no push, pop-up or sound. The list still fills and the badge still counts.                                                   |
| Pop-ups / Sound                                                   | In-app only. Sound off also sends this person's pushes _silent_ where the browser honours it.                                      |
| Categories (by default messages, lessons, account, announcements) | A muted kind is listed but never alerts. The sections are the configuration's, not code; every notification type is routed to one. |
| Quiet hours                                                       | No push, no sound in the window (the person's own time zone); pop-ups still appear.                                                |
| Push on this device                                               | **Per browser**, not per account: the browser's permission plus an opt-out kept in localStorage.                                   |

**Permission prompt.** Our own card appears 8 s after the app opens, only if the browser has not been asked
yet (`permission === 'default'`), push is not switched off on this device and notifications are not paused.
"Not now", ×, Escape (when the card has focus), closing or refusing the browser dialog all start a **7-day rest** counted from that
moment (`promptGate`). A browser that said _block_ is never asked again — the settings screen explains how
to unblock, and the app notices the change by itself (permissions API + tab focus).

**Suppression.** A visible tab reports its page when it settles on it, and again only when the person
interacts after 2.5 minutes of quiet. The server trusts a report for 5 minutes. No heartbeat: an idle tab
simply lapses and its owner is notified as usual.

## Firestore data

| Collection                  | Document                                                                                                                  | Written by                                                         | Read by                                       |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| `Notification`              | `sha256(userId + key)` -> `{ userId, type, title, body, link?, data?, key, sendId, count, isRead, createdAt, expireAt? }` | `inbox.ts`                                                         | browser (list)                                |
| `unreadNotificationCount`   | `{userId}` -> `{ count }`                                                                                                 | `inbox.ts`, in the same transaction as the change                  | browser (badge)                               |
| `notificationSettings`      | `{userId}` -> settings (see `lib/settings.ts`), `updatedAt`                                                               | `server/settings.ts`                                               | browser (settings screen), server (sends)     |
| `notificationConfig`        | `main` -> the configuration (see `lib/config.ts`) + `revision`, `updatedAt`, `updatedBy`                                  | `server/config.ts`, admins only, in a revision-checked transaction | server only (browsers get it through the API) |
| `activeNotificationContext` | `{userId}` -> `{ sessions: { [tabId]: { link, expiresAt } }, expireAt }`                                                  | `presence.ts`                                                      | server only                                   |

`count` is how many times an unread notification was sent again ("x3" in the list). `expireAt` is set on
a notification when it is marked read (now + 30 days) and removed if it is sent again.

## One-time setup (Firebase console — not code)

1. **Security rules.** The browser reads `notificationSettings/{userId}` the same way it already reads
   `Notification` and `unreadNotificationCount`; add it to whatever rule covers those. Writes stay
   server-only (the Admin SDK bypasses rules). Without a read rule the screen shows a notice and uses the
   last known settings; sending is unaffected.
2. **`notificationConfig` needs no read rule** — browsers never touch it; they get the configuration from the API,
   and only the Admin SDK writes it. Deny client access to that collection so it stays that way.
3. **Optional TTL policies** (Firestore -> TTL) keep the database tidy, nothing breaks without them:
   - `Notification.expireAt` — deletes notifications 30 days after they were read (unread ones never expire,
     and the unread counter is unaffected because read notifications are not counted).
   - `activeNotificationContext.expireAt` — removes presence documents of users who vanished.
4. The composite index `Notification: userId ASC, createdAt DESC` is the one the list already needed.

## What things cost

| Operation                                         | Cost                                                                                                                            |
| ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Idle tab                                          | 0 requests (no heartbeat, no polling)                                                                                           |
| Page change                                       | 1 request after the page stays put 300 ms (bursts collapse); 1 Firestore write, no read                                         |
| Interaction after >2.5 min since the last report  | 1 request, 1 write — at most one per 2.5 min per active tab                                                                     |
| Tab hidden > 3 s / closed                         | 1 request, 1 transaction (writes only if there is something to remove or sweep)                                                 |
| Opening/closing the bell                          | 0 reads: the list listener is shared and lives 60 s past the last user                                                          |
| App session                                       | 1 listener on the newest 20 notifications, 1 on the settings document, 1 on the counter (navbar)                                |
| Settings change                                   | 1 request per 400 ms burst, 1 write                                                                                             |
| `sendNotification` to N users                     | 1 batched read for presence + uncached settings; nothing for settings seen in the last 20 s                                     |
| Send, same notification again while unread (chat) | 1 read + 1 write on the notification; the counter is not touched                                                                |
| Send, new or read-again notification              | the above + 1 counter read + 1 write, in the same transaction                                                                   |
| Identical send within 3 s                         | dropped before any I/O                                                                                                          |
| New tab for a signed-in user                      | 0 requests (registration marker lasts 7 days)                                                                                   |
| App session                                       | + 1 request for the configuration on load, and one more only when the tab is revisited after 5 minutes. No listener, no polling |
| `sendNotification` / settings change              | + 0 reads normally: the configuration is cached 20 s per instance (1 read when it expires, shared by concurrent sends)          |
| Admin opens the dashboard / saves                 | 1 fresh read / 1 transaction (read + write) + 1 read-back                                                                       |

Settings changes reach sends on _other_ server instances within 20 s (the read cache); the instance that
saved them applies them at once. The same holds for the configuration: a save reaches other instances within 20 s.

## Service worker notes

`public/firebase-messaging-sw.js` mirrors `contract.ts` (message names, payload key/version, handled
endpoint). It uses `tag` (conversation) else `key` (identical repeat) else `id` to replace notifications on
the device, counts tagged ones, and passes `silent` to `showNotification`. Browsers decide whether a
system notification makes sound and `silent: true` is a request, not a guarantee: where a browser or OS
ignores it, the device's own notification-sound setting applies and the app's sound setting cannot override it.

The worker is not configuration-aware and does not need to be: the server resolves the configuration and puts the
results in the payload — `icon` (the configured default when the sender gave none) and `silent` (when sound is off for
that person, or off for everyone in the configuration's sound).

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
- **New category (section):** none of this is code — add it in the dashboard, then route a type to it.
- **New kind of user setting** (a new switch next to Sound, say): add it to `lib/settings.ts` (the shape, `pickStoredSettings`,
  `normalizeSettings`), the zod patch in `schema.ts`, a control in `NotificationSettingsPanel`, and — if admins should be able to
  hide it or default it — a flag in `lib/config.ts` (`SettingsControls` / `SettingsDefaults`) with its field in `configParse.ts`
  and a toggle in `dashboard/UserSettingsTab.tsx`. `policy.ts` is the only place that interprets settings.
- **New configuration option:** add it to `NotificationConfig` and `DEFAULT_NOTIFICATION_CONFIG` (`lib/config.ts`), read it in
  `configParse.ts` (that one walker gives you server validation, dashboard validation and self-healing reads), add its input in a
  dashboard tab, and use it where it applies. Give it a default equal to the old behaviour so nothing changes until an admin saves.
- **New icon for sections:** add the name to `CATEGORY_ICON_NAMES` and the component to `categoryIcons.ts` (the compiler enforces both).
- **Changing the wire format** (payload shape, message names, endpoint paths): edit `lib/contract.ts` and
  mirror the change in `public/firebase-messaging-sw.js`.
- **Moving from token multicast to Firebase Installation IDs:** only `server/push.ts` changes.
