<script setup lang="ts">
import type { NuxtError } from "#app";

// Replaces the whole app when a page can't be shown (unknown page, server
// error…): Sir Claudius explains, in the reader's language, and sends them home.
const props = defineProps<{ error: NuxtError }>();
const { t, locale } = useI18n();

useHead({ htmlAttrs: { lang: locale }, title: "Campudex" });

const kind = computed(() => {
    switch (props.error.statusCode) {
        case 401:
        case 403:
            return "forbidden";
        case 404:
            return "notFound";
        default:
            return "broken";
    }
});

function goHome() {
    return clearError({ redirect: "/" });
}
</script>

<template>
    <main class="container page narrow error-page">
        <p class="error-code" aria-hidden="true">{{ error.statusCode }}</p>
        <h1>{{ t(`errorPage.${kind}Title`) }}</h1>
        <div class="dialogue">
            <span class="dialogue-speaker">{{ t("errorPage.speaker") }}</span>
            <p>{{ t(`errorPage.${kind}Text`) }}</p>
        </div>
        <button class="btn btn-primary btn-block" @click="goHome">
            {{ t("errorPage.home") }}
        </button>
    </main>
</template>

<style scoped>
.error-page {
    justify-content: center;
    gap: 1.5rem;
    min-height: 100dvh;
    text-align: center;
}

.error-code {
    margin: 0;
    color: var(--gold);
    font-family: var(--font-pixel);
    font-size: clamp(3rem, 2rem + 6vw, 5rem);
    line-height: 1;
}
</style>
