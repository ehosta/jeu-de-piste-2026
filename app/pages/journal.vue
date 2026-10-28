<script setup lang="ts">
definePageMeta({
    middleware: () => {
        if (!useUserSession().user.value?.role) {
            return navigateTo("/");
        }
    },
});

const { t, ordinal, formatDateTime } = useI18n();
const { data, refresh } = await useFetch("/api/logs");

let poll: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    poll = setInterval(() => {
        if (document.visibilityState === "visible") {
            refresh();
        }
    }, 15_000);
});

onBeforeUnmount(() => clearInterval(poll));
</script>

<template>
    <main class="container page narrow">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("logs.eyebrow") }}</p>
                <h1>{{ t("logs.title") }}</h1>
            </div>
        </header>

        <p v-if="!data?.length" class="card empty">{{ t("logs.empty") }}</p>

        <ol v-else class="timeline">
            <li
                v-for="(entry, index) in data"
                :key="index"
                class="entry"
                :class="{ first: entry.rank === 1 && !entry.sandbox, mine: entry.mine, sandbox: entry.sandbox }"
            >
                <span class="dot" aria-hidden="true">{{ entry.rank === 1 && !entry.sandbox ? "✦" : "" }}</span>
                <div class="card entry-card">
                    <div class="entry-top">
                        <time class="muted small">
                            {{ entry.at ? formatDateTime(entry.at) : t("logs.unknownTime") }}
                        </time>
                        <span class="gain">+{{ entry.points }}</span>
                    </div>
                    <p>
                        <I18nText path="logs.entry">
                            <template #team><strong>{{ entry.team }}</strong></template>
                            <template #npc><em>{{ entry.npc }}</em></template>
                        </I18nText>
                    </p>
                    <div class="row entry-meta">
                        <span class="stars" :title="t('admin.npcs.difficultyTitle', { count: entry.difficulty })">
                            {{ stars(entry.difficulty) }}
                        </span>
                        <span v-if="entry.sandbox" class="badge" :title="t('leaderboard.sandboxHint')">
                            {{ t("leaderboard.sandbox") }}
                        </span>
                        <span v-else-if="entry.rank === 1" class="badge badge-warning">
                            {{ t("logs.first") }}
                        </span>
                        <span v-else class="badge">{{ ordinal(entry.rank) }}</span>
                        <span v-if="entry.mine" class="badge badge-primary">{{ t("logs.yours") }}</span>
                    </div>
                </div>
            </li>
        </ol>
    </main>
</template>

<style scoped>
/* A vertical chronicle, newest on top. */
.timeline {
    position: relative;
    display: flex;
    flex-direction: column;
    gap: 0.8rem;
    margin: 0;
    padding: 0 0 0 1.6rem;
    list-style: none;
}

.timeline::before {
    content: "";
    position: absolute;
    top: 0.5rem;
    bottom: 0.5rem;
    left: 0.55rem;
    border-left: 2px dashed var(--frame-soft);
}

.entry {
    position: relative;
}

.dot {
    position: absolute;
    top: 1.1rem;
    left: -1.6rem;
    display: grid;
    place-items: center;
    width: 1.2rem;
    height: 1.2rem;
    border: 2px solid var(--frame);
    background: var(--surface);
    color: #fff4d6;
    font-size: 0.7rem;
    transform: rotate(45deg);
}

.first .dot {
    border-color: var(--gold);
    background: var(--gold);
}

.entry-card {
    gap: 0.4rem;
    padding: 0.85rem 1rem;
}

.first .entry-card {
    border-color: var(--gold);
}

.mine .entry-card {
    border-color: var(--primary);
}

.sandbox .entry-card {
    opacity: 0.7;
}

.entry-top {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
}

.gain {
    color: var(--gold);
    font-family: var(--font-pixel);
    font-size: 1.15rem;
}

.entry-meta {
    gap: 0.4rem;
}

.stars {
    color: var(--gold);
    letter-spacing: 0.1em;
}
</style>
