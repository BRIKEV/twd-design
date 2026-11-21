<script setup lang="ts">
import { reactive, ref } from 'vue'

// The prototype from the demo thread, small and working: the switches, quiet hours and Save respond,
// so visitors feel what "clickable prototype" means.
defineProps<{ compact?: boolean }>()

const defaults = () => ({
  comments: { email: true, push: true },
  mentions: { email: true, push: true },
  summary: { email: true, push: false },
})
const prefs = reactive(defaults())
const quiet = ref(false)
const saved = ref(false)
let timer: ReturnType<typeof setTimeout> | undefined

const rows = [
  { key: 'comments', label: 'Comments' },
  { key: 'mentions', label: 'Mentions' },
  { key: 'summary', label: 'Weekly summary' },
] as const

function save() {
  saved.value = true
  clearTimeout(timer)
  timer = setTimeout(() => (saved.value = false), 1800)
}
function reset() {
  Object.assign(prefs, defaults())
  quiet.value = false
}
</script>

<template>
  <div class="np" :class="{ compact }">
    <p class="np-crumb">Settings</p>
    <h4>Notifications</h4>
    <div class="np-table" role="group" aria-label="Notification channels">
      <div class="np-row np-head" aria-hidden="true"><span></span><span>Email</span><span>Push</span></div>
      <div v-for="r in rows" :key="r.key" class="np-row">
        <span>{{ r.label }}</span>
        <button
          v-for="ch in (['email', 'push'] as const)"
          :key="ch"
          type="button"
          role="switch"
          class="sw"
          :aria-checked="prefs[r.key][ch]"
          :aria-label="`${r.label} by ${ch}`"
          @click="prefs[r.key][ch] = !prefs[r.key][ch]"
        ><i></i></button>
      </div>
    </div>
    <div class="np-quiet">
      <span>Quiet hours</span>
      <button type="button" role="switch" class="sw" :aria-checked="quiet" aria-label="Quiet hours" @click="quiet = !quiet"><i></i></button>
    </div>
    <div class="np-range" v-show="quiet">
      <label>From <b>22:00</b></label>
      <label>To <b>08:00</b></label>
    </div>
    <div class="np-actions">
      <button type="button" class="np-save" @click="save">Save</button>
      <button type="button" class="np-reset" @click="reset">Restore defaults</button>
    </div>
    <p class="np-toast" role="status" :class="{ on: saved }">Preferences saved</p>
  </div>
</template>

<style scoped>
.np { --p: #4f46e5; font: 400 13px/1.45 'Inter', system-ui, sans-serif; color: #1f2333; padding: 18px 20px; position: relative; height: 100%; background: #fff; }
.np-crumb { margin: 0; color: #6b7080; font-size: 11px; }
h4 { margin: 2px 0 12px; font: 700 18px/1.2 'Inter', system-ui, sans-serif; }
.np-table { border: 1px solid #e6e7ee; border-radius: 10px; overflow: hidden; }
.np-row { display: grid; grid-template-columns: 1fr 52px 52px; align-items: center; padding: 8px 12px; border-top: 1px solid #eef0f4; }
.np-row:first-child { border-top: 0; }
.np-head { background: #f7f7fb; color: #6b7080; font-size: 11px; font-weight: 600; padding-block: 6px; }
.np-head span:not(:first-child) { text-align: center; }
.np-row .sw { justify-self: center; }
.np-quiet { display: flex; justify-content: space-between; align-items: center; margin-top: 12px; padding: 10px 12px; border: 1px solid #e6e7ee; border-radius: 10px; font-weight: 600; }
.np-range { display: flex; gap: 8px; margin-top: 8px; }
.np-range label { flex: 1; border: 1px solid #e6e7ee; border-radius: 8px; padding: 6px 10px; color: #6b7080; font-size: 11px; }
.np-range b { display: block; color: #1f2333; font-size: 13px; }
.np-actions { display: flex; gap: 8px; margin-top: 14px; }
.np-save, .np-reset { border-radius: 8px; padding: 7px 14px; font: 600 12px 'Inter', system-ui, sans-serif; cursor: pointer; }
.np-save { background: var(--p); color: #fff; border: 1px solid var(--p); }
.np-reset { background: #fff; color: #1f2333; border: 1px solid #d9dbe4; }
.np-toast { position: absolute; left: 50%; bottom: 14px; transform: translate(-50%, 8px); margin: 0; background: #1f2333; color: #fff; font-size: 12px; padding: 6px 12px; border-radius: 999px; opacity: 0; transition: opacity 0.2s, transform 0.2s; pointer-events: none; white-space: nowrap; }
.np-toast.on { opacity: 1; transform: translate(-50%, 0); }
.sw { width: 32px; height: 18px; border-radius: 999px; border: 0; padding: 2px; background: #cfd2dc; cursor: pointer; transition: background 0.15s; display: inline-flex; }
.sw i { width: 14px; height: 14px; border-radius: 50%; background: #fff; transition: transform 0.15s; box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2); }
.sw[aria-checked='true'] { background: var(--p); }
.sw[aria-checked='true'] i { transform: translateX(14px); }
.sw:focus-visible, .np-save:focus-visible, .np-reset:focus-visible { outline: 2px solid var(--p); outline-offset: 2px; }

/* v2, on mobile: the categories stack and quiet hours fit in one row */
.compact { padding: 14px; }
.compact h4 { font-size: 16px; }
.compact .np-row { grid-template-columns: 1fr 40px 40px; padding: 7px 10px; }
.compact .np-quiet { margin-top: 10px; }
.compact .np-range { margin-top: 6px; }
.compact .np-actions { flex-direction: column; }
</style>
