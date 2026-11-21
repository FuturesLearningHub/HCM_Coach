# HCM Coach

A Chrome extension that coaches a learner through a real work process from start to finish: the screen
steps, the people to tell, the local rules, and the conversations. The learner does the work. The coach
never does it for them.

This repo holds **Phase 1 (Offline mode)**: the Vanderbilt-branded coach extension, a practice app modelled on Oracle Cloud HCM (fictional people, no Oracle assets), and two lessons.

| Folder | What it is |
|---|---|
| `extension/` | Chrome MV3 extension (side panel coach, content script, service worker). Built with esbuild |
| `web/` | Next.js practice app, plus the lesson, contacts and rubric files the extension bundles |
| `shared/` | JSON schemas for lessons, contacts and rubrics, and shared TypeScript types |
| `scripts/` | Content validator, end-to-end checks, demo video script (`node scripts/demo-video.mjs`) |
| `demo/` | The demo video, its narration and music (`demo/audio`), and the title and closing motion backgrounds (`demo/motion`, made in Runway) |

## The HCM Coach app (what people install)

`downloads/hcm-coach-0.5.0.zip` is the one app to hand out: the coach, a **Help** chat, and **live updates**.

- **The coach** walks her through a process in four support levels, per step: **Guide** (shows the step, where to look,
  why and the rule; after she does it, she answers a how and a why check), **Prompt** (she says what comes next), **On call** (quiet unless asked) and **Off**.
  Two right in a row moves a step down a level, a miss moves it back up, and she can ask for less help any time.
  A meter on each step and on each process shows where she stands. At the end she says back what she did.
  The rules live in `extension/src/lib/coach.ts`; the app keeps the count, never the AI.
- **The AI** (`web/app/api/coach/route.ts`) explains a step, answers a question, comments on her "why" and checks
  her say-back, using only the verified process. Set `AI_API_KEY` in the Vercel project `hcm-coach`: a Vanderbilt Amplify key (`amp-v1-...`, sent to Amplify's
  `/chat` API at `AMPLIFY_API_URL`, default https://prod-api.vanderbilt.ai; model from `AMPLIFY_MODEL` or a Claude Sonnet
  model the key can use) or an Anthropic key. Check the Amplify path with `node scripts/check-amplify.mjs`. Without it
  the coach works, and the AI buttons say it is not set up.
- **Ask** is a pop-up chat on every screen. With the access code, the AI answers in real time from the guides and
  job aids in the app only, names its source, and says "Not in HCM Coach" for anything else. Without the code it
  quotes the guides locally.
- **Training record (everyone)**: on first launch she enters her name, work email and the access code. After each
  finished process, each step's level and right/miss go to `/api/progress` (private Vercel Blob store
  `hcm-coach-progress`, one record per work email). The dashboard, with charts, is at
  https://hcm-coach.vercel.app/progress and needs `PROGRESS_ADMIN_CODE` (a Secret in Vercel). Records are kept
  12 months. Sample: `node scripts/progress-sample.mjs` (fictional learners) writes `demo/progress-sample/`.
- **The tour**: a one-minute narrated video (Bella, ElevenLabs, with music) plays on first launch and can be
  replayed from the process list. Rebuild it with `node scripts/tour-shots.mjs` then `node scripts/tour-video.mjs`
  (sources in `demo/tour`; output `extension/assets/tour.webm` and `demo/tour/hcm-coach-tour.mp4`).
- **Live updates** download new and changed guides from https://hcm-coach.vercel.app. People enter the access
  code once, under Guide content at the bottom of the process list.
- **Writing steps:** short and in a coach's voice. One instruction, one line of why, one thing to watch for.
  Add a `check` to a step for the quick check; without one, the coach asks "what should you see now?".
- Build it: `npm run build:app` (output `extension/dist-guide-live`). Check it: `npm run test:app`.
- It cannot see any page. Its two network calls are `/api/content` and `/api/coach`, on that one address. See
  `extension/SECURITY-APP.md`, which ships inside the zip as `SECURITY.md`.
- Server setting in the Vercel project `hcm-coach`: the access code (`HCM_COACH_ACCESS_CODE`; the older
  `HCM_COACH_ASK_CODE` and `COACHMARK_*` names still work).

The sections below describe each part on its own, and the practice coach.

## Two builds from one codebase

| | Guide (`npm run build:guide`) | Coach (`npm run build:ext`) |
|---|---|---|
| For | Real work, beside Oracle | Practice, on the practice app |
| Output folder | `extension/dist-guide` | `extension/dist` |
| Sees the page | No. No site access, no page script | Yes, on the practice sites only |
| Steps advance | The person presses Done | Automatically, when the action is done |
| Content | `web/guides/*.json` | `web/lessons/*.json` |

To use the guide: `npm run build:guide`, load `extension/dist-guide` in `chrome://extensions` (Load unpacked),
open Oracle, click the HCM Coach icon, pick the process. Checks: `npm run test:guide`.

A guide file is a lesson file without a site, targets or success checks. Screen steps carry `where`
(where to look) and `expect` (what you see when it worked) instead.

## Live content: update guides without a new extension file

`npm run build:app` builds `extension/dist-guide-live`. It is the guide, plus one thing: it downloads its
guides, contacts, rubrics and job aids from `/api/content`, and asks the coach at `/api/coach`, on the HCM Coach server.

To publish an update:
1. Edit or add files in `web/guides/`, `web/contacts/`, `web/rubrics/` or `web/knowledge/`.
2. `npm run knowledge` (packs them for the server) and `npm run validate`.
3. Commit, push, and deploy the site. Installed guides pick it up the next time the panel opens.

People enter an access code once (the server setting `HCM_COACH_ACCESS_CODE`, or `HCM_COACH_ASK_CODE` if that is
the one set). Every download is checked against the schemas before use, new content takes effect between guides,
and the last download is kept so the guide works with no connection. A change to the extension itself (new
features, layout) still needs a new extension file. Checks: `npm run test:live`. See
`extension/SECURITY-APP.md`.

Renamed from Coachmark: the server still accepts the old `COACHMARK_*` settings and the old `x-coachmark-code`
header, so guides installed before the rename keep working. Rename the Vercel settings to `HCM_COACH_*` when convenient.

## Adding a process recorded with Spark

Spark, the recording app, lives in its own repository (`me5231979/productlearning-`). Its **Guide file** export is a draft
guide in the format `web/guides` expects. Review it, add rules, contacts and any off-screen steps, save it in
`web/guides/`, run `npm run knowledge && npm run validate`, and deploy. Installed guides with an access code pick it up.

## Try it without running anything

The practice app is online at https://hcm-coach.vercel.app. Build the extension (below), load it in
Chrome, and Start lesson opens that site. If a `localhost:3000` tab is already open, the coach uses that instead.

## Run it

```bash
npm install
npm run dev:web        # practice app on http://localhost:3000  (leave running)
npm run build:ext      # builds extension/dist  (HCM_COACH_MODE defaults to offline)
```

Load the extension in Chrome:

1. Open `chrome://extensions` and turn on **Developer mode** (top right).
2. Choose **Load unpacked** and select the `extension/dist` folder.
3. Pin **HCM Coach** from the puzzle-piece menu, then click its icon. The coach opens in the side panel.
4. Pick a lesson, choose a department if asked, and press **Start lesson**. The practice app opens in a tab.

After changing a lesson or any code: `npm run build:ext`, then press the reload arrow on the HCM Coach card
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
