// Requests that run with the real model against a repo pinned to a commit, so results stay comparable while
// the repo moves on. twd-story is public and has a design/DESIGN.md with a "Where things are" section.

export const REPO = { repo: 'BRIKEV/twd-story', ref: 'cedfe6e247cf906bd69aa631699b7449d7aa213c' };

export type EvalCase = {
  id: string;
  /** change: a new version is expected. question: an answer, no new version. */
  kind: 'change' | 'question';
  request: string;
};

export const CASES: EvalCase[] = [
  { id: 'coupon', kind: 'change', request: 'On the shop, add a coupon code field to the checkout form' },
  { id: 'wishlist', kind: 'change', request: 'A wishlist where people save products from the shop and can move them to the cart' },
  { id: 'todo-filter', kind: 'change', request: 'On the todo board, add a filter to show all, active or done todos' },
  { id: 'question', kind: 'question', request: 'What fields does the checkout form ask for today?' },
];
