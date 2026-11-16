# HCM Coach Guide: security one-pager

For IT reviewers. Everything below can be checked in a few minutes with this folder and Chrome DevTools.

## What it is
A Chrome side panel that shows step-by-step guidance for a work process: what to do next, the local
rule that applies, who to tell. The person does the work in their own tab and presses Done on each step.

## It cannot see or touch any web page
- `manifest.json` has no `host_permissions` and no `content_scripts`. The extension has no way to read,
  change or even detect the page beside it, including Oracle.
- Permissions are `storage` and `sidePanel`. Nothing else. No `tabs`, `activeTab`, `scripting`,
  `webRequest` or `cookies`.
- It never opens, navigates or closes a tab.

## Network access: none
- `connect-src 'none'` applies to the side panel and the service worker, enforced by Chrome.
- The code contains no `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `EventSource` or remote
  scripts. The build fails if any appear in the source or the bundle.
- No analytics or error reporting. No `externally_connectable`. Fonts and images are bundled.
- Guides, contacts, rubrics and the job aids used by Search ship inside this folder. Updating one means a new build.
- Search runs inside the extension over those bundled job aids. What a person types into it is not stored or sent.

## What it stores (all in `chrome.storage.local`, never synced, not encrypted)
| Key | Contents |
|---|---|
| `cm.run` | The guide in progress: current step, hints used, an event log of step ids |
| `cm.history` | One summary line per completed guide |
| `cm.callLog` | The person's own call notes and self-ratings |
| `cm.prefs` | First-run acknowledgement and chosen department |

None of it comes from a web page. It is what the person pressed or typed in the side panel.
Results leave the device only if the person presses Export. Result exports do not include call notes.
Anyone with access to this Chrome profile on this computer can read the stored data.

## Known limits
- Loaded unpacked, the extension is unsigned and anyone who can edit the folder can change it. For more
  than a few pilot users, install a pinned version through Chrome enterprise policy.
- The guidance is only as correct as the guide files. Each guide names its source and what is still draft.

## How to verify
1. Read `manifest.json`: two permissions, no host permissions, no content scripts.
2. `chrome://extensions` > HCM Coach Guide > "service worker" > Network tab: stays empty.
3. Right-click the side panel > Inspect > Network tab: only `chrome-extension://` files load.
4. In either console run `fetch("https://example.com")`: refused by the content security policy.
5. Search the code: `grep -rnE "fetch\(|XMLHttpRequest|WebSocket|sendBeacon" --include=*.js --include=*.html --include=*.css .` returns nothing.

## How to remove it
`chrome://extensions` > HCM Coach Guide > Remove. This deletes the extension and everything it stored.
