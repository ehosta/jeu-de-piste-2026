<script setup lang="ts">
// The game's stats and records, to announce at the end: totals, times, the
// best of each kind and a table per quest, team and NPC. Real teams only.
const { data, refresh } = await useFetch("/api/admin/stats", { key: "admin-stats" });
const { t, locale } = useI18n();

// Follows the game live, like the other admin pages.
useRealtime(["admin"], refresh);

function duration(ms: number | null | undefined) {
    return ms === null || ms === undefined ? "—" : formatDuration(ms);
}

function time(value: string | Date | null | undefined) {
    return value
        ? new Date(value).toLocaleTimeString(locale.value === "fr" ? "fr-FR" : "en-GB", {
              hour: "2-digit",
              minute: "2-digit",
          })
        : "—";
}

// A riddle cut short, for the cards.
function shorten(label: string) {
    return label.length > 60 ? `${label.slice(0, 59)}…` : label;
}

const totals = computed(() => {
    const value = data.value;

    if (!value) {
        return [];
    }

    return [
        { label: t("admin.stats.totals.validated"), value: value.totals.validated, hint: t("admin.stats.totals.given", { count: value.totals.given }) },
        { label: t("admin.stats.totals.completion"), value: `${Math.round(value.totals.completion * 100)} %` },
        { label: t("admin.stats.totals.points"), value: value.totals.points, hint: t("admin.stats.totals.averagePoints", { count: value.totals.averagePoints }) },
        { label: t("admin.stats.totals.averageSolve"), value: duration(value.times.averageSolveMs) },
        { label: t("admin.stats.totals.averageReview"), value: duration(value.times.averageReviewMs) },
        { label: t("admin.stats.totals.duration"), value: duration(value.game.durationMs), hint: value.game.startedAt ? t("admin.stats.totals.startedAt", { time: time(value.game.startedAt) }) : undefined },
        { label: t("admin.stats.totals.players"), value: value.totals.players, hint: t("admin.stats.totals.teams", { count: value.totals.teams }) },
        { label: t("admin.stats.totals.rejected"), value: value.totals.rejected, hint: value.totals.blocked ? t("admin.stats.totals.blocked", { count: value.totals.blocked }) : undefined },
        { label: t("admin.stats.totals.photographers"), value: value.totals.photographers },
    ];
});

// The highlights, as cards: only those with something to show.
const records = computed(() => {
    const value = data.value;

    if (!value) {
        return [];
    }

    const { records, final } = value;

    return [
        final.winner && {
            icon: "solar:cup-star-bold-duotone",
            title: t("admin.stats.records.winner"),
            main: final.winner.team,
            detail: t("admin.stats.records.validatedAt", { time: time(final.winner.at) }),
        },
        records.fastest && {
            icon: "solar:stopwatch-bold-duotone",
            title: t("admin.stats.records.fastest"),
            main: records.fastest.team,
            detail: `${duration(records.fastest.ms)} · ${shorten(records.fastest.quest)}`,
        },
        records.slowest && {
            icon: "solar:hourglass-bold-duotone",
            title: t("admin.stats.records.slowest"),
            main: records.slowest.team,
            detail: `${duration(records.slowest.ms)} · ${shorten(records.slowest.quest)}`,
        },
        records.first && {
            icon: "solar:flag-bold-duotone",
            title: t("admin.stats.records.first"),
            main: records.first.team,
            detail: `${time(records.first.at)} · ${shorten(records.first.quest)}`,
        },
        records.last && {
            icon: "solar:moon-stars-bold-duotone",
            title: t("admin.stats.records.last"),
            main: records.last.team,
            detail: `${time(records.last.at)} · ${shorten(records.last.quest)}`,
        },
        records.mostPopular && {
            icon: "solar:fire-bold-duotone",
            title: t("admin.stats.records.mostPopular"),
            main: shorten(records.mostPopular.label),
            detail: t("admin.stats.records.validatedBy", { count: records.mostPopular.validated }),
        },
        records.toughest && {
            icon: "solar:danger-triangle-bold-duotone",
            title: t("admin.stats.records.toughest"),
            main: shorten(records.toughest.label),
            detail: t("admin.stats.records.onAverage", { time: duration(records.toughest.ms) }),
        },
        records.peak && {
            icon: "solar:chart-2-bold-duotone",
            title: t("admin.stats.records.peak"),
            main: t("admin.stats.records.peakHour", { time: time(records.peak.hour) }),
            detail: t("admin.stats.records.validations", { count: records.peak.validated }),
        },
        records.topPhotographer && {
            icon: "solar:camera-bold-duotone",
            title: t("admin.stats.records.photographer"),
            main: records.topPhotographer.login,
            detail: t("admin.stats.records.photos", { count: records.topPhotographer.validated }),
        },
        records.topNpc && {
            icon: "solar:user-speak-bold-duotone",
            title: t("admin.stats.records.npc"),
            main: records.topNpc.name,
            detail: t("admin.stats.records.validations", { count: records.topNpc.validated }),
        },
    ].filter((record) => !!record);
});
</script>

<template>
    <main v-if="data" class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.stats.title") }}</h1>
            </div>
        </header>
        <p class="muted small">{{ t("admin.stats.intro") }}</p>

        <section class="stats">
            <div v-for="stat in totals" :key="stat.label" class="card stat">
                <span class="muted small">{{ stat.label }}</span>
                <strong>{{ stat.value }}</strong>
                <span v-if="stat.hint" class="muted small">{{ stat.hint }}</span>
            </div>
        </section>

        <section v-if="data.totals.secretQuests" class="card final">
            <h2>
                <Icon name="solar:crown-star-bold-duotone" class="ico" aria-hidden="true" />
                {{ t("admin.stats.final.title") }}
            </h2>
            <p>
                {{
                    t("admin.stats.final.text", {
                        unlocked: data.final.unlocked,
                        finished: data.final.finished,
                        teams: data.totals.teams,
                        threshold: data.final.threshold,
                    })
                }}
            </p>
        </section>

        <h2>{{ t("admin.stats.records.title") }}</h2>
        <p v-if="!records.length" class="card empty">{{ t("admin.stats.empty") }}</p>
        <section v-else class="grid records">
            <article v-for="record in records" :key="record.title" class="card record">
                <Icon :name="record.icon" class="record-icon" aria-hidden="true" />
                <div class="stack record-text">
                    <span class="eyebrow">{{ record.title }}</span>
                    <strong>{{ record.main }}</strong>
                    <span class="muted small">{{ record.detail }}</span>
                </div>
            </article>
        </section>

        <p v-if="data.records.neverValidated.length" class="notice notice-warning small">
            {{ t("admin.stats.neverValidated", { count: data.records.neverValidated.length }) }}
            {{ data.records.neverValidated.map(shorten).join(" · ") }}
        </p>

        <h2>{{ t("admin.stats.perDifficulty") }}</h2>
        <div class="table-wrap">
            <table class="table">
                <thead>
                    <tr>
                        <th>{{ t("admin.npcs.difficulty") }}</th>
                        <th class="number">{{ t("admin.stats.columns.quests") }}</th>
                        <th class="number">{{ t("admin.stats.columns.validated") }}</th>
                        <th class="number">{{ t("admin.stats.columns.average") }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="row in data.perDifficulty" :key="row.difficulty">
                        <td><DifficultyStars :difficulty="row.difficulty" /></td>
                        <td class="number">{{ row.quests }}</td>
                        <td class="number">{{ row.validated }}</td>
                        <td class="number">{{ duration(row.averageMs) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <h2>{{ t("admin.stats.perQuest") }}</h2>
        <div class="table-wrap">
            <table class="table">
                <thead>
                    <tr>
                        <th>{{ t("admin.stats.columns.quest") }}</th>
                        <th class="number">{{ t("admin.stats.columns.given") }}</th>
                        <th class="number">{{ t("admin.stats.columns.validated") }}</th>
                        <th class="number">{{ t("admin.stats.columns.rejected") }}</th>
                        <th class="number">{{ t("admin.stats.columns.average") }}</th>
                    </tr>
                </thead>
                <tbody>
                    <tr v-for="quest in data.perQuest" :key="quest.key">
                        <td class="wrap">
                            <span v-if="quest.secret" class="badge badge-warning">{{ t("secret.badge") }}</span>
                            <DifficultyStars :difficulty="quest.difficulty" />
                            {{ shorten(quest.label) }}
                        </td>
                        <td class="number">{{ quest.given }}</td>
                        <td class="number">{{ quest.validated }}</td>
                        <td class="number">{{ quest.rejected }}</td>
                        <td class="number">{{ duration(quest.averageMs) }}</td>
                    </tr>
                </tbody>
            </table>
        </div>

        <div class="grid two">
            <section class="stack">
                <h2>{{ t("admin.stats.perTeam") }}</h2>
                <div class="table-wrap">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>{{ t("leaderboard.team") }}</th>
                                <th class="number">{{ t("leaderboard.points") }}</th>
                                <th class="number">{{ t("admin.stats.columns.validated") }}</th>
                                <th class="number">{{ t("admin.stats.columns.rejected") }}</th>
                                <th class="number">{{ t("admin.stats.columns.average") }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="team in data.perTeam" :key="team.name">
                                <td class="wrap">{{ team.name }} <span class="muted small">({{ team.members }})</span></td>
                                <td class="number">{{ team.points }}</td>
                                <td class="number">{{ team.validated }}</td>
                                <td class="number">{{ team.rejected }}</td>
                                <td class="number">{{ duration(team.averageMs) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <section class="stack">
                <h2>{{ t("admin.stats.perNpc") }}</h2>
                <p v-if="!data.perNpc.length" class="card empty">{{ t("admin.stats.empty") }}</p>
                <div v-else class="table-wrap">
                    <table class="table">
                        <thead>
                            <tr>
                                <th>{{ t("admin.stats.columns.npc") }}</th>
                                <th class="number">{{ t("admin.stats.columns.given") }}</th>
                                <th class="number">{{ t("admin.stats.columns.validated") }}</th>
                                <th class="number">{{ t("admin.stats.columns.review") }}</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr v-for="npc in data.perNpc" :key="npc.name">
                                <td class="wrap">{{ npc.name }}</td>
                                <td class="number">{{ npc.given }}</td>
                                <td class="number">{{ npc.validated }}</td>
                                <td class="number">{{ duration(npc.reviewMs) }}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>
        </div>
    </main>
</template>

<style scoped>
.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
    gap: 0.75rem;
}

.stat {
    gap: 0.15rem;
    padding: 1rem 1.15rem;
}

.stat strong {
    font-family: var(--font-display);
    font-size: 1.8rem;
    line-height: 1.1;
}

.final {
    border-color: var(--gold);
}

.records {
    --min: 16rem;
}

.record {
    flex-direction: row;
    align-items: center;
    gap: 0.9rem;
}

.record-icon {
    flex-shrink: 0;
    color: var(--gold);
    font-size: 2.2rem;
}

.record-text {
    --gap: 0.15rem;
    min-width: 0;
}

.record-text strong {
    overflow-wrap: anywhere;
    font-family: var(--font-display);
    font-size: 1.15rem;
}

.two {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 26rem), 1fr));
}

.number {
    text-align: right;
}

.wrap {
    white-space: normal;
}

.wrap .badge {
    margin-right: 0.3rem;
}
</style>
