# HCM Coach (Offline build): security one-pager

For IT reviewers. Everything below can be checked in a few minutes with this folder and Chrome DevTools.

## What it is
A Chrome side-panel coach that walks a learner through a practice process step by step.
It highlights where to act, checks that a step was done, and shows pre-written hints, rules and contacts.
It never clicks, types or submits for the learner.

## Network access: none
- `manifest.json` sets `connect-src 'none'` for all extension pages and the service worker.
- The code contains no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` or remote scripts.
  The build fails if any of these appear in the source or the bundle.
- No analytics, telemetry or error-reporting SDKs. No `externally_connectable`. No remote fonts or images.
- All lessons, contacts, rubrics, fonts and images ship inside this folder. Updating a lesson means a new build.

## Permissions
| Permission | Why |
|---|---|
| `storage` | Save progress, results and call notes in `chrome.storage.local` on this device |
| `sidePanel` | Show the coach beside the page |
| `host_permissions` | Only the exact sites listed in the bundled lessons' `allowedDomains` (see `manifest.json`). Wildcards fail the build |

That is the whole list. No `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, `alarms` or `notifications`.

## What it reads
Only on the host-permission sites, and only while a lesson is running in that tab:
- which buttons, links and labelled fields are on the page, to find and highlight the next target
- whether a field has the expected value, compared inside the page and reduced to yes or no
- which element was clicked, to notice a wrong turn

Field values and page text never leave the content script. It passes step ids and true/false to the coach.
Outside a running lesson, and on every other site, the content script does nothing.

## What it stores (all in `chrome.storage.local`, never synced)
| Key | Contents |
|---|---|
| `cm.run` | The lesson in progress: step, hints used, timings, event log (no page content) |
| `cm.history` | One summary line per completed lesson |
| `cm.callLog` | The learner's own call notes and self-ratings |
| `cm.prefs` | First-run acknowledgement and chosen department |

Storage is closed to content scripts (`setAccessLevel: TRUSTED_CONTEXTS`). Code running in a web page's
process cannot read any of it. The background worker sends the lesson tab only the id of the step to watch.
Coach commands are accepted only from the extension's own pages; messages from anywhere else are dropped.

Stored data is not encrypted. Anyone with access to this Chrome profile on this computer can read it.

Results leave the device only if the learner presses Export and shares the file themselves.
Result exports do not include call notes.

## Known limits
- For the side panel and service worker, Chrome enforces "no network" through the content security policy.
  For the content script, it rests on the build check that no network API is in the code. A modified copy
  of the folder would not be bound by that check.
- Loaded unpacked, the extension is unsigned and anyone who can edit the folder can change it. For more than
  a few pilot users, install a pinned version through Chrome enterprise policy.
- The content script can read the pages of the sites in `host_permissions`. Approve each host deliberately,
  above all any live HR system.

## How to verify
1. Read `manifest.json`: permissions, host permissions and the content security policy.
2. `chrome://extensions` > HCM Coach > "service worker" > Network tab: stays empty.
3. Open the side panel, right-click > Inspect > Network tab: only `chrome-extension://` files load.
4. In either console run `fetch("https://example.com")`: it is refused by the content security policy.
5. Search the code: `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon" --include=*.js --include=*.html --include=*.css .` returns nothing.

## How to remove it
`chrome://extensions` > HCM Coach > Remove. This deletes the extension and everything it stored.
