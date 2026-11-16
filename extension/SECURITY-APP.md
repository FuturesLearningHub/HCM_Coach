# HCM Coach: security one-pager

For IT reviewers. This is the full HCM Coach app: the step-by-step guide, plus two connected features.
**Live updates** download guides, contacts and job aids from one server, so content changes without
reinstalling. **Ask** lets a person type a question about an HCM process and get an answer written by an AI model.
Both talk to the same single server, the HCM Coach service.

## It still cannot see or touch any web page
- No `host_permissions`, no `content_scripts`. Permissions are `storage` and `sidePanel` only.
- It never opens, navigates or closes a tab, and cannot read the page beside it, including Oracle.

## Network access: one address, two calls
- `manifest.json` sets `connect-src` to a single origin, fixed at build time. Chrome blocks every other address.
- The code contains exactly two network calls. The build fails if there is any other, or any other address in
  the bundle:
  1. A GET of `/api/content` when the panel opens or the person presses "Check for updates". It sends only the
     shared access code.
  2. A POST to `/api/ask`, made only when the person presses Ask. Nothing is sent in the background.

## What is sent, and where
| Sent | Never sent |
|---|---|
| A shared access code (both calls) | Anything from Oracle or any web page |
| Ask only: the question typed (500 characters at most) | Progress, results, ratings, call notes |
| Ask only: up to the last six turns of the same chat | Who the person is: no login, no user id, no cookies |
| Ask only: the title of the guide and step that is open | |

Ask questions go to the HCM Coach service, which adds the HCM job aids as reference material and sends the
request to Anthropic's Claude API. The service strips email addresses, phone numbers and long digit runs from the
text first, but that is a backstop: people are told not to type personal details. The Anthropic API key is held
by the service, not the extension. The service does not log or store questions or answers. Anthropic's handling
of API data is governed by the organization's agreement with Anthropic; confirm retention terms there.

## Downloaded content, and how it is handled
A JSON pack of guides, contacts, rubrics and job-aid text. Before it is stored or used, every item is checked
against the same schemas the build uses; a guide that names a website or carries on-page targets is rejected;
anything that fails is dropped, and if nothing usable is left the guide keeps what it had. Downloaded content is
only ever shown as text, never run as code. New content takes effect between guides, never part-way through one.
The last good download is kept in `chrome.storage.local` (`cm.content`), so the guide works without a connection.

## What this changes about trust
- Whoever can publish to the HCM Coach service can change the instructions people follow, for everyone at once.
  The controls that matter are on the server: who can deploy, review of changes before they go live, and the
  access code. The pack is not signed; the browser's HTTPS check on the fixed address vouches for it.
- Ask is instructed to answer only questions about HCM functions and processes, from the job aids supplied, and
  to decline everything else. That is an instruction to a language model, not a security control. Answers can be
  wrong, and the panel says so.

## What it stores
Progress, results, ratings and call notes, in this browser only. Plus the access code and the Ask
acknowledgement in `cm.prefs`, and the last content download in `cm.content`. The Ask chat is held in memory only
and is gone when the panel closes.

## Known limits
- The access code is shared, not per person. It gates read access to internal procedures and use of the
  organization's AI budget. Rotate it by changing the server setting. Rate limits are best-effort.
- Loaded unpacked, the extension is unsigned and can be altered by anyone who can edit the folder.

## How to verify
1. Read `manifest.json`: two permissions, no host permissions, no content scripts, one origin in `connect-src`.
2. Right-click the side panel > Inspect > Network. Open the panel: one GET to `/api/content`. Ask a question: one
   POST to `/api/ask`. Nothing else, ever.
3. In the console run `fetch("https://example.com")`: refused by the content security policy.
