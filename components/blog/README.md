# Blog

The Easy Arabic Blog: a complete publishing system that lives inside this one folder. Admins write
posts in a rich-text editor in the dashboard; visitors read them on public pages, and can leave
comments that an admin approves before anyone else sees them.

This document tells the whole story: what the Blog is, how it is built, how a post travels from an
empty draft to a published page, how comments are moderated, and why things work the way they do.

- [At a glance](#at-a-glance)
- [The story of a post](#the-story-of-a-post)
- [Folder map](#folder-map)
- [Architecture](#architecture)
- [Data model](#data-model)
- [The public side](#the-public-side)
- [The dashboard side](#the-dashboard-side)
- [Media](#media)
- [Comments](#comments)
- [API reference](#api-reference)
- [Configuration](#configuration)
- [Security](#security)
- [Using the Blog elsewhere](#using-the-blog-elsewhere)
- [Operating notes](#operating-notes)
- [Change history](#change-history)

---

## At a glance

| | |
|---|---|
| **Public pages** | `/blog` (list, filters, pagination) and `/blog/<slug>` (one article) |
| **Admin pages** | `/dashboard/blog` (posts and editor) and `/dashboard/blog/comments` (moderation) |
| **Storage** | Firestore (`blogs`, `blogSlugs`, `blogComments`). Media in Cloudinary. |
| **Rendering** | Server components, rendered on every request. The only client scripts on a public article are the code blocks' "Copy" button, the comment form, and the small script that highlights the current section in the table-of-contents rail. |
| **Languages** | Arabic and English, including mixed. Direction is detected per block, slugs may be Arabic. |
| **Auth** | Reuses the project's own admin authorization. No separate login. |
| **Mount point** | One constant, `BLOG_BASE_PATH` in `lib/constants.ts`. |

Everything tunable (routes, collection names, limits, rate limits) lives in
[`lib/constants.ts`](lib/constants.ts). Read that file first when you want to change a number.

---

## The story of a post

1. **Create.** An admin clicks *New post* and gives it a title. A **draft** is created, with a unique
   slug generated from the title (Arabic titles get Arabic slugs).
2. **Write.** The editor offers headings, lists, quotes, links, inline code, code blocks with syntax
   highlighting, callouts, dividers, images, uploaded videos and YouTube/Vimeo embeds. The body is
   stored as structured JSON, never as raw HTML.
3. **Describe.** The settings panel holds the slug, category, tags, excerpt, cover image and SEO
   fields (title, meta description, canonical URL).
4. **Preview.** A preview tab renders the post with the very same component visitors get, so what the
   author sees is what visitors will see.
5. **Publish.** Publishing stamps the publish date and makes the post public. It is refused if the
   post has no title or no content. Returning a post to draft hides it again and clears the date.
6. **Read.** Visitors find it on `/blog`, filter by category or tag, and open `/blog/<slug>`. The
   article has a table of contents (once it has three or more headings), a reading-time estimate,
   related posts, and structured data for search engines.
7. **Discuss.** Visitors can comment. Nothing they write is public until an admin approves it.
   Admins reply from the dashboard, and the reply appears under the comment with an Admin label.
8. **Retire.** Deleting a post removes the post, every file in its media folder, and every comment
   on it.

---

## Folder map

```
components/blog/
  Blog.tsx               one published post (server component, drop it into any route)
  BlogArticle.tsx        the article layout (shared by the public page and the dashboard preview)
  BlogIndex.tsx          the public list page (filters, pagination)
  BlogCard.tsx           a post card
  BlogMeta.tsx           author, date, reading time
  BlogToc.tsx            "On this page" (a collapsible card in the text on small screens, the rail on large ones)
  BlogTocSidebar.tsx     the sticky rail itself (client component: it only adds the current-section highlight)
  BlogJsonLd.tsx         schema.org BlogPosting data
  BlogPagination.tsx

  content/               how a stored post becomes HTML
    BlogContent.tsx      renders the structured body (paragraphs, images, videos, embeds, ...)
    blog-prose.css       typography and media rules (also used by the editor)
    CodeBlock.tsx, CopyCodeButton.tsx

  comments/              the PUBLIC comments section
    BlogComments.tsx     section wrapper (reads approved comments, issues the form token)
    CommentThread.tsx    comments with admin replies nested under them
    CommentForm.tsx      the "Leave a comment" form

  dashboard/             the ADMIN side
    BlogManager.tsx      posts list <-> editor
    list/                post list, toolbar, rows
    editor/              the editor, settings, SEO, cover image, preview
      rich-text/         the Tiptap editor and its custom nodes (image, video, embed, callout)
    dialogs/             new / delete / discard-changes / delete-comment confirmations
    comments/            comment moderation screen, cards, reply box
    hooks/               data hooks (post list, editor, uploads, comment list, pending count)
    lib/                 blogApi.ts and commentsApi.ts, the dashboard's doors to the API

  lib/                   shared logic
    constants.ts         every tunable value
    types.ts             post types
    schemas.ts           request validation (zod, server only)
    content.ts           validate / sanitize / analyze the post body (pure)
    blogs.server.ts      all Firestore access for posts
    media.server.ts      uploads and clean-up (Cloudinary)
    http.server.ts       admin check, error shape, body parsing
    listing.ts           in-memory filter + pagination (pure)
    mappers.ts, slug.ts, taxonomy.ts, direction.ts, format.ts, url.ts, highlight.ts
    metadata.ts          <head> metadata
    revalidate.server.ts cache refresh after a change
    comment-*.ts         comment types, validation, text rules, thread building (see Comments)
    comments.server.ts   all Firestore access for comments

app/blog/                public routes
app/api/blog/            API routes (posts, media, comments)
app/dashboard/blog/      admin routes
```

Naming convention: files ending in `.server.ts` must never be imported from client code.

---

## Architecture

**Server-first.** Public pages are server components. They read Firestore through `firebase-admin`
and ship plain HTML. Pages are `force-dynamic`: posts and comments are edited live, so nothing is
baked in at build time (which also means the build needs no database).

**One data layer per concern.** `blogs.server.ts` is the only place that talks to Firestore about
posts, and `comments.server.ts` is the only one for comments. Routes stay thin: authorize, validate,
call the data layer, return JSON.

**Pure logic is separate and testable.** Content validation (`content.ts`), list filtering
(`listing.ts`), comment text rules (`comment-text.ts`) and comment thread building
(`comment-threads.ts`) import no framework and no database.

**No composite indexes.** Every query is a single-field or equality-only query, and anything more
(search, filtering by status, sorting) happens in memory over a lean projection that never
downloads post bodies. Nothing to create in the Firebase console. The trade-off is a read cap:
500 posts for the dashboard list, 300 for public lists, 500 comments per list. A warning is logged
if a cap is reached.

**Zod stays on the server.** Client code only imports types, so no validation library ships to
the browser.

**One error shape.** Every API failure is
`{ success: false, error: { code, message, details? } }`, so the UI can show `message` directly and
put `details` next to the right field.

---

## Data model

### `blogs/{blogId}`

A post. Key fields: `title`, `slug`, `excerpt`, `category`, `tags[]`, `coverImage`, `content`
(structured JSON), `status` (`draft` | `published`), `publishedAt`, `updatedAt`, `readingTime`,
`author`, and `seo` (`title`, `description`, `canonicalUrl`).

A post is public only while it is `published` **and** its `publishedAt` has arrived
(`isPubliclyVisible` in `lib/mappers.ts`).

### `blogSlugs/{slug}`

One tiny document per slug in use. It is created in the same transaction as the post, which is what
guarantees slugs are unique.

### `blogComments/{commentId}`

One document per reader comment or admin reply.

| Field | Meaning |
|---|---|
| `blogId` | The post it belongs to |
| `parentId` | `null` for a comment; the comment's id for an admin reply |
| `kind` | `visitor` or `admin` |
| `status` | `pending` or `approved`. Admin replies are always `approved`. |
| `authorName`, `authorEmail` | What the visitor typed. The email is optional and private. |
| `authorUserId`, `authorUserName` | Set on admin replies, for the record only |
| `body` | Plain text |
| `duplicateHash` | Fingerprint used to spot the same comment sent twice |
| `ipHash` | Hashed IP, used for abuse limits. The raw IP is never stored. |
| `createdAt`, `updatedAt`, `moderatedAt`, `moderatedBy` | Timestamps and who approved |

Public reads select only name, text and date. The email, status, IP hash and fingerprint never
leave the server.

### The post body

The body is a small, strict JSON document (Tiptap/ProseMirror style) that the server validates and
sanitizes before storing. Allowed blocks: paragraph, heading (2-4), bullet and numbered lists,
blockquote, code block, callout (`info`, `tip`, `warning`, `recommended`), horizontal rule, image,
video and embed (YouTube or Vimeo). Limits (nodes, depth, bytes) are in `BLOG_LIMITS`. Because there
is no stored HTML, there is nothing to sanitize at render time and no way to inject markup.

---

## The public side

### The list (`/blog`)

Posts, newest first, nine per page. Filters are `?category=` and `?tag=` (compared by slug, so
`Grammar` and `grammar` are the same filter) and `?page=`. A page past the end lands on the last
page instead of an empty one.

### The article (`/blog/<slug>`)

`Blog.tsx` loads the published post and renders `BlogArticle`:

- **Header:** back link and category, title, intro, and the byline (author on one side, date and
  reading time on the other) between two hairlines, with a short gold segment on the top one.
- **Cover image:** keeps its own proportions (clamped between 3:2 and 2.2:1 so it can never take over
  the screen or be badly cropped).
- **Table of contents** for posts with three or more headings. On large screens (`lg`, 1024px and up)
  it is a sticky rail beside the text that follows the reader and marks the section being read. Below
  that it is a collapsible "On this page" card above the text. The dashboard preview always uses the
  card: it is narrow, and "sticky" cannot work inside its clipped box.
- **Body**, then tags, then the comments section (in the same column as the text, so the rail stops
  following the reader once the article ends), then related posts on a tinted band.
- **Metadata and structured data** for search engines (`metadata.ts`, `BlogJsonLd.tsx`), using
  `APP_URL` for absolute links.

### Reading experience

The article is one focused reading column (42rem, about 65-70 characters per line) with a clear
hierarchy: title, then a lighter intro, then body. On large screens a post with a table of contents
gets a 14rem rail beside the column (42rem + 4rem gap + 14rem = 60rem). The header, cover and body are
built on the same two widths (`COLUMN` and `WIDE` in `BlogArticle.tsx`), so their edges line up. Rules
that matter:

- **Direction.** The whole article takes the direction of its title: an Arabic post mirrors (byline,
  tags, back link, and the rail moves to the left) while every block of the body still sets its own
  direction. Everything layout-related uses logical properties (`ms-`, `ps-`, `border-s`, `inset-s-`),
  never `left`/`right`. Two things are deliberately kept left-to-right because they are English: the
  comments section's own words (an English sentence ending in a full stop shows the stop on the wrong
  side in a right-to-left box; each comment and the form fields still pick their own direction), and
  digit-first strings such as "7 min read" (wrapped in `<bdi dir="ltr">`, otherwise they read "min read
  7"). Arabic headings get no letter-spacing, because negative tracking pulls joined letters apart.
- **Typography** is defined once in `content/blog-prose.css` and shared with the editor, so the
  author sees the same thing visitors do.
- **Arabic gets more line spacing** than Latin (about 1.95 vs 1.75 for body text). The rules key off
  the explicit `dir="rtl"` the renderer sets on every block. Do not use `:dir(rtl)` here: the CSS
  build rewrites it into a `:lang()` list that never matches this site.
- **Images** are never stretched or cropped. They are as wide as the column but never wider than
  the original, and no taller than `--media-max-height` (30rem, or 75% of the screen if smaller).
- **Videos** use the same height cap. A tall phone video is letterboxed inside its player instead of
  becoming a 1000px-tall block. The video's real shape is reserved before it loads, so the page
  does not jump.
- **Embeds** (YouTube via the privacy-enhanced domain, and Vimeo) are 16:9 and slightly narrower
  than the text column.
- **Light and dark themes** both work. Colors come from the project's design tokens.

---

## The dashboard side

### Posts (`/dashboard/blog`)

A list with search and Published/Drafts tabs, then the full-screen editor for one post.

- **Editor:** title, rich-text body, settings panel, SEO fields, cover image, preview tab.
- **Slug:** follows the title automatically while the post is a draft and you haven't edited it.
  Once published, the slug stays put unless you change it.
- **Unsaved changes:** leaving with edits asks for confirmation.
- **Local backup:** while you type, a backup is saved in your browser every few seconds (kept for
  seven days). If the tab crashes, it offers to restore it, but only if the post hasn't changed
  on the server since.
- **Publishing guards:** a title and some content are required, enforced on the server.

### Comments (`/dashboard/blog/comments`)

The moderation inbox. See [Comments](#comments). The sidebar's **Blog** group links to both pages
(*Posts* and *Comments*), and shows a badge with the number of comments waiting for review.

---

## Media

- **Images:** JPEG, PNG, WebP, GIF, AVIF, up to 10 MB. **Videos:** MP4, WebM, QuickTime, up to
  50 MB. Embedding YouTube or Vimeo has no size limit.
- Uploads go through the Next.js server into Cloudinary, into **one folder per post**
  (`<root>/blog/<blogId>`). Deleting a post removes exactly that folder and nobody else's files.
- Uploads are admin-only and rate-limited (30 per minute per admin).
- Images are requested from Cloudinary in several widths (never upscaled) so each device downloads
  a sensible size.
- Hosts with a small request-body cap (for example 4.5 MB on Vercel) will refuse large video
  uploads before the 50 MB limit is reached. Use an embed for those.

---

## Comments

### The rules

1. Any visitor can comment on a **published** post.
2. A comment is **pending** the moment it is sent. It is invisible to everyone but admins.
3. An admin **approves** it (it becomes public) or **rejects** it (it is deleted).
4. Only approved comments are ever shown publicly.
5. An admin can **reply** to an approved comment. The reply is public immediately, labelled
   *Easy Arabic* with an **Admin** badge, and nested under the comment.
6. An approved comment can be **unpublished** (back to pending). Its replies are hidden with it.
7. Deleting a comment deletes its replies. Deleting a post deletes all its comments.

Threads are one level deep: a comment, and the replies to it. Only admins reply; visitors cannot
reply to each other.

### What visitors see

Under each article: a **Comments (n)** heading, the approved comments oldest first, each with its
admin reply nested beneath, and the **Leave a comment** form (name, optional email, comment).
After sending, the form is replaced with a confirmation that the comment will appear once reviewed.
Comments mirror for Arabic: an Arabic comment reads right-to-left with its avatar on the right.

Comments are **plain text**. Line breaks are kept; everything else is escaped. There is no HTML, no
Markdown, and links are never clickable.

### What admins see

`/dashboard/blog/comments`: tabs for **Pending** (the default, oldest first), **Published** and
**All**, each with a live count; search across name, email, comment text and post title; pagination.
Each comment card shows the author, their email (admins only), the post it belongs to, a status
pill and the text, with actions:

| Comment is | Actions |
|---|---|
| Pending | **Approve**, **Approve & reply** (approves, then posts the reply), **Reject** |
| Published | **Reply**, **Unpublish**, **Delete** |
| Admin reply | **Delete** |

Reject and delete always ask for confirmation, with wording that matches what will happen. Replying
to a pending comment approves it first, because a reply under a hidden comment would be invisible.

### Spam and abuse protection

`POST /api/blog/<id>/comments` is the only endpoint in the Blog that anyone can call, so it is
layered. In order:

1. **Same-origin check.** A browser on another site cannot post here.
2. **Flood limit** on every request per IP (30 per 10 minutes), valid or not.
3. **Body size cap** (16 KB) before anything is parsed, then validation: name 1-60 characters,
   optional valid email, comment 2-2000 characters, at most two links, no URL as a name, no
   12-in-a-row repeated characters, at least a couple of real letters. Invisible and text-reordering
   characters are stripped; Arabic and Persian joiners are kept.
4. **Honeypot.** A hidden field real visitors never see. If it is filled, the request gets a
   convincing "success" and nothing is stored, so bots don't learn they were caught.
5. **Signed form token.** The article page signs `post id + time` when it renders the form. The
   server checks the signature, that the token belongs to this post, that the form existed for at
   least 4 seconds (scripts post instantly), and that it is under 24 hours old.
6. **The post must be published.**
7. **Per-IP limits** on valid-looking submissions: 3 per 10 minutes and 15 per day.
8. **Queue protection and duplicates:** at most 6 unreviewed comments per IP and 100 per post, and
   the same comment (ignoring case and punctuation) cannot be sent twice on the same post.

Because the token is signed when the page renders, **the comments section must be rendered per
request** (it is: blog pages are `force-dynamic`). Never bake it into a static page.

### Privacy

The visitor's email is optional, stored only so an admin can contact them, shown only in the
dashboard, and never included in any public read. The IP address is stored only as a hash. The
signed-in admin's personal name is stored on their replies for the record but never shown;
visitors see "Easy Arabic".

---

## API reference

All admin endpoints require a signed-in **admin** (`401` if not signed in, `403` if not an admin).

### Posts

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/blog` | Admin list (search, status, pagination) |
| `POST` | `/api/blog` | Create a draft `{ title }` |
| `GET` | `/api/blog/:blogId` | One post, with body |
| `PATCH` | `/api/blog/:blogId` | Update fields, content, status |
| `DELETE` | `/api/blog/:blogId` | Delete the post, its media and its comments |
| `POST` | `/api/blog/:blogId/media` | Upload an image or video |

### Comments

| Method | Path | Who | Purpose |
|---|---|---|---|
| `POST` | `/api/blog/:blogId/comments` | **Anyone** | Submit a comment `{ name, email?, body, token, website }`. Stored as pending. |
| `GET` | `/api/blog/comments` | Admin | Moderation list. Query: `status` (`pending`/`approved`/`all`), `search`, `blogId`, `page`, `pageSize`. Returns comments with their replies, tab counts and pagination. |
| `GET` | `/api/blog/comments/pending-count` | Admin | Number of comments waiting (the sidebar badge) |
| `PATCH` | `/api/blog/comments/:commentId` | Admin | `{ status: "approved" \| "pending" }` to publish or unpublish |
| `DELETE` | `/api/blog/comments/:commentId` | Admin | Reject or delete (replies go with it) |
| `POST` | `/api/blog/comments/:commentId/replies` | Admin | `{ body }`. Only under an approved comment (`409` otherwise). |

Notable error codes on the public endpoint: `VALIDATION_ERROR` (with per-field `details`),
`FORM_INVALID`, `FORM_EXPIRED`, `TOO_FAST`, `RATE_LIMITED` (with a `Retry-After` header),
`DUPLICATE_COMMENT`, `TOO_MANY_PENDING`, `COMMENTS_BUSY`, `NOT_FOUND`.

---

## Configuration

### Environment variables

| Variable | Used for |
|---|---|
| `APP_URL` | Absolute URLs in metadata and structured data. Built from this, never from request headers. |
| `JWT_SECRET` | Existing auth secret. Also signs the comment form token and keys the duplicate fingerprint, so **it must be set in production**. |
| `TRUSTED_IP_HEADER` | Which header carries the real client IP (so rate limits count real visitors, not your proxy). Set it correctly behind a proxy. |
| `FIREBASE_PRIVATE_KEY`, `FIREBASE_DATABASE_URL` | `firebase-admin` access to Firestore |
| `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Media |

### Tunables (`lib/constants.ts`)

Mount path, collection names, page sizes, scan limits, content limits, media rules and the
comment limits and anti-spam numbers (`COMMENT_LIMITS`, `COMMENT_ANTISPAM`, `COMMENT_SITE_NAME`).
To change the name shown on admin replies, change `COMMENT_SITE_NAME`.

To move the Blog to another route, rename `app/blog` and change `BLOG_BASE_PATH`. Every link the
Blog builds reads it.

---

## Security

- **Authorization on every admin request.** Pages check the role, and the API checks it again on
  each call. Hiding a button is never the only protection.
- **Server-validated everything.** Request bodies, content, uploads and comments are validated on
  the server whatever the UI allows.
- **No stored HTML.** Posts are structured data and comments are plain text, rendered through
  React's escaping, so neither can inject markup or scripts.
- **Same-origin checks** on state-changing requests, size caps on public bodies, and rate limits
  on uploads and comments.
- **Minimal public reads.** Public queries select only the fields visitors may see.
- **Firestore rules:** all access goes through the server, so client access to `blogs`,
  `blogSlugs` and especially `blogComments` should be denied in your Firestore security rules
  (comments hold visitors' emails). The repo doesn't contain the rules file, so check them in the
  Firebase console.

---

## Using the Blog elsewhere

Render one published post anywhere:

```tsx
<Blog blogId="..." />
```

| Prop | Default | Meaning |
|---|---|---|
| `showToc` | `true` | "On this page" links |
| `showRelated` | `false` | Cards for more posts |
| `showComments` | `false` | The moderated comments section |
| `notFoundIfMissing` | `false` | Return the site's 404 instead of `fallback` |
| `fallback` | nothing | Shown if the post is missing |
| `basePath` | `BLOG_BASE_PATH` | Where the Blog is mounted |

Only published posts render; drafts and unknown ids count as missing. Comments are off by default
so embedding stays light. The public article page turns them on. If you enable them somewhere new,
that route must also be rendered per request.

---

## Operating notes

- **Deploy checklist:** `JWT_SECRET`, `APP_URL` and `TRUSTED_IP_HEADER` set; Firestore rules deny
  client access to the Blog collections; Cloudinary variables present.
- **Queries to watch:** comment counts use two equality filters on different fields (for example
  post and status). Firestore normally serves these from its automatic single-field indexes. If a
  query ever fails with a link to create an index, follow the link once.
- **Growth:** past the read caps (500 posts or comments in the dashboard, 300 public posts) the
  oldest items fall out of those lists and a warning is logged. That is the signal to move that
  list to indexed, paginated queries.
- **No email notifications.** Admins find new comments through the sidebar badge. Visitors are not
  emailed when their comment is approved or answered.
- **Rejecting is deleting.** There is no "rejected" archive.
- **Editor line spacing:** the extra Arabic line spacing applies on the public page and preview.
  The editing surface itself uses the standard spacing.

---

## Change history

### Article page redesign (reading layout, rail, comments)

Presentation only: no change to data, APIs, validation or comment behavior. The article page had been
laid out at the full 1280px width, which put body text at 120+ characters per line; it is back to a
42rem reading column. New: a sticky "On this page" rail with a current-section highlight on large
screens (`BlogTocSidebar.tsx`, a small client component with no dependencies; the inline collapsible
card is kept for small screens and the dashboard preview), a byline between hairlines with the gold
accent, tags as a labelled row of touch-sized chips, a "Keep reading" band with a "View all posts" link,
comments as cards (one per thread, admin replies nested), and a comment form with placeholders on every
field, 44px inputs and a brand-coloured submit button. Arabic posts now mirror as a whole (see Reading
experience). `blog-prose.css` changed in four small ways (softer body colour with full-strength
headings, no letter-spacing on Arabic headings, a little more space above `h2`); the dashboard editor
shares that file, so it picks the same changes up. `BlogCard` gained one attribute (`dir="ltr"` on the
reading time) so related cards under an Arabic post read correctly.

### Reading experience and comment moderation

**Reading experience.** The article page was refined into an editorial layout: a single reading
column, a clearer title / intro / body hierarchy, tighter vertical rhythm, better Arabic line
spacing, and a bounded media system. Images keep their proportions and never exceed the column or a
maximum height; videos are letterboxed rather than oversized; the cover image keeps its shape. The
light and dark themes and the existing visual identity were kept.

**Comment moderation.** Added the whole comments workflow: a public form, a pending state, an admin
moderation screen, approve / reject / unpublish / delete, admin replies shown as threaded replies
with an Admin label, the layered spam protection above, a pending badge in the sidebar, and cleanup
of comments when a post is deleted. It reuses the project's existing authentication, Firestore,
rate limiter, UI components and design tokens.

**Small supporting changes.** The sidebar gained a **Blog** group (the Blog admin was previously
reachable only by typing its URL). `BlogArticle` gained a `comments` slot that the dashboard preview
leaves empty. `http.server.ts` gained a size-capped body reader for public endpoints. Deleting a
post now also removes its comments.
