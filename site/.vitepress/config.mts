import { defineConfig } from 'vitepress'
import { DESCRIPTION, FAQ, REPO, SITE, TITLE } from './content'

const OG_IMAGE = `${SITE}/og-image.png`
const OG_ALT = 'Describe a screen. Get a prototype your team can click. Next to it, a Slack thread where TWD Design answers a request with a prototype and an Approve and open PR button.'

const softwareLd = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'TWD Design',
  alternateName: 'Test While Designing',
  description: DESCRIPTION,
  url: SITE,
  applicationCategory: 'DeveloperApplication',
  operatingSystem: 'Docker, Linux',
  license: 'https://opensource.org/licenses/MIT',
  isAccessibleForFree: true,
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  codeRepository: REPO,
  isPartOf: { '@type': 'SoftwareApplication', name: 'TWD', url: 'https://twd.dev' },
  publisher: { '@type': 'Organization', name: 'BRIKEV', url: 'https://github.com/BRIKEV' },
}

const faqLd = {
  '@context': 'https://schema.org',
  '@type': 'FAQPage',
  mainEntity: FAQ.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
}

// https://vitepress.dev/reference/site-config
export default defineConfig({
  lang: 'en',
  title: 'TWD Design',
  titleTemplate: ':title · TWD Design',
  description: DESCRIPTION,
  cleanUrls: true,
  lastUpdated: true,
  sitemap: { hostname: SITE },
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#123956' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'TWD' }],
    ['meta', { property: 'og:image', content: OG_IMAGE }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: OG_ALT }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:image', content: OG_IMAGE }],
    ['meta', { name: 'twitter:image:alt', content: OG_ALT }],
  ],

  // Per page: its own canonical URL and preview text; the landing also carries the structured data.
  transformHead({ pageData }) {
    const path = pageData.relativePath.replace(/(^|\/)index\.md$/, '$1').replace(/\.md$/, '')
    const url = `${SITE}/${path}`
    const landing = pageData.relativePath === 'index.md'
    const title = landing ? 'TWD Design: describe a screen, get a prototype your team can click' : `${pageData.title} · TWD Design`
    const description = landing
      ? 'Ask in a Slack thread and get a working prototype in your design system. Change it by replying, approve it, and developers get a pull request. Open source and self-hosted.'
      : pageData.description || DESCRIPTION
    return [
      ['link', { rel: 'canonical', href: url }],
      ['meta', { property: 'og:url', content: url }],
      ['meta', { property: 'og:title', content: title }],
      ['meta', { property: 'og:description', content: description }],
      ['meta', { name: 'twitter:title', content: title }],
      ['meta', { name: 'twitter:description', content: description }],
      ...(landing
        ? ([
            ['script', { type: 'application/ld+json' }, JSON.stringify(softwareLd)],
            ['script', { type: 'application/ld+json' }, JSON.stringify(faqLd)],
          ] as const)
        : []),
    ] as any
  },
  transformPageData(page) {
    if (page.relativePath === 'index.md') {
      page.title = TITLE
      page.frontmatter.titleTemplate = false
    }
  },

  themeConfig: {
    logo: '/twd-design-icon.png',
    nav: [
      { text: 'Docs', link: '/docs/', activeMatch: '^/docs/(?!guides)' },
      { text: 'Guides', link: '/docs/guides/working-in-slack', activeMatch: '^/docs/guides/' },
      { text: 'Changelog', link: `${REPO}/blob/main/CHANGELOG.md` },
    ],
    sidebar: {
      '/docs/': [
        { text: 'Introduction', items: [{ text: 'What it is', link: '/docs/' }] },
        {
          text: 'Setup',
          items: [
            { text: 'Slack app', link: '/docs/setup/slack-app' },
            { text: 'GitHub App', link: '/docs/setup/github-app' },
            { text: 'Model', link: '/docs/setup/models' },
          ],
        },
        {
          text: 'Install',
          items: [
            { text: 'Render', link: '/docs/install/render' },
            { text: 'Docker', link: '/docs/install/docker' },
            { text: 'Docker Compose', link: '/docs/install/docker-compose' },
            { text: 'Fly.io, Railway, Kubernetes', link: '/docs/install/other-platforms' },
          ],
        },
        {
          text: 'Guides',
          items: [
            { text: 'Working in Slack', link: '/docs/guides/working-in-slack' },
            { text: 'Your design guide', link: '/docs/guides/design-md' },
          ],
        },
        {
          text: 'Reference',
          items: [
            { text: 'Configuration', link: '/docs/reference/configuration' },
            { text: 'Security and data', link: '/docs/reference/security' },
            { text: 'Observability', link: '/docs/reference/observability' },
            { text: 'Troubleshooting', link: '/docs/reference/troubleshooting' },
          ],
        },
      ],
    },
    search: { provider: 'local' },
    socialLinks: [{ icon: 'github', link: REPO }],
    editLink: { pattern: `${REPO}/edit/main/site/:path`, text: 'Edit this page on GitHub' },
    footer: { message: 'MIT License · Part of <a href="https://twd.dev">TWD</a>', copyright: 'BRIKEV' },
  },
})
