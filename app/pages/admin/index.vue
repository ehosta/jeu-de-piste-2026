<script setup lang="ts">
import type { GamePhase, TeamQuestStatus } from "~~/prisma/generated/enums";
import type { ActAsTarget } from "~/composables/useActAs";

const { data, refresh } = await useAdminState();
const { busy, apply, toast } = useAdminPatch();
const { actAs: switchTo } = useActAs();
const { t } = useI18n();

const pauseMessage = ref(data.value?.game.pauseMessage ?? "");
const actTeam = ref("");
const actNpc = ref("");
const actUser = ref("");

const otherUsers = computed(() =>
    (data.value?.users ?? []).filter((user) => user.login !== data.value?.me),
);

// The overview follows the game live.
let poll: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    poll = setInterval(() => {
        if (document.visibilityState === "visible" && !busy.value) {
            refresh();
        }
    }, 15_000);
});

onBeforeUnmount(() => clearInterval(poll));

const quests = computed(() => data.value?.quests ?? []);

const stats = computed(() => {
    const users = data.value?.users ?? [];
    // The admins' sandbox teams aren't part of the game.
    const teams = (data.value?.teams ?? []).filter((team) => !team.sandbox);
    const sandboxes = (data.value?.teams.length ?? 0) - teams.length;
    const progress = teams.flatMap((team) => Object.values(team.progress));
    const players = users.filter((user) => user.role === "PLAYER");

    return [
        {
            label: t("admin.overview.stats.players"),
            value: players.length,
            hint: t("admin.overview.stats.withoutTeam", {
                count: players.filter((user) => !user.team).length,
            }),
        },
        {
            label: t("admin.overview.stats.teams"),
            value: teams.length,
            hint: sandboxes
                ? t("admin.overview.stats.adminTeams", { count: sandboxes })
                : undefined,
        },
        {
            label: t("admin.overview.stats.npcs"),
            value: data.value?.npcs.length ?? 0,
            hint: t("admin.overview.stats.quests", { count: quests.value.length }),
        },
        {
            label: t("admin.overview.stats.toReview"),
            value: progress.filter((entry) => entry.status === "SUBMITTED").length,
        },
        {
            label: t("admin.overview.stats.validated"),
            value: progress.filter((entry) => entry.status === "VALIDATED").length,
        },
    ];
});

watchEffect(() => {
    actTeam.value ||= data.value?.teams[0]?.id ?? "";
    actNpc.value ||= data.value?.npcs[0]?.id ?? "";
    actUser.value ||= otherUsers.value[0]?.id ?? "";
});

function setPaused(paused: boolean) {
    return apply(
        { game: { paused, pauseMessage: pauseMessage.value || null } },
        {
            confirm: paused ? t("admin.overview.game.pauseConfirm") : undefined,
            success: paused
                ? t("admin.overview.game.paused")
                : t("admin.overview.game.resumed"),
        },
    );
}

function setPhase(phase: GamePhase) {
    return apply(
        { game: { phase } },
        {
            confirm:
                phase === "RUNNING"
                    ? t("admin.overview.game.startConfirm")
                    : t("admin.overview.game.backConfirm"),
            success:
                phase === "RUNNING"
                    ? t("admin.overview.game.started")
                    : t("admin.overview.game.backDone"),
        },
    );
}

function setStatus(team: string, quest: string, status: TeamQuestStatus) {
    return apply({ progress: [{ team, quest, status }] });
}

async function actAs(target: ActAsTarget) {
    try {
        await switchTo(target);
    } catch (error) {
        toast.value = toastFromError(error, t);
    }
}

</script>

<template>
    <main v-if="data" class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.overview.title") }}</h1>
            </div>
            <span
                class="badge"
                :class="
                    data.game.phase === 'WAITING'
                        ? 'badge-info'
                        : data.game.paused
                          ? 'badge-warning'
                          : 'badge-success'
                "
            >
                {{
                    data.game.phase === "WAITING"
                        ? t("admin.overview.phaseBadge.WAITING")
                        : data.game.paused
                          ? t("admin.overview.phaseBadge.paused")
                          : t("admin.overview.phaseBadge.RUNNING")
                }}
            </span>
        </header>

        <section class="stats">
            <div v-for="stat in stats" :key="stat.label" class="card stat">
                <span class="muted small">{{ stat.label }}</span>
                <strong>{{ stat.value }}</strong>
                <span v-if="stat.hint" class="muted small">{{ stat.hint }}</span>
            </div>
        </section>

        <div class="grid two">
            <section
                class="card"
                :class="{ paused: data.game.paused && data.game.phase === 'RUNNING' }"
            >
                <h2>{{ t("admin.overview.game.title") }}</h2>
                <ol class="phases">
                    <li :class="{ current: data.game.phase === 'WAITING' }">
                        <strong>{{ t("admin.overview.game.waiting") }}</strong>
                        <span class="muted small">{{ t("admin.overview.game.waitingText") }}</span>
                    </li>
                    <li :class="{ current: data.game.phase === 'RUNNING' }">
                        <strong>{{ t("admin.overview.game.running") }}</strong>
                        <span class="muted small">{{ t("admin.overview.game.runningText") }}</span>
                    </li>
                </ol>
                <button
                    v-if="data.game.phase === 'WAITING'"
                    class="btn btn-primary"
                    :disabled="busy"
                    @click="setPhase('RUNNING')"
                >
                    {{ t("admin.overview.game.start") }}
                </button>
                <template v-else>
                    <label class="field">
                        <span>{{ t("admin.overview.game.pauseMessage") }}</span>
                        <input
                            v-model="pauseMessage"
                            class="input"
                            :placeholder="t('header.pausedDefault')"
                            maxlength="200"
                        >
                    </label>
                    <div class="actions">
                        <button
                            v-if="data.game.paused"
                            class="btn btn-success"
                            :disabled="busy"
                            @click="setPaused(false)"
                        >
                            {{ t("admin.overview.game.resume") }}
                        </button>
                        <button
                            v-else
                            class="btn btn-danger"
                            :disabled="busy"
                            @click="setPaused(true)"
                        >
                            {{ t("admin.overview.game.pause") }}
                        </button>
                        <button class="btn btn-ghost" :disabled="busy" @click="setPhase('WAITING')">
                            {{ t("admin.overview.game.backToWaiting") }}
                        </button>
                    </div>
                </template>
            </section>

            <section class="card">
                <h2>{{ t("admin.overview.actAs.title") }}</h2>
                <p class="muted small">{{ t("admin.overview.actAs.text") }}</p>
                <form
                    v-if="data.teams.length"
                    class="row"
                    @submit.prevent="actAs({ role: 'PLAYER', teamId: actTeam })"
                >
                    <select v-model="actTeam" class="select grow" :aria-label="t('admin.overview.actAs.team')">
                        <option v-for="team in data.teams" :key="team.id" :value="team.id">
                            {{ t("header.playerOf", { name: team.name }) }}
                        </option>
                    </select>
                    <button class="btn btn-primary">{{ t("common.play") }}</button>
                </form>
                <form
                    v-if="data.npcs.length"
                    class="row"
                    @submit.prevent="actAs({ role: 'NPC', npcId: actNpc })"
                >
                    <select v-model="actNpc" class="select grow" :aria-label="t('header.npc')">
                        <option v-for="npc in data.npcs" :key="npc.id" :value="npc.id">
                            {{ t("header.npcNamed", { name: npc.name }) }}
                        </option>
                    </select>
                    <button class="btn btn-primary">{{ t("common.play") }}</button>
                </form>
                <form
                    v-if="otherUsers.length"
                    class="row"
                    @submit.prevent="actAs({ role: 'USER', userId: actUser })"
                >
                    <select v-model="actUser" class="select grow" :aria-label="t('admin.overview.actAs.account')">
                        <option v-for="user in otherUsers" :key="user.id" :value="user.id">
                            {{
                                t("admin.overview.actAs.accountOption", {
                                    login: user.login,
                                    role: t(`roles.${user.role}`),
                                })
                            }}
                        </option>
                    </select>
                    <button class="btn btn-primary">{{ t("common.impersonate") }}</button>
                </form>
                <p v-if="!data.teams.length && !data.npcs.length" class="muted small">
                    {{ t("admin.overview.actAs.nothing") }}
                </p>
            </section>
        </div>

        <AssignPanel />

        <section class="stack">
            <div class="card-header">
                <h2>{{ t("admin.overview.progress.title") }}</h2>
                <span class="muted small">{{ t("admin.overview.progress.hint") }}</span>
            </div>
            <p v-if="!data.teams.length || !quests.length" class="card empty">
                {{ t("admin.overview.progress.empty") }}
            </p>
            <div v-else class="table-wrap">
                <table class="table matrix">
                    <thead>
                        <tr>
                            <th>{{ t("admin.overview.progress.team") }}</th>
                            <th v-for="quest in quests" :key="quest.key" :title="quest.label">
                                <span class="th-quest">{{ quest.label }}</span>
                                <span class="th-npc">{{ quest.npcs.join(" · ") }}</span>
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="team in data.teams" :key="team.id">
                            <th scope="row">
                                {{ team.name }}
                                <span class="th-npc">
                                    {{ t("admin.overview.progress.members", { count: team.members.length }) }}
                                    <template v-if="team.sandbox">
                                        · {{ t("admin.overview.progress.admin") }}
                                    </template>
                                </span>
                            </th>
                            <td v-for="quest in quests" :key="quest.key">
                                <div class="cell">
                                    <select
                                        class="select select-small status-select"
                                        :class="`tone-${QUEST_STATUS_TONES[team.progress[quest.key]?.status ?? 'HIDDEN']}`"
                                        :value="team.progress[quest.key]?.status ?? 'HIDDEN'"
                                        :disabled="busy"
                                        :aria-label="`${team.name} · ${quest.label}`"
                                        @change="
                                            setStatus(
                                                team.name,
                                                quest.key,
                                                ($event.target as HTMLSelectElement)
                                                    .value as TeamQuestStatus,
                                            )
                                        "
                                    >
                                        <option
                                            v-for="status in QUEST_STATUSES"
                                            :key="status"
                                            :value="status"
                                        >
                                            {{ t(`questStatus.${status}`) }}
                                        </option>
                                    </select>
                                    <a
                                        v-if="team.progress[quest.key]?.photoPath"
                                        :href="`/api/photos/${team.progress[quest.key]?.photoPath}`"
                                        target="_blank"
                                        class="photo-link"
                                        :title="t('admin.overview.progress.photo')"
                                    >
                                        📷
                                    </a>
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>
        </section>
    </main>
</template>

<style scoped>
.stats {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 9.5rem), 1fr));
    gap: 0.75rem;
}

.stat {
    gap: 0.15rem;
    padding: 1rem 1.15rem;
}

.stat strong {
    font-family: var(--font-display);
    font-size: 2rem;
    line-height: 1.1;
}

.two {
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
}

.paused {
    border-color: var(--warning);
}

.phases {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.phases li {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    padding: 0.6rem 0.8rem;
    border: 2px dashed var(--border);
    border-radius: var(--radius-sm);
    opacity: 0.65;
}

.phases li.current {
    border: 2px solid var(--gold);
    background: color-mix(in srgb, var(--gold-soft) 45%, transparent);
    opacity: 1;
}

.phases li.current strong::before {
    content: "▶ ";
    color: var(--gold);
}

.matrix th[scope="row"] {
    position: sticky;
    left: 0;
    z-index: 1;
    background: var(--surface);
    color: var(--text);
    font-size: 0.925rem;
    letter-spacing: 0;
    text-transform: none;
}

.th-quest {
    display: -webkit-box;
    max-width: 11rem;
    overflow: hidden;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    white-space: normal;
}

.th-npc {
    display: block;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 400;
    letter-spacing: 0;
    text-transform: none;
}

.cell {
    display: flex;
    align-items: center;
    gap: 0.35rem;
}

.status-select {
    min-width: 9rem;
    font-weight: 600;
}

.tone-info {
    background-color: var(--info-soft);
    color: var(--info);
}

.tone-warning {
    background-color: var(--warning-soft);
    color: var(--warning);
}

.tone-success {
    background-color: var(--success-soft);
    color: var(--success);
}

.tone-danger {
    background-color: var(--danger-soft);
    color: var(--danger);
}

.photo-link {
    text-decoration: none;
}
</style>
