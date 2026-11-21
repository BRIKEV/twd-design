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
  titleTemplate: false,
  description: DESCRIPTION,
  cleanUrls: true,
  // One page, its own look: no VitePress default theme (see theme/index.ts).
  appearance: false,
  sitemap: { hostname: SITE },
  head: [
    ['link', { rel: 'icon', href: '/favicon.ico', sizes: '48x48' }],
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' }],
    ['link', { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'canonical', href: `${SITE}/` }],
    ['meta', { name: 'theme-color', content: '#123956' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.googleapis.com' }],
    ['link', { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' }],
    ['link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap' }],

    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'TWD' }],
    ['meta', { property: 'og:url', content: `${SITE}/` }],
    ['meta', { property: 'og:title', content: 'TWD Design: describe a screen, get a prototype your team can click' }],
    ['meta', { property: 'og:description', content: 'Ask in a Slack thread and get a working prototype in your design system. Change it by replying, approve it, and developers get a pull request. Open source and self-hosted.' }],
    ['meta', { property: 'og:image', content: OG_IMAGE }],
    ['meta', { property: 'og:image:width', content: '1200' }],
    ['meta', { property: 'og:image:height', content: '630' }],
    ['meta', { property: 'og:image:alt', content: OG_ALT }],
    ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ['meta', { name: 'twitter:title', content: 'TWD Design: describe a screen, get a prototype your team can click' }],
    ['meta', { name: 'twitter:description', content: 'Ask in a Slack thread and get a working prototype in your design system. Approve it, and developers get a pull request.' }],
    ['meta', { name: 'twitter:image', content: OG_IMAGE }],
    ['meta', { name: 'twitter:image:alt', content: OG_ALT }],

    ['script', { type: 'application/ld+json' }, JSON.stringify(softwareLd)],
    ['script', { type: 'application/ld+json' }, JSON.stringify(faqLd)],
  ],
  transformPageData(page) {
    if (page.relativePath === 'index.md') page.title = TITLE
  },
})
