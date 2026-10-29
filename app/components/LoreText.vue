<script setup lang="ts">
// A story as paragraphs: separated by blank lines, line breaks kept.
const props = defineProps<{ text: string }>();

const paragraphs = computed(() =>
    props.text
        .split(/\n\s*\n/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean),
);
</script>

<template>
    <div class="lore-text">
        <p v-for="(paragraph, index) in paragraphs" :key="index">{{ paragraph }}</p>
    </div>
</template>

<style scoped>
.lore-text {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    overflow-wrap: anywhere;
    white-space: pre-line;
}
</style>
