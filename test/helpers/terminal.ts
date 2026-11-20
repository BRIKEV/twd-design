/** A terminal where the person's answers are scripted. An empty answer means "accept the default". */
export function scriptedTerminal(answers: string[]) {
  const queue = [...answers];
  const output: string[] = [];
  return {
    ask: async (question: string, fallback?: string) => {
      output.push(`? ${question}${fallback ? ` (${fallback})` : ''}`);
      if (!queue.length) throw new Error(`Unexpected question: ${question}`);
      const answer = queue.shift()!;
      return answer === '' && fallback !== undefined ? fallback : answer;
    },
    say: (text: string) => { output.push(text); },
    output: () => output.join('\n'),
    unanswered: () => queue.length,
  };
}
