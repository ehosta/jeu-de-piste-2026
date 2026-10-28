<script setup lang="ts">
import type { TeamSizeMode } from "#shared/utils/team-generator";

// Forms random teams with random names from the players without a team (and,
// optionally, the 42 accounts kept out), previewed before being applied.
const { data } = await useAdminState();
const { busy, apply } = useAdminPatch();
const { locale, t } = useI18n();

const size = ref(3);
const mode = ref<TeamSizeMode>("atMost");
const includeBlocked = ref(true);
const preview = ref<{ name: string; members: string[] }[] | null>(null);

const SIZES = [2, 3, 4, 5, 6, 7, 8];

const pool = computed(() => [
    ...(data.value?.users ?? [])
        .filter((user) => user.role === "PLAYER" && !user.team)
        .map((user) => user.login),
    ...(includeBlocked.value ? (data.value?.waiting ?? []).map((user) => user.login) : []),
]);

const plannedCount = computed(() => teamCount(pool.value.length, size.value, mode.value));

const sizeRange = computed(() => {
    if (!plannedCount.value) {
        return "";
    }

    const min = Math.floor(pool.value.length / plannedCount.value);
    const max = Math.ceil(pool.value.length / plannedCount.value);
    return min === max ? `${min}` : t("admin.generator.range", { min, max });
});

function generate() {
    const teams = splitIntoTeams(pool.value, size.value, mode.value);
    const names = randomTeamNames(
        teams.length,
        locale.value,
        (data.value?.teams ?? []).map((team) => team.name),
    );
    preview.value = teams.map((members, index) => ({ name: names[index]!, members }));
}

function rerollNames() {
    if (!preview.value) {
        return;
    }

    const names = randomTeamNames(
        preview.value.length,
        locale.value,
        (data.value?.teams ?? []).map((team) => team.name),
    );
    preview.value = preview.value.map((team, index) => ({ ...team, name: names[index]! }));
}

// The pool changed (someone logged in, a team was formed): the preview is stale.
watch([pool, size, mode], () => (preview.value = null));

async function applyPreview() {
    if (!preview.value) {
        return;
    }

    const teams = preview.value;
    const report = await apply(
        { teams: teams.map((team) => ({ name: team.name.trim(), members: team.members })) },
        {
            confirm: t("admin.generator.confirm", {
                teams: teams.length,
                players: pool.value.length,
            }),
            success: t("admin.generator.done", { count: teams.length }),
        },
    );

    if (report) {
        preview.value = null;
    }
}
</script>

<template>
    <section v-if="data" class="card generator">
        <div class="card-header">
            <h2>{{ t("admin.generator.title") }}</h2>
            <span class="badge badge-info">{{ t("admin.generator.toPlace", { count: pool.length }) }}</span>
        </div>
        <p class="muted small">{{ t("admin.generator.text") }}</p>

        <div class="row params">
            <label class="field">
                <span>{{ t("admin.generator.size") }}</span>
                <select v-model.number="size" class="select">
                    <option v-for="value in SIZES" :key="value" :value="value">
                        {{ t("common.players", { count: value }) }}
                    </option>
                </select>
            </label>
            <label class="field grow">
                <span>{{ t("admin.generator.leftover") }}</span>
                <select v-model="mode" class="select">
                    <option value="atMost">{{ t("admin.generator.atMost", { size }) }}</option>
                    <option value="atLeast">{{ t("admin.generator.atLeast", { size }) }}</option>
                </select>
            </label>
        </div>
        <label v-if="data.waiting.length" class="row check">
            <input v-model="includeBlocked" type="checkbox" class="checkbox">
            {{ t("admin.generator.includeBlocked", { count: data.waiting.length }) }}
        </label>

        <p v-if="pool.length" class="small summary">
            {{ t("admin.generator.summary", { teams: plannedCount, sizes: sizeRange }) }}
        </p>

        <div class="row">
            <button class="btn" :disabled="!pool.length" @click="generate">
                {{ preview ? t("admin.generator.reshuffle") : t("admin.generator.preview") }}
            </button>
            <button v-if="preview" class="btn btn-ghost" @click="rerollNames">
                {{ t("admin.generator.otherNames") }}
            </button>
            <span class="spacer" />
            <button
                v-if="preview"
                class="btn btn-primary"
                :disabled="busy"
                @click="applyPreview"
            >
                {{ t("admin.generator.apply", { count: preview.length }) }}
            </button>
        </div>

        <ol v-if="preview" class="preview">
            <li v-for="(team, index) in preview" :key="index" class="preview-team">
                <input
                    v-model="team.name"
                    class="input preview-name"
                    :aria-label="t('admin.generator.teamName', { number: index + 1 })"
                    maxlength="80"
                >
                <ul class="members">
                    <li v-for="login in team.members" :key="login" class="chip">
                        {{ login }}
                    </li>
                </ul>
            </li>
        </ol>
    </section>
</template>

<style scoped>
.params {
    align-items: flex-end;
    gap: 0.75rem;
}

.check {
    gap: 0.5rem;
    font-size: 0.925rem;
    cursor: pointer;
}

.summary {
    font-family: var(--font-pixel);
}

.preview {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 16rem), 1fr));
    gap: 0.6rem;
    max-height: 28rem;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    scrollbar-width: thin;
}

.preview-team {
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    padding: 0.6rem;
    border: 2px dashed var(--frame-soft);
    border-radius: var(--radius-sm);
}

.preview-name {
    min-height: 2.25rem;
    padding-block: 0.25rem;
    font-family: var(--font-display);
    font-weight: 700;
}

.members {
    display: flex;
    flex-wrap: wrap;
    gap: 0.3rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.chip {
    padding-right: 0.65rem;
}
</style>
