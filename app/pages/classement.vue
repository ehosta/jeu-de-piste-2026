<script setup lang="ts">
definePageMeta({
    middleware: () => {
        if (!useUserSession().user.value?.role) {
            return navigateTo("/");
        }
    },
});

const { t, ordinal } = useI18n();
const { data, refresh } = await useFetch("/api/leaderboard");

// The ranking moves as NPCs validate quests.
let poll: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    poll = setInterval(() => {
        if (document.visibilityState === "visible") {
            refresh();
        }
    }, 15_000);
});

onBeforeUnmount(() => clearInterval(poll));

// The admins' sandbox teams (only shown to admins) stay off the podium.
const podium = computed(() =>
    (data.value?.teams ?? []).filter((team) => team.rank <= 3 && team.points && !team.sandbox),
);
</script>

<template>
    <main class="container page narrow-wide">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("leaderboard.eyebrow") }}</p>
                <h1>{{ t("leaderboard.title") }}</h1>
            </div>
        </header>

        <p v-if="!data?.teams.length" class="card empty">{{ t("leaderboard.empty") }}</p>

        <template v-else>
            <ol v-if="podium.length" class="podium" aria-hidden="true">
                <li
                    v-for="team in podium"
                    :key="team.team"
                    class="step"
                    :class="[`step-${team.rank}`, { mine: team.mine }]"
                >
                    <span class="medal">{{ ordinal(team.rank) }}</span>
                    <strong class="step-name">{{ team.team }}</strong>
                    <span class="step-points">{{ t("player.points", { count: team.points }) }}</span>
                </li>
            </ol>

            <div class="table-wrap">
                <table class="table board">
                    <thead>
                        <tr>
                            <th>{{ t("leaderboard.rank") }}</th>
                            <th>{{ t("leaderboard.team") }}</th>
                            <th class="number">{{ t("leaderboard.quests") }}</th>
                            <th class="number">{{ t("leaderboard.points") }}</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr
                            v-for="team in data.teams"
                            :key="team.team"
                            :class="{ selected: team.mine, sandbox: team.sandbox }"
                        >
                            <td class="rank">{{ ordinal(team.rank) }}</td>
                            <td>
                                <strong>{{ team.team }}</strong>
                                <span v-if="team.mine" class="badge badge-primary">
                                    {{ t("leaderboard.yours") }}
                                </span>
                                <span v-if="team.sandbox" class="badge" :title="t('leaderboard.sandboxHint')">
                                    {{ t("leaderboard.sandbox") }}
                                </span>
                            </td>
                            <td class="number">{{ team.validated }}/{{ data.questCount }}</td>
                            <td class="number points">{{ team.points }}</td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </template>

        <details class="card rules">
            <summary><h2>{{ t("leaderboard.rulesTitle") }}</h2></summary>
            <ul class="small">
                <li>{{ t("leaderboard.rule1", { base: POINTS_PER_DIFFICULTY }) }}</li>
                <li>
                    {{
                        t("leaderboard.rule2", {
                            first: FIRST_BONUS,
                            second: FIRST_BONUS - BONUS_STEP,
                            last: ordinal(FIRST_BONUS / BONUS_STEP + 1),
                        })
                    }}
                </li>
                <li>{{ t("leaderboard.rule3") }}</li>
            </ul>
        </details>
    </main>
</template>

<style scoped>
.narrow-wide {
    max-width: 52rem;
}

/* The top three on steps: second, first, third. */
.podium {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    align-items: end;
    gap: 0.6rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.step {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 0.3rem;
    min-width: 0;
    padding: 0.9rem 0.5rem;
    border: 2px solid var(--frame);
    border-radius: var(--radius) var(--radius) 0 0;
    background: var(--surface);
    box-shadow: var(--shadow);
    text-align: center;
}

.step-1 {
    order: 2;
    min-height: 11rem;
    border-color: var(--gold);
    background: linear-gradient(color-mix(in srgb, var(--gold-soft) 70%, transparent), var(--surface));
}

.step-2 {
    order: 1;
    min-height: 9rem;
}

.step-3 {
    order: 3;
    min-height: 7.5rem;
}

.step.mine {
    outline: 3px solid var(--primary);
    outline-offset: 2px;
}

.medal {
    display: grid;
    place-items: center;
    width: 2.6rem;
    height: 2.6rem;
    border: 3px double #fff4d6;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #c0c6d0, #7d8592 70%);
    color: #1c1531;
    font-family: var(--font-pixel);
    font-size: 0.9rem;
    box-shadow: 0 2px 6px rgb(0 0 0 / 30%);
}

.step-1 .medal {
    background: radial-gradient(circle at 35% 30%, #f6d77c, #b7821f 70%);
}

.step-3 .medal {
    background: radial-gradient(circle at 35% 30%, #e0a372, #8c5326 70%);
}

.step-name {
    max-width: 100%;
    overflow: hidden;
    font-family: var(--font-display);
    line-height: 1.2;
    text-overflow: ellipsis;
}

.step-points {
    color: var(--gold);
    font-family: var(--font-pixel);
}

.board .number {
    text-align: right;
}

.board td {
    white-space: normal;
}

.board .badge {
    margin-left: 0.4rem;
}

.rank {
    font-family: var(--font-pixel);
}

.board .sandbox {
    opacity: 0.7;
}

.points {
    color: var(--gold);
    font-family: var(--font-pixel);
    font-size: 1.05rem;
}

.rules ul {
    display: flex;
    flex-direction: column;
    gap: 0.4rem;
    margin: 0.75rem 0 0;
    padding-left: 1.2rem;
}

.rules h2 {
    display: inline;
    font-size: 1.05rem;
}
</style>
