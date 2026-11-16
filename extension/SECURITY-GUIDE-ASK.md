# HCM Coach Guide with Ask: security one-pager

For IT reviewers. This is the guide build with one addition: an Ask view where a person can type a question
about an HCM process and get an answer written by an AI model. Everything else matches the plain guide build.

## It still cannot see or touch any web page
- No `host_permissions`, no `content_scripts`. Permissions are `storage` and `sidePanel` only.
- It never opens, navigates or closes a tab, and cannot read the page beside it, including Oracle.

## Network access: one address, one call
- `manifest.json` sets `connect-src` to a single origin, fixed at build time. Chrome blocks every other address.
- The code contains exactly one network call, in the Ask view. The build fails if there is any other, or if any
  other address appears in the bundle.
- The call is made only when the person presses Ask. Nothing is sent in the background.

## What is sent, and where
| Sent | Not sent |
|---|---|
| The question the person typed (500 characters at most) | Anything from Oracle or any web page |
| Up to the last six turns of the same chat | Progress, results, ratings, call notes |
| The title of the guide and step that is open | Who the person is: no login, no user id, no cookies |
| A shared access code | |

It goes to the HCM Coach Ask service (the origin in `connect-src`), which adds the HCM job aids as reference
material and sends the request to Anthropic's Claude API. The service strips email addresses, phone numbers and
long digit runs from the text first, but that is a backstop: people are told not to type personal details.
The Anthropic API key is held by the service. It is not in this extension.

The service does not log or store questions or answers. Anthropic's handling of API data is governed by the
organization's agreement with Anthropic; confirm retention terms there.

## Scope
The model is instructed to answer only questions about HCM functions and processes, from the job aids supplied,
and to decline everything else. This is an instruction to a language model, not a hard technical barrier: expect
it to hold in normal use, and do not treat it as a security control. Answers can be wrong and say so in the panel.

## What it stores
Same as the guide build, plus the access code and the Ask acknowledgement in `cm.prefs`.
The chat itself is held in memory only and is gone when the panel closes.

## Known limits
- The access code is shared, not per person. Anyone who has it and the service address can ask questions and
  spend the organization's API budget. Rotate it by changing the server setting. Rate limits on the service are
  best-effort.
- Loaded unpacked, the extension is unsigned and can be altered by anyone who can edit the folder.

## How to verify
1. Read `manifest.json`: two permissions, no host permissions, no content scripts, one origin in `connect-src`.
2. Right-click the side panel > Inspect > Network. Ask a question: one POST to `/api/ask`. Nothing else, ever.
3. In the console run `fetch("https://example.com")`: refused by the content security policy.
