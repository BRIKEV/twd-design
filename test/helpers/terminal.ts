/**
 * A terminal where the person's answers are scripted. An empty answer means "accept the default".
 * An answer can be a function, for what the person does before answering (e.g. install the App).
 */
export function scriptedTerminal(answers: (string | (() => string | Promise<string>))[]) {
  const queue = [...answers];
  const output: string[] = [];
  return {
    ask: async (question: string, fallback?: string) => {
      output.push(`? ${question}${fallback ? ` (${fallback})` : ''}`);
      if (!queue.length) throw new Error(`Unexpected question: ${question}`);
      const next = queue.shift()!;
      const answer = typeof next === 'function' ? await next() : next;
      return answer === '' && fallback !== undefined ? fallback : answer;
    },
    say: (text: string) => { output.push(text); },
    output: () => output.join('\n'),
    /** Waits until the program prints something matching, and returns the match. */
    waitFor: async (pattern: RegExp) => {
      for (let i = 0; i < 200; i++) {
        const m = output.join('\n').match(pattern);
        if (m) return m;
        await new Promise((r) => setTimeout(r, 10));
      }
      throw new Error(`Never printed ${pattern}. Output so far:\n${output.join('\n')}`);
    },
    unanswered: () => queue.length,
  };
}
