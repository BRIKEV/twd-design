import type { Theme } from 'vitepress'
import Layout from './Layout.vue'
import './style.css'

// A theme of its own instead of VitePress's default one: the site is a single landing page.
// VitePress still prerenders it to static HTML, which is what search engines and link previews read.
export default { Layout } satisfies Theme
