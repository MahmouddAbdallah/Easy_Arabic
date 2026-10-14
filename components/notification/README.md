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
├── tsconfig.test.json                only for the tests: maps "@/*" and "server-only" so they run outside Next (see Tests)
├── ActiveContextReporter.tsx         reports the current page of this tab
├── NotificationsMenu.tsx             the navbar bell: live unread dot, the list in a popover (mounted only while it is open)
├── dashboard/                        the admin's configuration form (standalone: render <NotificationDashboard /> anywhere)
│   ├── Dashboard.tsx                    shell (exports NotificationDashboard): tabs, preview, save bar; loading / forbidden / error / conflict states
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
│   ├── useInAppAlerts.ts                pop-up + sound for notifications that arrive while the app is open and in use
│   └── useServiceWorkerBridge.ts        service worker -> page: pushes (and whether the page took them), click navigation
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
    ├── activeContext.server.ts / tokens.server.ts
    │                        re-exports for code OUTSIDE this folder (the chat's call ring imports them); the
    │                        implementation is in server/presence.ts and server/devices.ts — new code imports from there
    ├── server/              server only (`import 'server-only'` guards the build)
    │   ├── recipients.ts      per-recipient presence + settings in batched reads (250 users per read, 4 reads at a time)
    │   ├── config.ts          the configuration document: cached never-throwing load, revision-checked save
    │   ├── settings.ts        settings writes + a short per-instance read cache (of what people CHOSE)
    │   ├── presence.ts        which page each tab shows (for suppression)
    │   ├── recentSends.ts     drops an accidental identical repeat before any I/O
    │   ├── push.ts            FCM delivery (500 messages per call, loud + silent together), retry of passing failures, dead-token cleanup
    │   ├── devices.ts         UserFCMToken table (Prisma)
    │   ├── inbox.ts           `Notification` documents + unread counter writes (100 users per transaction, 10 at a time)
    │   ├── unreadCounter.ts   counter read/write helpers used inside transactions
    │   ├── identity.ts        what makes two notifications "the same one"
    │   ├── concurrency.ts     bounded fan-out that never rejects (`settleWithLimit`) + jittered backoff
    │   ├── firestore.ts       lazy firebase-admin access
    │   └── chunk.ts           split a list into groups
    └── client/              browser only
        ├── inboxStore.ts      THE one Firestore listener on the list (shared by bell, page, alerts)
        ├── configStore.ts     THE one shared copy of the configuration (cache -> fetch -> refresh on return; one fetch per browser)
        ├── alerts.ts          pop-up/sound decisions + push/stored de-duplication + "was it taken in the app?" for the worker (no browser APIs: testable)
        ├── sound.ts           Web Audio chime (or an audio file) per the configured sound; autoplay-safe, rate-limited
        ├── promptGate.ts      the 7-day rule for our prompt
        ├── presence.ts        event-driven page reporter (no heartbeat); "here" means the tab is visible AND in focus
        ├── device.ts          FCM token (the messaging SDK loads on first use), registration marker, per-device opt-out
        ├── locks.ts           `withCrossTabLock`: one tab at a time across the browser (Web Locks); fails open
        ├── api.ts             every request to /api/notification
        └── *.test.ts          tests of the above; testFakes.ts (browser fakes) and workerFakes.ts (runs the real service worker on fakes) are what they run on (see Tests)
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
| Who sets it | an admin, in `dashboard/Dashboard.tsx`                                                                           | each person, on their settings screen                   |
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
  the last visit's copy or the defaults at once. A copy fetched less than 5 minutes ago — by this tab or by any other tab
  of the browser (the time is stored next to the copy) — is used as it is; an older one is fetched on load and when the
  tab is revisited. When several tabs find it stale together, one fetches under a cross-tab lock and the others take its
  answer; a copy another tab stores is picked up as it happens (revisions only go up, so an older copy never replaces a
  newer one). A failed fetch keeps the copy and is not tried again for 30 s. No polling, no Firestore listener — so
  **no Firestore rule is needed** for it. The settings screen, pop-up duration and sound are drawn from it.
- **Service worker**: untouched on purpose. It has no Firebase SDK and no access to the configuration, so what it
  needs (`icon`, `silent`) is decided on the server and travels in the payload, which the worker already honours.

**The dashboard** is a standalone component; render it on any page you control:

```tsx
import NotificationDashboard from "@/components/notification/dashboard/Dashboard";

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

**Send.** `sendNotification()` validates and drops an identical repeat from the last 3 s — before it reads the
configuration, builds anything or touches a database — then builds one payload (with a send `id`, and the
`key`/`tag` that say which notification it is) and reads each recipient's presence and settings in batches.
Recipients on the notification's page get nothing at all. The rest are stored in the list; of those, the ones
whose settings allow it are pushed to — people with sound off get a _silent_ push. Push and storage run in
parallel and never fail each other. It never throws; the result reports `suppressed`, `muted`, `duplicate` next
to the old fields.

**A big audience fails in parts, never as a whole.** Everything that fans out to many people is split into groups,
and a group that fails is reported without hiding, undoing or delaying the others:

- _Recipients_ are read 250 at a time (four reads at once). If one read fails, only its users fall back to "not
  viewing" with the choices this instance remembers or the configured defaults; everybody else keeps their real
  presence and settings. (Before, one failed read dropped everyone's settings, so people who had muted a section
  were pushed anyway.)
- _In-app copies_ are stored 100 users per transaction, ten transactions at once (so a 1,000-user send, the
  maximum, goes out together). Users are taken in sorted order, so two overlapping broadcasts ask for the same
  documents in the same order — the usual way to keep them from locking each other out in opposite directions
  (Firestore promises no lock order, so this lowers the chance of a conflict retry rather than ruling it out). A failed transaction costs only its 100 users, and
  the result says how many: `stored` counts what was really saved and the error reads "…could not be saved to the
  in-app list for 100 of 450 users" (before, it reported that nothing was saved even though the other groups had committed).
- _Push_ goes out in FCM calls of 500 messages, up to ten at once (5,000 devices — the most a send to raw tokens can
  address; a bigger audience queues behind them). The audible and the silent devices share those calls, so a send
  to a few hundred devices opens one connection to FCM instead of two. A device that failed for a reason that passes (FCM
  `internal-error`, `unavailable`, `message-rate-exceeded`, a dropped connection) is sent again — only that device,
  up to two more times, after a jittered pause (about 0.25–0.5 s, then 0.5–1 s). Dead tokens are never retried, they
  are deleted. A repeated delivery is harmless: the service worker and the page recognise the same send and show it once.

**Receive.** FCM data message -> service worker. If the person is working in a page of the app — visible **and** its
window in focus — the worker hands the message to that page (`useServiceWorkerBridge` -> `useInAppAlerts`), which decides
on pop-up/sound and answers whether it took the notification. In every other case the worker draws a system
notification: no page open, a minimized window, a tab in the background, a window that can be seen but has another app
in front of it, a page that answers "not me" or does not answer within a second. Pushes with a `tag` replace each other
and are counted ("Ali (3)"). Clicking either kind tells the server (`POST /handled`), which deletes the stored copy.
See "Service worker notes" for what each browser allows a push to do without a notification.

**In-app alerts without push.** `useInAppAlerts` also watches the shared inbox store for new unread
arrivals, so people who never enabled push still get pop-ups and sound. A push and its stored copy of the
same send carry the same id and produce one pop-up and one sound, whichever arrives first. A tab that can be seen
but is not the one in use shows nothing when a system notification is on its way (push active on this device and
allowed by the person's settings and quiet hours) — that is the alert they will notice; without one, the pop-up is shown.

**This browser as a push target.** `lib/client/device.ts` gets the browser's FCM token and keeps it registered on the
server. A marker in localStorage (user + token, valid 7 days) says "already registered", so opening a tab costs nothing.
When several tabs find the registration missing at once (a restored session, an expired marker, a different user),
registering — and removing — the token takes a cross-tab lock (`lib/client/locks.ts`): one tab saves it and the others
find the marker it wrote, instead of each sending the same request. A lock the browser cannot give (no Web Locks API, or
not granted within 10 s) never holds anything up for longer than that wait: the tab carries on by itself, as every tab
did before, and a repeated registration is harmless — only wasteful. Firebase's messaging SDK is downloaded the first
time it is needed, after a check that the browser has notifications, service workers and push at all — so it is not
part of a page's first load, and a browser without them never fetches it. The check runs for every visitor, signed in
or not, because the settings screen shows "checking" until it answers.

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

**Suppression.** A tab the person is working in — visible **and** its window in focus — reports its page when it
settles on it, and again only when the person interacts after 2.5 minutes of quiet. The server trusts a report for
5 minutes. When the person leaves (another app takes the focus, the tab is hidden or closed) the tab takes its report
back, so the server stops holding notifications back for them: after a 3 s grace, so an alt-tab costs nothing; at once
for a closing tab and for a tab a phone or tablet put in the background (a page there may be frozen before a timer
fires). A window that merely can be seen is not "here". No heartbeat: an idle tab simply lapses and its owner is
notified as usual.

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
| Tab hidden or out of focus > 3 s / closed         | 1 request, 1 transaction (writes only if there is something to remove or sweep)                                                 |
| Phone or tablet: tab put in the background        | the same, sent at once (a page there may be frozen before a timer fires)                                                        |
| Opening/closing the bell                          | 0 reads: the list listener is shared and lives 60 s past the last user                                                          |
| App session                                       | 1 listener on the newest 20 notifications, 1 on the settings document, 1 on the counter (navbar)                                |
| Settings change                                   | 1 request per 400 ms burst, 1 write                                                                                             |
| `sendNotification` to N users                     | 1 batched read per 250 users for presence + uncached settings (four at a time); nothing for settings seen in the last 20 s      |
| Send, same notification again while unread (chat) | 1 read + 1 write on the notification; the counter is not touched                                                                |
| Send, new or read-again notification              | the above + 1 counter read + 1 write, in the same transaction                                                                   |
| In-app copies for N users                         | N/100 transactions (ten at a time) — the same documents read and written as one big transaction, a few more round trips         |
| Push to D devices                                 | D/500 FCM calls (ten at a time); only devices that failed for a passing reason are sent again, at most twice                    |
| Identical send within 3 s                         | dropped before any I/O (now also before the configuration is read)                                                              |
| New tab for a signed-in user                      | 0 requests (registration marker lasts 7 days)                                                                                   |
| Several tabs, registration missing or expired     | 1 request per browser (cross-tab lock), not one per tab; a valid marker means no lock and no request                            |
| App session, configuration                        | 0 or 1 request: none while any tab fetched it in the last 5 min; older, 1 per browser. No listener, no polling                  |
| Configuration fetch fails                         | the copy is kept; no new attempt for 30 s, however often the tab is revisited                                                   |
| `sendNotification` / settings change              | + 0 reads normally: the configuration is cached 20 s per instance (1 read when it expires, shared by concurrent sends)          |
| Admin opens the dashboard / saves                 | 1 fresh read / 1 transaction (read + write) + 1 read-back                                                                       |

Settings changes reach sends on _other_ server instances within 20 s (the read cache); the instance that
saved them applies them at once. The same holds for the configuration: a save reaches other instances within 20 s.
The settings cache holds at most 5,000 users per instance; when it is full, the user read longest ago makes room, and
reading a user again counts as reading them anew — a refresh never pushes somebody else out.

### Sizes and limits (each lives in one constant — change it there)

| Knob                                       | Value    | File                   | Why this number                                                                            |
| ------------------------------------------ | -------- | ---------------------- | ------------------------------------------------------------------------------------------ |
| `USERS_PER_READ` × `READ_CONCURRENCY`      | 250 × 4  | `server/recipients.ts` | 250 users = 500 documents per `getAll`; a failed read affects 250 people, not the audience |
| `USERS_PER_COMMIT` × `COMMIT_CONCURRENCY`  | 100 × 10 | `server/inbox.ts`      | smaller transactions hold their locks for less time; ten at once cover the 1,000-user cap  |
| `FCM_BATCH_SIZE` × `FCM_BATCH_CONCURRENCY` | 500 × 10 | `server/push.ts`       | 500 is the SDK's maximum per `sendEach`; ten calls cover the 5,000-token cap               |
| `MAX_ATTEMPTS`                             | 3        | `server/push.ts`       | one send and two retries; the pauses keep the worst case under about two seconds           |

The browser and cache timings are one constant each, too:

- `CONFIG_STALE_MS` (5 min) and `CONFIG_RETRY_MS` (30 s) in `lib/client/configStore.ts` — how old the configuration copy may get, and the pause after a failed fetch.
- `LOCK_WAIT_MS` (10 s) in `lib/client/locks.ts` — how long a tab waits for the cross-tab lock before it carries on without it.
- `SYNC_MARKER_TTL_MS` (7 days) in `lib/client/device.ts` — how long "this browser is registered" is believed.
- `SETTINGS_CACHE_MS` (20 s) and `SETTINGS_CACHE_MAX` (5,000 users) in `lib/server/settings.ts`.

A transaction holds the locks of everything it touches until it commits, so a notification to one person (a chat
message) waits less behind a 100-user transaction than behind a 250-user one. Keep each concurrency at or above the
number of groups the largest allowed audience makes (10 inbox groups, 10 FCM calls): with fewer slots than groups the
groups queue in waves and a big send becomes slower than it was before this pass.

These numbers were chosen on a model of Firestore and FCM (latency per round trip, per written document, lock waits),
not measured against the real services. They are safe starting points, and the first thing to re-tune if production
traces show something different.

The browser-side counts in the table (one registration, one configuration fetch per browser) are what the tests in
`lib/client/*.test.ts` assert against fakes of the browser APIs. How much traffic that saves in production has not been
measured.

## Service worker notes

`public/firebase-messaging-sw.js` mirrors `contract.ts` (message names, payload key/version, handled
endpoint). It uses `tag` (conversation) else `key` (identical repeat) else `id` to replace notifications on
the device, counts tagged ones, and passes `silent` to `showNotification`. Browsers decide whether a
system notification makes sound and `silent: true` is a request, not a guarantee: where a browser or OS
ignores it, the device's own notification-sound setting applies and the app's sound setting cannot override it.

A push is handed to a page only when the person is working in it: the page is visible **and** its window has the focus
(`WindowClient.focused`; a browser that does not report it reads as "not in use"). A window that can merely be seen —
another app in front of it, half covered, on a second screen — is not being looked at, so it gets the system notification,
like a minimized window or a closed page. The page answers whether it took the notification (`useServiceWorkerBridge`):
yes also when the person's settings say no pop-up and no sound (they are in the app, and a system notification on top
would be the duplicate they opted out of), no when nobody could see anything after all. A "no", no answer within one
second, or a failed handshake (the list of open pages cannot be read) all end in the system notification: a doubled
notification is better than a lost one.

What a push may do _without_ a notification differs by browser, which is why the worker tells them apart by user agent
(`MAY_SKIP_NOTIFICATION`). The rules below come from the browsers' own documentation and source (Chromium's
`push_messaging_notification_manager.cc`, Firefox's `PushRecord.sys.mjs`, WebKit's "Enforce silent push quota" change);
none of it has been exercised on a real device from this folder (see Tests). In particular, that Safari counts a
notification shown and taken back at once as a notification follows from WebKit counting a push as silent only when
`showNotification` is never called while it is handled — it has not been tried:

| Browser                                                                      | A push handed to a page, with no notification drawn                                                                                                                                         | The worker                                                                        |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Chrome, Edge, Opera, Samsung Internet (Chromium), desktop and Android        | Allowed while a tab of the site is visible (focus is not needed). Otherwise a small allowance, then the browser draws its own generic "this site has been updated in the background" notice | Hands over to a visible, focused page only                                        |
| Firefox, desktop and Android                                                 | Counts against a quota; an open tab of the site resets it, so it only runs down while no tab is open, and a site that runs out loses its subscription                                       | The same                                                                          |
| Safari on macOS, every browser on iOS and iPadOS (Home Screen web apps only) | Not allowed: a push that shows no notification is "silent", and after three the subscription is removed (the site has to ask for permission again)                                          | Draws the notification and takes it straight back: silent, under a tag of its own |
| A browser it cannot tell                                                     | Unknown                                                                                                                                                                                     | Treated like Safari: a flash is cheaper than a lost subscription                  |

The taken-back notification has a tag of its own, never the conversation's: under the conversation's tag it would replace
(and then remove) a notification of that conversation the person has not dealt with yet. If a browser refuses an option
of `showNotification` (a `timestamp` that is not a number, an `image` it cannot take), the worker retries with a plain
one — a push that ends without any notification is the failure this worker exists to avoid.

The worker is not configuration-aware and does not need to be: the server resolves the configuration and puts the
results in the payload — `icon` (the configured default when the sender gave none) and `silent` (when sound is off for
that person, or off for everyone in the configuration's sound).

## Tests

`node:test` suites sit next to the code they cover — the parts that are easy to get subtly wrong and cannot be seen
failing by clicking around:

- `lib/client/locks.test.ts` — the cross-tab lock: turns, the waiting limit, failing open (no Web Locks, request refused,
  not granted in time), a task never runs twice.
- `lib/client/device.test.ts` — registering this browser: several tabs make one request; marker, another user, a new
  token and `force`; a failed save frees the lock; push turned off in another tab while one waited.
- `lib/client/configStore.test.ts` — the shared configuration: a fresh copy means no request, one fetch for several
  stale tabs, the 30 s pause after a failure, the revision guard, `apply()`, `refresh()`, `dispose()`, a clock set back
  (before or after a failure), a stored time whose copy is gone, storage that is unusable, letting go of the store.
- `lib/server/settings.test.ts` — the settings cache: 20 s freshness and which entry goes when it is full.
- `lib/client/serviceWorker.test.ts` — the real `public/firebase-messaging-sw.js`, run as written: a closed page, a
  minimized window, a window that is visible but not in use, one that is in use (Chrome, Edge, Firefox, Safari, iPhone
  browsers, an unknown one); a page that declines, does not answer or cannot be reached; tags and counts; payload formats;
  a browser refusing an option; the click (which window, which link, what the server is told).
- `lib/client/alerts.test.ts` — the in-app alert rules: settings, quiet hours, one pop-up per send, and the new "tab not
  in use" rule with what the worker is told (`takenInApp`).
- `lib/client/presence.test.ts` — which page the server believes a person is on: reported only while the tab is visible
  and in focus; the 3 s grace; at once on a phone's hidden tab and on close; no report from a pointer over an unused window.
- `lib/client/testFakes.ts` — the fakes they run on (Web Locks, localStorage, a window and document). Test support only;
  nothing in the app imports it. `lib/client/workerFakes.ts` is the same for the service worker: it evaluates the real
  worker file in `node:vm` on fakes of the open windows, the notifications on screen, `MessageChannel`, `fetch` and timers.

Run them from the project root. `tsx` is not a project dependency (`npx` fetches it when it is needed), and
`tsconfig.test.json` only adds what Next.js normally provides — the `server-only` alias — so the files load outside Next:

```bash
npx tsx --tsconfig components/notification/tsconfig.test.json --test "components/notification/**/*.test.ts"
```

They use fakes and no network: they show how this code behaves, not how real browsers, Firestore or FCM do. The service
worker tests in particular show the worker's _decisions_ (who it asks, what it draws, what it takes back, where a click
goes); that Chrome, Firefox and Safari then behave as the table above says, that FCM delivers to a closed page, and that
the operating system shows the notification (Windows notification centre, Android shade, iOS) are not covered by any test
here — only a real device proves them. The files are part of the project's type-check and lint like any other.

## Not done on purpose

- `unregisterDevice()` is never called when the user signs out (the sign-out code lives outside this
  folder). Until it is, a signed-out browser can keep receiving that user's pushes. The fix is one call
  before the session ends: `const { unregisterDevice } = useNotification(); await unregisterDevice();`.
- The navbar badge (`components/dashboard/Navbar`) still keeps its own listener on the counter document; it
  is a single tiny document, so it was left alone.
- **Looked at for the scalability pass and kept as it was**, because it is already cheap and changing it would add
  complexity for no measurable gain: the one shared inbox listener (20 newest, 60 s grace), the blind lock-free presence
  writes, the event-driven presence reporter, the unread counter that is only touched when a notification flips
  unread/read, the 20 s per-instance caches (configuration, settings) and the 3 s duplicate filter, the service worker
  without a Firebase SDK, and the client stores.
- **No cross-instance cache** (Redis and the like) for settings, the configuration or the duplicate filter. They are
  per instance on purpose: a miss costs one extra read and never a wrong answer. Add a shared one only if production
  numbers show those reads matter.
- **No global FCM rate limiter.** Each instance sends its own calls; when FCM pushes back (`message-rate-exceeded`,
  `unavailable`) the affected devices are retried with a jittered pause. A shared limiter would need shared state.
- **Looked at and left alone**, each for a reason:
  - _Skipping the push-support check when nobody is signed in._ What shows its answer (the settings screen, the enable
    button) reads "checking" until it arrives, and `/notification`, which does not check for a session itself, renders
    them; skipping the check would leave those waiting for good.
  - _Retrying Firestore transactions in `server/inbox.ts`._ The Firestore SDK already retries contention errors (up to
    five attempts); a second layer would multiply them.
  - _Deleting a device token on `messaging/mismatched-credential`._ FCM reports a token that belongs to another sender
    (`SENDER_ID_MISMATCH`) and a rejected permission (`PERMISSION_DENIED`) with that one code; with a wrong credential it
    would delete every good device.
  - _Shortening over-long `data` values inside `sendNotification()`._ It validates and answers `INVALID_INPUT` on purpose,
    so a caller's bug is not hidden; the caller shortens its own text (see the chat note under "Limits that remain").

## Limits that remain (and where they live)

- **Per-recipient work is inherent.** Every recipient needs their own in-app document (a read and a write), their own
  settings read (when not cached) and, with a `link`, their own presence read. Grouping and parallelism change how it
  is shaped, not how much there is: a first broadcast to 1,000 users reads up to about 3,000 documents (settings,
  notification, counter) and writes 2,000 (notification, counter) — the same before and after this pass.
- **One Firestore document takes roughly one sustained write per second.** A document many senders update at once
  (one very busy conversation's notification, or a counter) queues on that limit, whatever this folder does.
- **FCM:** `sendEach` opens a new HTTP/2 connection per call, so the number of calls (not messages) is the cost; token
  multicast is deprecated in firebase-admin 14 in favour of Firebase Installation IDs (`server/push.ts` is the only file
  that changes when you move).
- **Outside this folder, worth fixing when you are there:** `UserFCMToken` has no index on `fcmToken`
  (`prisma/contract.prisma` has `@@unique([userId, fcmToken])` and `@@index([userId])`, neither of which serves
  `WHERE fcmToken IN (...)`), and `deleteTokens` / `registerUserToken` filter on it — add `@@index([fcmToken])` before the
  table gets large. `authorization()` (`lib/verifyAuth.ts`) reads the user from Postgres on every API request; that is
  what makes a ban or password change effective immediately, so it is not cached here.
- **Outside this folder, a bug found while optimising (not changed here):** the chat's `notifyNewMessage`
  (`components/chat/lib/messageNotifications.server.ts`) puts the whole message into `data.message`, but
  `sendNotificationSchema` allows at most 500 characters per `data` value (`lib/schema.ts`) and a chat message may have
  up to 4,096 (`MAX_MESSAGE_LENGTH`). A message of 501 characters or more is refused with `INVALID_INPUT`: the receiver
  gets no push and no entry in the notification list for it, and the only trace is a `console.error`. The fix belongs in
  the chat: send a preview, e.g. `message.length > 500 ? message.slice(0, 499).replace(/[\uD800-\uDBFF]$/, '') + '…' : message`
  (the `replace` drops half a surrogate pair that the cut can leave). Delete this note once it is fixed.
- **Background delivery depends on the platform, not only on this code.** A system notification for a closed page needs the
  permission granted, a registered token, and a browser the operating system lets run in the background: battery savers
  and "force stop" on Android, a browser that is not running on some desktops, Focus Assist / Do Not Disturb / the
  browser's own switch in the OS notification settings. On iPhone and iPad web push exists only for a web app added to the
  Home Screen (with a manifest that asks for `display: standalone`), not for a tab in Safari or another iOS browser. A
  device that a browser or OS refuses to wake receives the push when it next can, until the message's time-to-live ends.
- **A subscription the browser replaces while the site is closed is not renewed until the next visit.** The worker has no
  Firebase SDK, so it cannot ask FCM for a new token itself; the page re-syncs the token when it next opens and the old one
  is deleted by the first send that finds it dead.
- **"In focus" is read from the browser** (`document.hasFocus()` in the page, `WindowClient.focused` in the worker). A browser
  that reports it wrongly — always false, say — would show system notifications while the person is in the app, instead of
  pop-ups: nothing is lost, but it is the old duplicate. Someone who leaves the app in front and in focus and walks away is
  still "here" until the server's 5 minutes run out, so a notification for that page is held back for that long.
- **The browser-side coordination is best effort, by design.** A tab that is still fetching its token when another tab
  removes the device has not asked for the lock yet, so it can register the revoked token afterwards (for "off on this
  device" the opt-out stops it; otherwise the dead token is dropped on the next send). A request that hangs holds the
  lock while it hangs: other tabs wait at most 10 s, then go ahead. A configuration fetch that was answered just before
  an admin's save and lands just after it can leave the older copy in storage until its 5 minutes are up. And if the
  messaging SDK cannot be downloaded when a page opens (offline, a deploy replaced the file), that page view treats push
  as unavailable until it is reloaded.

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
