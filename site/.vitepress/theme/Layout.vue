<script setup lang="ts">
import { useData } from 'vitepress'
import DefaultTheme from 'vitepress/theme'
import Landing from './Landing.vue'

const { frontmatter } = useData()
</script>

<template>
  <div v-if="frontmatter.layout === 'landing'" class="landing">
    <Landing />
  </div>
  <DefaultTheme.Layout v-else />
</template>
