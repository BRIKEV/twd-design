<script setup lang="ts">
import { useData } from 'vitepress'
import Landing from './Landing.vue'
import { REPO } from '../content'

const { page } = useData()
</script>

<template>
  <Landing v-if="!page.isNotFound" />
  <main v-else class="not-found">
    <p class="eyebrow">404</p>
    <h1>This page doesn't exist.</h1>
    <p><a href="/">Back to TWD Design</a> · <a :href="REPO">GitHub</a></p>
  </main>
</template>
