# Coachmark: HCM Academy Coach

A Chrome extension that coaches a learner through a real work process from start to finish: the screen
steps, the people to tell, the local rules, and the conversations. The learner does the work. The coach
never does it for them.

This repo holds **Phase 1 (Offline mode)**: the Vanderbilt-branded coach extension, a practice app modelled on Oracle Cloud HCM (fictional people, no Oracle assets), and two lessons.

| Folder | What it is |
|---|---|
| `extension/` | Chrome MV3 extension (side panel coach, content script, service worker). Built with esbuild |
| `web/` | Next.js practice app, plus the lesson, contacts and rubric files the extension bundles |
| `shared/` | JSON schemas for lessons, contacts and rubrics, and shared TypeScript types |
| `scripts/` | Content validator, end-to-end checks, demo video script |

## Two builds from one codebase

| | Guide (`npm run build:guide`) | Coach (`npm run build:ext`) |
|---|---|---|
| For | Real work, beside Oracle | Practice, on the practice app |
| Output folder | `extension/dist-guide` | `extension/dist` |
| Sees the page | No. No site access, no page script | Yes, on the practice sites only |
| Steps advance | The person presses Done | Automatically, when the action is done |
| Content | `web/guides/*.json` | `web/lessons/*.json` |

To use the guide: `npm run build:guide`, load `extension/dist-guide` in `chrome://extensions` (Load unpacked),
open Oracle, click the Coachmark icon, pick the process. Checks: `npm run test:guide`.

A guide file is a lesson file without a site, targets or success checks. Screen steps carry `where`
(where to look) and `expect` (what you see when it worked) instead.

## Live content: update guides without a new extension file

`npm run build:guide-live` builds `extension/dist-guide-live`. It is the guide, plus one thing: it downloads its
guides, contacts, rubrics and job aids from `/api/content` on the practice app's server. No AI, no cost per use.

To publish an update:
1. Edit or add files in `web/guides/`, `web/contacts/`, `web/rubrics/` or `web/knowledge/`.
2. `npm run knowledge` (packs them for the server) and `npm run validate`.
3. Commit, push, and deploy the site. Installed guides pick it up the next time the panel opens.

People enter an access code once (the server setting `COACHMARK_ACCESS_CODE`, or `COACHMARK_ASK_CODE` if that is
the one set). Every download is checked against the schemas before use, new content takes effect between guides,
and the last download is kept so the guide works with no connection. A change to the extension itself (new
features, layout) still needs a new extension file. Checks: `npm run test:live`. See
`extension/SECURITY-GUIDE-LIVE.md`.

## Ask: AI chat about HCM processes (optional, guide only)

`npm run build:guide-ask` builds `extension/dist-guide-ask`: the guide plus an Ask view. A person types a
question and gets an answer written by Claude from the job aids in `web/knowledge/`. It is told to answer only
questions about HCM functions and processes and to decline everything else.

- The extension still cannot see any page. Its one network call goes to `/api/ask` on the practice app's server,
  the only address its security policy allows. The plain guide build is unchanged and has no network code.
- The server (`web/app/api/ask/`) holds the Anthropic API key and needs two settings in Vercel:
  `ANTHROPIC_API_KEY` and `COACHMARK_ASK_CODE` (the access code people type once). Optional:
  `COACHMARK_ASK_MODEL` (default `claude-sonnet-5-5`).
- To change what it knows: edit or add a file in `web/knowledge/`, run `npm run knowledge`, redeploy.
- Checks: `npm run test:ask`. They use a stand-in for the model API, so they prove the plumbing and limits, not
  answer quality. See `extension/SECURITY-GUIDE-ASK.md`.

## Adding a process recorded with Spark

Spark, the recording app, lives in its own repository (`me5231979/productlearning-`). Its **Guide file** export is a draft
guide in the format `web/guides` expects. Review it, add rules, contacts and any off-screen steps, save it in
`web/guides/`, run `npm run knowledge && npm run validate`, and deploy. Installed guides with an access code pick it up.

## Try it without running anything

The practice app is online at https://hcm-academy-practice.vercel.app. Build the extension (below), load it in
Chrome, and Start lesson opens that site. If a `localhost:3000` tab is already open, the coach uses that instead.

## Run it

```bash
npm install
npm run dev:web        # practice app on http://localhost:3000  (leave running)
npm run build:ext      # builds extension/dist  (COACHMARK_MODE defaults to offline)
```

Load the extension in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Choose **Load unpacked** and select the `extension/dist` folder.
3. Pin **Coachmark** from the puzzle-piece menu, then click its icon. The coach opens in the side panel.
4. Pick a lesson, choose a department if asked, and press **Start lesson**. The practice app opens in a tab.

After changing a lesson or any code: `npm run build:ext`, then press the reload arrow on the Coachmark card
in `chrome://extensions`.

## Lessons

| Lesson | Practice app | Source |
|---|---|---|
| Change an Employee's Manager (HCM Academy · Assignment Changes) | `/practice/workforce` | HCM job aid "Change Employee Manager in Oracle Cloud" (updated 3/2/26). Off-screen steps are a draft for SME review |
| Submit a Time Off Request (Practice) | `/practice/time-off` | Sample lesson from the build spec. Exercises every step type |

A new course is a new lesson file, not new code:

1. Add `web/lessons/<id>.json` (and contacts in `web/contacts/`, rubrics in `web/rubrics/`).
2. `npm run validate` checks every file against the schemas and cross-checks contact, rubric and step references.
3. `npm run build:ext` bundles it and regenerates host permissions from the lessons' `allowedDomains`.

## Checks

```bash
npm run validate       # schemas + cross-references
npm run build:ext      # also fails if any network API appears in the extension source or bundle
npm run test:e2e       # Phase 1 "done when" checks in Chromium, against the practice app
```

## Offline mode guarantees

No network access at all: `connect-src 'none'`, no network APIs in the code (enforced at build), all content,
fonts and images bundled. Progress, results and call notes stay in `chrome.storage.local`. See
[`extension/SECURITY.md`](extension/SECURITY.md) for the IT reviewer one-pager.
