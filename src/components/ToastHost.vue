<script setup>
import Icon from './Icon.vue'
import { useToast } from '../utils/toast.js'

const { message, visible } = useToast()
</script>

<template>
  <div class="toast" :class="{ show: visible }" role="status" aria-live="polite">
    <Icon name="check" />
    <span>{{ message }}</span>
  </div>
</template>
