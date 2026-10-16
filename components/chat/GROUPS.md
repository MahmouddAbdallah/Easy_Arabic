# Groups

How "Create Group" works, where it lives, and what it relies on. Everything is inside `components/chat` and
`app/api/chat`; nothing outside them was touched.

## The flow

1. **Menu → Create Group** (`Sidebar/SidebarHeader.tsx`) opens a sheet over the sidebar (`Groups/CreateGroupSheet.tsx`).
   The item is shown to the roles that can start a conversation (admin, teacher); the server enforces it too.
2. **Add people** (`Groups/AddPeopleStep.tsx`): search as you type, tap to choose, chosen people stay visible as chips.
   The list comes from `GET /api/chat/groups/candidates`.
3. **Group details** (`Groups/GroupDetailsStep.tsx`): optional photo, name (required), description (optional), the members
   once more. Validated as you type and on *Create group*; the server validates again.
4. **Create** (`hooks/useCreateGroup.ts`): the photo (if any) goes straight to Cloudinary, then `POST /api/chat/groups`.
   On success the sheet closes and the group opens (`?groupId=<id>`); it is already in every member's sidebar.

A group is opened with its own address parameter, `?groupId=`, next to the existing `?receiverId=`. `ChatProvider` reads it,
follows the group's document live (`hooks/useGroupChat.ts`) and gives the conversation pane what it needs
(`ChatArea/GroupHeader.tsx`, `ChatArea/GroupInfoSheet.tsx`, sender names in `MessageList`).

## Who can do what (enforced on the server, `lib/groupOperations.server.ts`)

| | Create a group | Can be added by an admin | Can be added by a teacher |
|---|---|---|---|
| admin | yes | any active account | |
| teacher | yes | | only families assigned to them, active |
| family | no (403) | | |

Accounts that are not `active` can never be added. The member list in the browser is a convenience; the rule is checked
again when the group is created, and the refused people are named so the form can take exactly them off the list.

## Storage

A group is one Firestore document in the same collection as a direct chat, `chats/{groupId}`:

```
category      "group"
name, description?, imageUrl?, imagePublicId?
participants  [userId, ...]       creator first; the field the sidebar query and the unread counters already use
createdBy, admins [userId]
members       { [userId]: { name, role, imageUrl? } }   so the screen needs no per-member lookup (no email or phone)
time, createdAt, updatedAt        the sidebar orders by updatedAt, the history by time: both must exist
lastMessage, lastSenderId?, unreadCount { [userId]: n }, isRead
```

`groupId` is `grp-` plus 21 letters/digits. A direct chat's id always contains `_`, so the two can never collide, and no
direct-chat endpoint (they derive their chat id from two user ids) can reach a group.

## Safe to repeat

The browser picks `groupId` once per "New group" session and sends it. The server uses Firestore `create()`: a repeat
(double click, retry after a dropped connection that had in fact worked) is answered with the group it already made
(`created: false`, no second announcement). A different user sending the same id gets `409 GROUP_ID_TAKEN`.
The photo is uploaded once, reused by retries, replaced if another picture is chosen, and deleted if the person leaves
without creating the group (never while the server is being asked: the group may own it by then).

## API

| | |
|---|---|
| `POST /api/chat/groups` | create (`201`, or `200` for a repeat). Rate limited. Errors: `400` validation, `403`, `409`, `422 INVALID_MEMBERS` with `details.memberIds` |
| `GET /api/chat/groups/candidates?keyword=` | who the caller can add (id, name, role, photo only). Rate limited |
| `POST /api/chat/groups/uploads` | signed Cloudinary tickets: `purpose: "photo"` for the picture of a group about to exist (JPG/PNG/WebP), `purpose: "message"` for files and voice messages sent to a group the caller is in |
| `PATCH /api/chat/messages` `{ action: "sendGroup", groupId, text, attachments }` | send to a group (members only). The direct-message request is unchanged |

Reading, editing, deleting, reacting to and marking a group's messages read use the existing endpoints unchanged: they
only need the chat id and the participants. Sending counts the message as unread for every member but the sender, in
the chat and in their centralized totals, in one transaction (`lib/groupMessages.server.ts`).

## Requirements

* Firestore rules must let a member read `chats/{id}` and its `messages` by `participants` (the sidebar's existing query
  already depends on that), and clients must not write to them: every write here goes through the Admin SDK.
* Cloudinary configured as for message attachments (only needed for the group photo and for files in a group).

## Not in this phase

Group calls, the typing indicator and in-chat search inside a group, renaming / adding / removing members, leaving or
deleting a group, and making other members admins. `admins` is stored (the creator) so those can build on it.

## Tests

```
npx tsx --test "components/chat/lib/*.test.ts"
```

`groups.test.ts` (rules, ids, schemas, unread updates), `groupOperations.test.ts` (creation, who can be added,
candidates, upload tickets) and `groupMessages.test.ts` (sending to a group) run the real server code against in-memory
stand-ins for the database, Firestore and Cloudinary.
