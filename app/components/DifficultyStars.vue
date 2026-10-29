<script setup lang="ts">
import { MAX_DIFFICULTY } from "#shared/utils/scoring";

// A quest's difficulty as stars: 3 gold ones and 2 faded ones for 3 out of 5.
defineProps<{ difficulty: number }>();
</script>

<template>
    <span class="difficulty-stars">
        <Icon
            v-for="index in MAX_DIFFICULTY"
            :key="index"
            name="solar:star-bold-duotone"
            class="star"
            :class="{ empty: index > difficulty }"
            aria-hidden="true"
        />
    </span>
</template>

<style scoped>
.difficulty-stars {
    display: inline-flex;
    color: var(--gold);
    gap: 0.1em;
    vertical-align: -0.15em;
}

.star.empty {
    opacity: 0.25;
}
</style>
