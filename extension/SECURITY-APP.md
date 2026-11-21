# HCM Coach: security one-pager

For IT reviewers. This is the HCM Coach app: a coach that sits beside Oracle, a Help chat, and live updates.
It talks only to the one HCM Coach server. That server can use an AI model to explain a step or check a say-back.

- **Ask** (the pop-up chat) answers from the guides and job aids in HCM Coach and nothing else. Before the access
  code is entered it quotes them locally, with no network call. With the code, it sends her question, the last few
  turns of the chat and the current process and step ids to `/api/coach`; the server gives the AI only the app's
  guides and job aids, and the AI must say "not in HCM Coach" rather than answer from anything else.
- **Live updates** download guides, contacts and job aids from the HCM Coach server, so content changes without
  reinstalling the app.
- **The coach** sets how much help each step gets (Guide, Prompt, On call, Off) from her answers. That count is
  kept and decided in the app, never by the AI. Only when she presses a coach button (Explain more, How was my
  Ask, Check my say-back) does the app send the process id, the step id and what she typed to
  `/api/coach`. The server adds the verified process text and asks the AI model to answer from it only.

- **Progress sharing (opt-in, off by default).** If she turns on "Share my progress", then after each finished
  process the app sends `/api/progress` her chosen name, a random ID made on her device, the process ID, and each
  step's support level and right/miss. Never her screen, Oracle data, chat or anything she types. Records are
  private files in a Vercel Blob store (`hcm-coach-progress`), readable only by the server; the dashboard at
  `/progress` needs a separate admin code (`PROGRESS_ADMIN_CODE`), not the shared access code. Records are deleted
  after 12 months, and turning sharing off deletes hers at once.

## It cannot see or touch any web page
- No `host_permissions`, no `content_scripts`. Permissions are `storage` and `sidePanel` only.
- It never opens, navigates or closes a tab, and cannot read the page beside it, including Oracle.

## Network access: one address, two calls
- `manifest.json` sets `connect-src` to a single origin, fixed at build time. Chrome blocks every other address.
- The code contains exactly two network calls: a GET of `/api/content` (when the panel opens or the person
  presses "Check for updates") and a POST to `/api/coach` (only when she presses a coach button, asks in the chat, or, if she opted in, finishes a process and her progress is shared). The build fails
  if there is any other call, or any other address in the bundle.
- What is sent: the shared access code; for the coach, also the process and step ids and the text she typed.
  No user id, no login, no cookies, and nothing from any page. Progress, support
  levels, results, ratings and call notes never leave the device.
- The AI key lives only on the server (Vercel setting `AI_API_KEY`). With a Vanderbilt Amplify key, the server sends
  the request to Vanderbilt's Amplify API, so questions stay within Vanderbilt's AI service. It is never in the app. Without it the
  coach buttons say the coach is not set up, and everything else works.

## Downloaded content, and how it is handled
A JSON pack of guides, contacts, rubrics and job-aid text. Before it is stored or used, every item is checked
against the same schemas the build uses; a guide that names a website or carries on-page targets is rejected;
anything that fails is dropped, and if nothing usable is left the app keeps what it had. Downloaded content is
only ever shown as text, never run as code. New content takes effect between guides, never part-way through one.
The last good download is kept in `chrome.storage.local` (`cm.content`), so the app works without a connection.

## What this changes about trust
Whoever can publish to the HCM Coach server can change the instructions people follow, for everyone at once.
The controls that matter are on the server: who can deploy, review of changes before they go live, and the
access code. The pack is not signed; the browser's HTTPS check on the fixed address vouches for it.

## What it stores
Progress, support levels per step (`cm.levels`), results, ratings and call notes, in this browser only. Plus the access code in `cm.prefs` and the last
content download in `cm.content`. The chat is held in memory only and is gone when the panel closes. Whether the tour has been watched (`cm.prefs`).
The tour video ships inside the extension (`tour.webm`); it is not downloaded.

## Known limits
- The access code is shared, not per person, and gates read access to internal procedures and the coach. Rotate
  it by changing the server setting. The coach is rate-limited on the server.
- What she types to the coach goes to the AI provider to be answered. Tell people not to type personal details
  about employees; the coach only needs the process.
- Loaded unpacked, the extension is unsigned and can be altered by anyone who can edit the folder.

## How to verify
1. Read `manifest.json`: two permissions, no host permissions, no content scripts, one origin in `connect-src`.
2. Right-click the side panel > Inspect > Network. Open the panel: one GET to `/api/content`. Ask in the chat: one POST to `/api/coach`.
   Press Explain more: one POST to `/api/coach`.
3. In the console run `fetch("https://example.com")`: refused by the content security policy.
