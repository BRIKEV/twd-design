import type { Theme } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Layout from './Layout.vue'
import './style.css'
import './docs.css'

// The landing page has a look of its own (Landing.vue, style.css scoped to .landing); the docs under
// /docs use VitePress's default theme with TWD colors (docs.css). Both are prerendered to static HTML.
export default { extends: DefaultTheme, Layout } satisfies Theme
