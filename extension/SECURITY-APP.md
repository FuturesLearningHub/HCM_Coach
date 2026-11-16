# HCM Coach: security one-pager

For IT reviewers. This is the HCM Coach app: a step-by-step guide that sits beside Oracle, a Help chat, and live
updates. There is **no AI and no outside service** beyond the one HCM Coach server.

- **Help** answers questions by quoting the guides and job aids already loaded into the app. It runs entirely
  inside the extension: no model, no network call. Nothing typed into Help leaves the computer.
- **Live updates** download guides, contacts and job aids from the HCM Coach server, so content changes without
  reinstalling the app.

## It cannot see or touch any web page
- No `host_permissions`, no `content_scripts`. Permissions are `storage` and `sidePanel` only.
- It never opens, navigates or closes a tab, and cannot read the page beside it, including Oracle.

## Network access: one address, one call
- `manifest.json` sets `connect-src` to a single origin, fixed at build time. Chrome blocks every other address.
- The code contains exactly one network call: a GET of `/api/content` when the panel opens or the person presses
  "Check for updates". The build fails if there is any other call, or any other address in the bundle.
- The only thing sent is a shared access code. No user id, no login, no cookies, nothing typed into Help,
  nothing about what the person is doing, and nothing from any page. Progress, results, ratings and call notes
  never leave the device.

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
Progress, results, ratings and call notes, in this browser only. Plus the access code in `cm.prefs` and the last
content download in `cm.content`. The Help chat is held in memory only and is gone when the panel closes.

## Known limits
- The access code is shared, not per person, and gates read access to internal procedures. Rotate it by changing
  the server setting.
- Loaded unpacked, the extension is unsigned and can be altered by anyone who can edit the folder.

## How to verify
1. Read `manifest.json`: two permissions, no host permissions, no content scripts, one origin in `connect-src`.
2. Right-click the side panel > Inspect > Network. Open the panel: one GET to `/api/content`. Use Help: nothing.
3. In the console run `fetch("https://example.com")`: refused by the content security policy.
