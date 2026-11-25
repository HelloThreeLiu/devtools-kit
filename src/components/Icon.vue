<script setup>
defineProps({
  name: { type: String, required: true },
  size: { type: String, default: '' }, // '' | 'xs' | 'sm' | 'lg'
})
</script>

<template>
  <svg class="icon" :class="size ? `icon--${size}` : ''" aria-hidden="true" focusable="false">
    <use :href="`#i-${name}`" />
  </svg>
</template>
