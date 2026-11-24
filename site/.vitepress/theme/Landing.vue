<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { COMPARE, DOCS, FAQ, INSTALL, REPO } from '../content'
import NotificationsDemo from './NotificationsDemo.vue'

const doc = (path: string) => `/docs/${path.replace(/\.md$/, '')}`

// The demo: as each step's text crosses the middle of the screen, the thread on the side moves on.
const STEPS = [
  {
    title: 'Describe it like you would to a designer',
    text: 'Mention @twd-design in any channel and say what you need. No templates, no prompts to learn. Not sure where to start? Say hi and it shows you examples.',
  },
  {
    title: 'A prototype, in about a minute',
    text: 'It answers in the thread with a clickable prototype that follows your design guide: your colors, your components, your tone. Each version comes with the checks that say when the feature is done, and they already pass.',
  },
  {
    title: 'Click through it without leaving Slack',
    text: 'Slack opens it as a page. Every screen of the flow works, with realistic data, so the team reviews the real thing instead of a static mockup. Go ahead: the switches work.',
  },
  {
    title: 'Change it by replying',
    text: '"And on mobile?" "Fewer columns." Each reply is a new version that keeps everything already agreed. Changed your mind? One click takes you back to any earlier version.',
  },
  {
    title: 'Approve it. Developers take it from there.',
    text: 'One click opens a pull request in your repo with the prototype, what was agreed and a link back to the conversation. Nothing gets lost in the handoff.',
  },
]

const ASKS = [
  'and on mobile?', 'add an empty state', 'fewer columns', 'show an error when the card is declined',
  'make the filters a side panel', 'a 3-step sign-up', 'what if there are 200 items?', 'use our primary button',
  'add a confirmation before deleting', 'move search to the top',
]

const step = ref(0)
const copied = ref(false)
let observers: IntersectionObserver[] = []

onMounted(() => {
  // Without JavaScript everything is visible; with it, sections fade in as they arrive.
  document.documentElement.classList.add('js')

  const steps = new IntersectionObserver(
    (entries) => {
      for (const e of entries) if (e.isIntersecting) step.value = Number((e.target as HTMLElement).dataset.step)
    },
    { rootMargin: '-45% 0px -45% 0px' },
  )
  document.querySelectorAll('[data-step]').forEach((el) => steps.observe(el))

  const reveal = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue
        e.target.classList.add('in')
        reveal.unobserve(e.target)
      }
    },
    { threshold: 0.15, rootMargin: '0px 0px -40px 0px' },
  )
  document.querySelectorAll('.reveal').forEach((el) => reveal.observe(el))
  observers = [steps, reveal]
})
onBeforeUnmount(() => observers.forEach((o) => o.disconnect()))

async function copyInstall() {
  try {
    await navigator.clipboard.writeText(new URL(INSTALL, window.location.href).href)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    window.location.href = INSTALL
  }
}
</script>

<template>
  <header class="top wrap">
    <a href="/" class="brand" aria-label="TWD Design home">
      <img src="/twd-design-icon.png" alt="" width="28" height="28" />
      <span>TWD <b>Design</b></span>
    </a>
    <nav aria-label="Main">
      <a href="#demo">How it works</a>
      <a href="#developers">For developers</a>
      <a href="#install">Install</a>
      <a :href="DOCS" class="docs">Docs</a>
      <a :href="REPO" class="gh">GitHub</a>
    </nav>
  </header>

  <main>
    <!-- Hero -->
    <section class="hero">
      <div class="wrap hero-in">
        <p class="eyebrow">Open source · Self-hosted · In your Slack</p>
        <h1>Agree on the screen<br /><span>before anyone builds it.</span></h1>
        <p class="lede">
          Product, design and development describe a screen in a Slack thread and get a clickable
          prototype in your design system, with acceptance tests that already pass. When the team agrees,
          it lands in your repo as a pull request. It runs on your servers, uses the AI your company
          already approves, and stores nothing.
        </p>
        <div class="ctas">
          <a class="btn primary" href="#demo">See it in action</a>
          <a class="btn" href="#install">Install it</a>
        </div>
      </div>
      <div class="asks" aria-hidden="true">
        <div class="asks-track">
          <span v-for="(a, i) in [...ASKS, ...ASKS]" :key="i">{{ a }}</span>
        </div>
      </div>
    </section>

    <!-- The demo: text on one side, the thread playing out on the other -->
    <section id="demo" class="demo wrap">
      <h2 class="reveal">One thread, from idea to pull request</h2>
      <div class="scrolly">
        <div class="stage" :data-at="step">
          <div class="slack">
            <div class="slack-head"><span># product-squad</span><span class="muted">Thread</span></div>
            <div class="slack-body">
              <div class="msg">
                <div class="avatar a1">S</div>
                <div>
                  <p class="who">Sabrina <time>10:42</time></p>
                  <p><span class="mention">@twd-design</span> notification settings: email and push per category, and quiet hours</p>
                </div>
              </div>
              <p class="working" v-show="step === 0"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span> TWD Design is working on it…</p>

              <div class="msg pop" v-show="step >= 1">
                <img class="avatar" src="/twd-design-icon.png" alt="" width="36" height="36" />
                <div>
                  <p class="who">TWD Design <span class="app">APP</span> <time>10:43</time></p>
                  <p>Here is a first version: three categories with email and push, and quiet hours that only show when they are on.</p>
                  <div class="file"><span class="file-icon">&lt;/&gt;</span><span><b>notification-settings.html</b><small>Opens as a page</small></span></div>
                  <p class="check">✅ <em>4 checks pass.</em></p>
                  <div class="buttons" v-if="step < 3"><span class="sbtn go">Approve and open PR</span><span class="sbtn">Pick repo</span></div>
                  <p class="context" v-else><b>v1</b> · replaced by v2</p>
                </div>
              </div>

              <div class="msg pop" v-show="step >= 3">
                <div class="avatar a2">B</div>
                <div>
                  <p class="who">Bruno <time>10:46</time></p>
                  <p>and on mobile?</p>
                </div>
              </div>
              <div class="msg pop" v-show="step >= 3">
                <img class="avatar" src="/twd-design-icon.png" alt="" width="36" height="36" />
                <div>
                  <p class="who">TWD Design <span class="app">APP</span> <time>10:47</time></p>
                  <p>v2: on a phone the buttons stack and everything fits without scrolling sideways. I added a check for it.</p>
                  <p class="check">✅ <em>5 checks pass.</em></p>
                  <div class="buttons" v-if="step < 4"><span class="sbtn go">Approve and open PR</span><span class="sbtn">Back to v1</span></div>
                  <p class="context" v-else>Approved by <b>Sabrina</b></p>
                </div>
              </div>

              <div class="msg pop" v-show="step >= 4">
                <img class="avatar" src="/twd-design-icon.png" alt="" width="36" height="36" />
                <div>
                  <p class="who">TWD Design <span class="app">APP</span> <time>10:49</time></p>
                  <div class="pr">
                    <p class="pr-title"><span class="pr-dot"></span>Notification settings prototype <span class="muted">#128</span></p>
                    <p class="pr-branch">acme/web · design/notification-settings → main</p>
                    <p class="pr-files"><span>+ index.html</span><span>+ intent.md</span></p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="window" aria-label="The prototype, open" v-show="step === 2">
            <div class="window-bar"><i></i><i></i><i></i><span>notification-settings.html</span></div>
            <div class="window-body">
              <NotificationsDemo />
              <aside class="checks" aria-label="Checks">
                <p class="checks-title">Checks <b>4 ✓</b></p>
                <p>✓ Turns off email for comments</p>
                <p>✓ Quiet hours only show when on</p>
                <p>✓ Saving shows a confirmation</p>
                <p>✓ Restore defaults resets all</p>
              </aside>
            </div>
          </div>

          <div class="phone" aria-label="The prototype on a phone" v-show="step === 3">
            <div class="phone-notch"></div>
            <NotificationsDemo compact />
          </div>

          <ol class="progress" aria-hidden="true">
            <li v-for="(_, i) in STEPS" :key="i" :class="{ on: i <= step }"></li>
          </ol>
        </div>

        <div class="steps">
          <article v-for="(s, i) in STEPS" :key="s.title" class="step" :data-step="i" :class="{ current: i === step }">
            <div class="step-card">
              <span class="step-n">{{ i + 1 }}</span>
              <h3>{{ s.title }}</h3>
              <p>{{ s.text }}</p>
            </div>
          </article>
        </div>
      </div>
    </section>

    <!-- Design guide -->
    <section class="guide">
      <div class="wrap guide-in reveal">
        <div>
          <h2>It looks like your product, not like a template</h2>
          <p>
            Keep a short design guide in your repo: colors, type, components, tone of voice. Paste the repo
            link in the thread and every version follows it. Your design team owns the guide; the bot just reads it.
          </p>
          <p><a :href="doc('guides/design-md.md')">How to write the design guide</a></p>
        </div>
        <pre class="md" aria-label="Part of a design guide"><code><span class="h"># Acme design guide</span>

<span class="h">## Colors</span>
Primary   #4f46e5   buttons, links, active switches
Surface   #ffffff   cards on a #f7f7fb page

<span class="h">## Components</span>
Switch    for on/off settings, never checkboxes
Toast     bottom center, gone after 2 seconds

<span class="h">## Voice</span>
Short and direct. "Save", not "Submit".</code></pre>
      </div>
    </section>

    <!-- For developers -->
    <section id="developers" class="wrap devs">
      <h2 class="reveal">What your developers get</h2>
      <p class="sub reveal">No more "what did we agree?". The pull request carries everything the thread decided.</p>
      <div class="cards">
        <article class="reveal">
          <span class="icon" aria-hidden="true">◧</span>
          <h3>A prototype that is the spec</h3>
          <p>Every screen and state of the flow in one HTML file, versioned in <code>design/prototypes/</code> next to the code.</p>
        </article>
        <article class="reveal">
          <span class="icon" aria-hidden="true">✓</span>
          <h3>"Done", already defined</h3>
          <p>The acceptance criteria come as automated checks that already pass in the prototype. Developers run the same checks in the real app, and in CI.</p>
        </article>
        <article class="reveal">
          <span class="icon" aria-hidden="true">{ }</span>
          <h3>Notes where they matter</h3>
          <p>Routes, endpoints and payloads in <code>DEV:</code> notes. What exists only for the prototype is marked, so nobody builds it by mistake.</p>
        </article>
      </div>
    </section>

    <!-- Install -->
    <section id="install" class="install">
      <div class="wrap">
        <h2 class="reveal">Your dev team sets it up in 15 minutes</h2>
        <p class="sub reveal">It runs on your servers, with your own Slack app, GitHub App and AI key. Nothing is stored, and there is no SaaS in the middle.</p>
        <ol class="install-steps">
          <li class="reveal">
            <span class="step-n">1</span>
            <div>
              <h3>Create the apps</h3>
              <p>One command creates your Slack app and GitHub App with your name and color, and checks your AI key.</p>
              <pre><code><span class="p">$</span> git clone https://github.com/BRIKEV/twd-design
<span class="p">$</span> cd twd-design &amp;&amp; npm install
<span class="p">$</span> npm run setup</code></pre>
            </div>
          </li>
          <li class="reveal">
            <span class="step-n">2</span>
            <div>
              <h3>Run it anywhere a container runs</h3>
              <p>512 MB of memory and half a CPU. No database, no public URL.</p>
              <pre><code><span class="p">$</span> docker compose up -d</code></pre>
              <p class="platforms">Docker · Compose · Kubernetes · Render · Fly.io · Railway</p>
            </div>
          </li>
          <li class="reveal">
            <span class="step-n">3</span>
            <div>
              <h3>Invite it to a channel</h3>
              <p>Then mention it. It introduces itself.</p>
              <pre><code>/invite @twd-design</code></pre>
            </div>
          </li>
        </ol>
        <div class="ctas reveal">
          <a class="btn primary light" :href="INSTALL">Read the install guide</a>
          <button type="button" class="btn ghost" @click="copyInstall">{{ copied ? 'Link copied' : 'Copy the link for your dev team' }}</button>
        </div>
        <p class="trust reveal"><a :href="doc('reference/security.md')">What is read, sent and stored</a> · Any AI provider, your key · MIT licensed · <a :href="COMPARE">Why not v0 or Lovable?</a></p>
      </div>
    </section>

    <!-- FAQ -->
    <section id="faq" class="wrap faq">
      <h2 class="reveal">Questions</h2>
      <details v-for="item in FAQ" :key="item.q">
        <summary>{{ item.q }}</summary>
        <p>{{ item.a }}</p>
      </details>
    </section>

    <section class="wrap closing reveal">
      <p class="big">Agree on it in the thread.<br /><span>Build it once.</span></p>
      <div class="ctas center">
        <a class="btn primary" :href="INSTALL">Install TWD Design</a>
        <a class="btn" :href="REPO">Star it on GitHub</a>
      </div>
    </section>
  </main>

  <footer class="wrap foot">
    <p>
      <img src="/twd-design-icon.png" alt="" width="20" height="20" />
      TWD Design is part of <a href="https://twd.dev">TWD</a>, by <a href="https://github.com/BRIKEV">BRIKEV</a>. MIT licensed.
    </p>
    <p><a :href="REPO">GitHub</a> · <a :href="DOCS">Docs</a> · <a :href="COMPARE">Why not v0 or Lovable?</a></p>
  </footer>
</template>
