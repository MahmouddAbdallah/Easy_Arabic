# Messages: loading, jumping, scrolling

How the open conversation gets its messages, and how a search result is brought on screen.

## The pieces

| File | Role |
| --- | --- |
| `lib/messageStore.ts` | The rules. Pure TypeScript (no React, no Firebase), so it is unit-tested: `npx tsx --test "components/chat/lib/*.test.ts"` |
| `lib/messageSource.ts` | The Firestore side of `MessageSource` (queries, cursors, listeners) |
| `hooks/useChatMessages.ts` | Wires a `MessageStore` to React and to the error toast |
| `hooks/useChatScroll.ts` | Scroll position, auto-loading at both ends, jumping to a message and flashing it |
| `ChatArea/MessageList.tsx` | The list itself: day sections, loading/empty/error states, "Latest" button |
| `lib/chatTheme.ts` | The chat's own colours, type, motion and shared class names (scoped to `.chat-theme`) |

## The model

The conversation is read in ranges that never overlap, each with its own live listener (so an edit, a deletion or a
reaction on any loaded message arrives in real time):

- the **tail**: the newest page's first message onwards, no upper limit. Always listening, even when it is not on screen.
- **segments**: pages of history (`loadOlder`, and after a jump `loadNewer`).

What is on screen is the chain of segments, followed by the tail once the chain reaches it. After a jump far into the
past the chain does not reach the tail: the view is **detached** and shows only a window around the message
(`windowBefore` / `windowAfter` messages). A jump to a message 20,000 messages back reads about 40 messages, not 20,000.
`returnToLatest()` drops the window at once (nothing is read).

A jump (`reveal`) picks the cheapest way: already on screen, nothing to read; within `gapCap` messages of what is
loaded, one bounded read extends the history; further away, a window opens.

## Why it cannot hang

Every read is a promise that settles: the server's first answer, a database error, a timeout (`loadTimeoutMs`), or
cancellation by a newer request. Nothing waits on a flag that someone else must reset. Two details of Firestore that the
old code tripped over are handled in `messageSource.ts`: listeners use `includeMetadataChanges`, because an answer that
equals the cache raises no second event without it; and the "first answer" is the first one that did not come from
the cache.

## Search navigation

`ChatSearchPanel` -> `ChatArea.handleSelectResult` -> `useChatScroll.jumpTo` -> `MessageStore.reveal` -> the message is in
`messages` -> `useChatScroll` scrolls to it (centred), keeps it aligned while images and fonts settle (until the reader
scrolls), and flashes it (`chat-flash-row` / `chat-flash-bubble` in `lib/chatTheme.ts`).

## Theme

Everything visual that is the chat's own is a `--chat-*` variable on `.chat-theme` (light and `.dark`). The same class
goes on anything rendered in a portal (sheets, dialogs, menus): `CHAT_ROOT_CLASS` / `ui.layer`. Inside `.chat-theme` the
shared UI components' tokens (`--primary`, `--muted`, ...) point at the chat's palette, so they look like the chat
without being edited.

The theme reaches the page as an inline `<style>` rendered by `ChatProvider`. The app sets no Content-Security-Policy; if
one is added, that element needs the nonce.
