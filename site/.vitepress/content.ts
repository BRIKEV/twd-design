// Copy used both by the page and by its structured data (config.mts), so search engines read
// exactly what people read.

export const SITE = 'https://design.twd.dev'
export const REPO = 'https://github.com/BRIKEV/twd-design'
export const DOCS = `${REPO}/tree/main/docs`
export const INSTALL = `${REPO}#install-about-15-minutes`

export const TITLE = 'TWD Design: from a Slack thread to a prototype your team can click'
export const DESCRIPTION =
  'Describe a screen in Slack and get a clickable prototype in your design system. Change it by replying, approve it, and developers get a pull request with the acceptance criteria already written. Open source and self-hosted.'

export const FAQ: { q: string; a: string }[] = [
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
    a: 'It runs on your company servers with your own Slack app, GitHub App and AI key. Nothing is stored: the Slack thread is the only history. It reads one file from your repo, the design guide, and sends it with the thread to the AI provider your company chose.',
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
