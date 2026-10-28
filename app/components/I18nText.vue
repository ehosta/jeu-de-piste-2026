<script setup lang="ts">
import type { MessageKey } from "~/i18n";

// A translated message with markup inside: each {placeholder} is rendered by
// the slot of the same name, e.g. <template #doc><code>…</code></template>.
const props = defineProps<{ path: MessageKey }>();

const { t } = useI18n();

const parts = computed(() => t(props.path).split(/(\{\w+\})/));
</script>

<template>
    <template v-for="(part, index) in parts" :key="index">
        <slot v-if="/^\{\w+\}$/.test(part)" :name="part.slice(1, -1)" />
        <template v-else>{{ part }}</template>
    </template>
</template>
