# HCM Coach Guide (live content): security one-pager

For IT reviewers. This is the guide build with one addition: it downloads its guides, contacts and job aids from
one server, so content can be updated without reinstalling the extension. No AI is involved.

## It still cannot see or touch any web page
- No `host_permissions`, no `content_scripts`. Permissions are `storage` and `sidePanel` only.
- It never opens, navigates or closes a tab, and cannot read the page beside it, including Oracle.

## Network access: one address, one call
- `manifest.json` sets `connect-src` to a single origin, fixed at build time. Chrome blocks every other address.
- The code contains exactly one network call: a GET of `/api/content` when the panel opens or the person presses
  "Check for updates". The build fails if there is any other call, or any other address in the bundle.
- The only thing sent is a shared access code. No user id, no login, no cookies, nothing about what the person
  is doing, and nothing from any page. Progress, results, ratings and call notes never leave the device.

## What comes back, and how it is handled
A JSON pack of guides, contacts, rubrics and job-aid text. Before it is stored or used, every item is checked
against the same schemas the build uses; a guide that names a website or carries on-page targets is rejected;
anything that fails is dropped, and if nothing usable is left the guide keeps what it had. Downloaded content is
only ever shown as text. It is never run as code, and the content security policy would block that anyway.
New content takes effect between guides, never part-way through one.

The last good download is kept in `chrome.storage.local` (`cm.content`), so the guide works without a connection.

## What this changes about trust
With the offline build, what people are told to do is fixed in a file IT has reviewed. With this build, whoever
can publish to the content server can change those instructions for everyone, at once. So the controls that
matter are on the server: who can deploy to it, review of changes before they go live, and the access code.
The pack is not cryptographically signed; the browser's HTTPS check on the fixed address is what vouches for it.

## Known limits
- The access code is shared, not per person, and gates read access to internal procedures. Rotate it by changing
  the server setting.
- Loaded unpacked, the extension is unsigned and can be altered by anyone who can edit the folder.

## How to verify
1. Read `manifest.json`: two permissions, no host permissions, no content scripts, one origin in `connect-src`.
2. Right-click the side panel > Inspect > Network. Open the panel: one GET to `/api/content`. Nothing else.
3. In the console run `fetch("https://example.com")`: refused by the content security policy.
