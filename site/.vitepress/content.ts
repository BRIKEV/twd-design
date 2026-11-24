// Copy used both by the page and by its structured data (config.mts), so search engines read
// exactly what people read.

export const SITE = 'https://design.twd.dev'
export const REPO = 'https://github.com/BRIKEV/twd-design'
export const DOCS = '/docs/'
export const INSTALL = '/docs/#install-about-15-minutes'
export const COMPARE = '/why-not-v0-or-lovable'

export const TITLE = 'TWD Design: agree on the screen before anyone builds it'
export const DESCRIPTION =
  'A self-hosted Slack bot for product teams. Describe a screen and get a clickable prototype in your design system, with acceptance tests that already pass. When the team agrees, it opens a pull request. Open source, stores nothing, uses the AI your company approves.'

export const FAQ: { q: string; a: string }[] = [
  {
    q: 'How is this different from v0 or Lovable?',
    a: 'v0 and Lovable help one person build an app on their cloud. TWD Design helps product, design and development agree on a screen, on your own servers: it stores nothing, uses the AI your company already approves, follows your design system and ends in a pull request whose acceptance tests already pass.',
  },
  {
    q: 'Do I need to know how to code?',
    a: 'No. You write in Slack the way you would brief a designer, and you review the prototype by clicking through it. The code is for the developers who build the feature.',
  },
  {
    q: 'Will the prototypes look like our product?',
    a: 'Yes, once your repo has a design guide: a design/DESIGN.md file with your colors, type, components and tone. Paste the repo link in the thread and every version follows it. Without a guide it uses a clean, neutral style.',
  },
  {
    q: 'Can we go back to an earlier version?',
    a: 'Yes. Every version stays in the thread, and the Back button makes an earlier one the current version again, without asking the AI to rebuild it.',
  },
  {
    q: 'Is our data safe?',
    a: 'It runs on your company servers with your own Slack app, GitHub App and AI key. Nothing is stored: the Slack thread is the only history. It reads your repo\'s design guide, and the code of a screen when you ask to change one, and sends them with the thread to the AI provider your company chose. It never changes your code.',
  },
  {
    q: 'What does it cost?',
    a: 'TWD Design is free and open source (MIT). The only cost is the AI model, paid directly to the provider your company already uses.',
  },
  {
    q: 'Which AI does it use?',
    a: 'The one you choose: Anthropic, OpenAI, Azure OpenAI, Google, Bedrock, Z.ai GLM or any other provider the Mastra model router supports.',
  },
  {
    q: 'What do developers need to set it up?',
    a: 'About 15 minutes and a server or container platform with 512 MB of memory. One command creates the Slack app and the GitHub App and checks the AI key; then it runs with Docker, Docker Compose, Kubernetes, Render, Fly.io or similar.',
  },
]
