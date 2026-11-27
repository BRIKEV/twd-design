export type ChatMessage = { role: 'user'; content: string } | { role: 'assistant'; content: string };

/** The prototype being worked on in this turn. Starts as the last .html the bot posted in the thread. */
export type PrototypeState = {
  filename: string;
  html: string | null;
  changed: boolean;
  /** Tool calls made this turn, for the logs (e.g. "write:16339", "edit:2", "pr:#6"). */
  calls: string[];
  pr?: { url: string; number: number; branch: string };
  /** The scenarios and page contract planned this turn (plan_scenarios), before the page is written. */
  plan?: { code: string; contract: string };
  /** Repo files read this turn, so a later step of the same turn sees them without reading again. */
  reads?: { path: string; content: string }[];
};

/**
 * The repo linked in the thread and its design guide (null if the repo has none). `ref` pins the code
 * reads to a commit; only the evals set it, so their results stay comparable while the repo moves on.
 */
export type DesignContext = { repo: string; guide: string | null; ref?: string } | null;

/**
 * What the turn knows beyond the messages: the linked repo, where the thread lives, and whether someone
 * pressed Approve (the only way a pull request gets opened).
 */
export type TurnContext = { design: DesignContext; threadUrl?: string; approved?: boolean; issue?: number | null };
