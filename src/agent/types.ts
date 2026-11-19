export type ChatMessage = { role: 'user'; content: string } | { role: 'assistant'; content: string };

/** The prototype being worked on in this turn. Starts as the last .html the bot posted in the thread. */
export type PrototypeState = {
  filename: string;
  html: string | null;
  changed: boolean;
  /** Tool calls made this turn, for the logs (e.g. "write:16339", "edit:2", "pr:#6"). */
  calls: string[];
  pr?: { url: string; number: number; branch: string };
};

/** The repo linked in the thread and its design guide (null if the repo has none). */
export type DesignContext = { repo: string; guide: string | null } | null;

/** What the turn knows beyond the messages: the linked repo and where the thread lives. */
export type TurnContext = { design: DesignContext; threadUrl?: string };
