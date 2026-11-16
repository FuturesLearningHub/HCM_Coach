// Shared types for lesson, contacts and rubric files. Mirrors the JSON schemas in this folder.

export type Target = { role?: string; text?: string; label?: string; testId?: string; selector?: string };

export type Check =
  | { type: "urlMatches"; pattern: string }
  | { type: "elementVisible"; selector?: string; role?: string; text?: string }
  | { type: "textPresent"; text: string }
  | { type: "fieldValue"; label?: string; selector?: string; equals?: string; notEmpty?: true }
  | { type: "all" | "any"; checks: Check[] };

export type FieldCondition = { label?: string; selector?: string; equals?: string; notEmpty?: true };

type StepBase = {
  id: string;
  title?: string;
  instruction: string;
  why?: string;
  departments?: string[];
  contactRef?: string;
  note?: string;
};

export type ScreenStep = StepBase & {
  type: "screen";
  /** Watched lessons need target and success. Guide lessons use where and expect instead. */
  target?: Target;
  success?: Check;
  where?: string;
  expect?: string;
  hints?: string[];
  commonMistakes?: { when: { clickedText: string }; say: string }[];
};
export type OfflineStep = StepBase & {
  type: "offline";
  confirm: string;
  allowSkip?: { label: string; logAs?: string };
};
export type CheckpointStep = StepBase & { type: "checkpoint"; confirm: string };
export type CallStep = StepBase & {
  type: "call";
  prep: { goal: string; opener: string; pushbacks?: { if: string; try: string }[]; doThis?: string[] };
  rehearse?: { enabled?: boolean; scenarioId?: string };
  debrief: { rubricRef: string };
};
export type Step = ScreenStep | OfflineStep | CheckpointStep | CallStep;

export type Callout = {
  id: string;
  kind: "rule" | "tip" | "warning";
  say: string;
  source?: string;
  repeat?: boolean;
  when: { step?: string; afterStep?: string; department?: string; urlMatches?: string; fieldValue?: FieldCondition };
};

export type Reminder = { id: string; afterStep: string; delay: string; say: string; contactRef?: string; openUrl?: string };

export type Lesson = {
  id: string;
  title: string;
  goal: string;
  audience?: string;
  org?: string;
  series?: string;
  estimatedMinutes?: number;
  allowedDomains?: string[];
  startUrl?: string;
  departments: string[];
  context?: string;
  ai?: { liveCoach?: boolean; debriefFeedback?: boolean };
  redactSelectors?: string[];
  steps: Step[];
  callouts?: Callout[];
  reminders?: Reminder[];
  recap: { summary: string; nextSteps?: string[] };
};

export type Contact = { id: string; department: string; name: string | null; role: string; how: string };
export type ContactsDirectory = { org: string; updated: string; owner?: string; contacts: Contact[] };

export type RubricItem = { id: string; prompt: string; tip: string; keepDoing?: string };
export type Rubric = { id: string; title: string; items: RubricItem[] };
