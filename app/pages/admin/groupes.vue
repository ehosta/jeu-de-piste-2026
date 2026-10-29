<script setup lang="ts">
const { data } = await useAdminState();
const { busy, apply } = useAdminPatch();
const canEdit = useCanEdit();
const { locale, t } = useI18n();

const search = ref("");
const newTeam = ref("");
const newMembers = ref<Record<string, string>>({});
const renaming = ref<string | null>(null);
const renameValue = ref("");
const selected = ref<string[]>([]);

const teams = computed(() => {
    const query = search.value.trim().toLowerCase();

    return (data.value?.teams ?? []).filter(
        (team) =>
            !query ||
            team.name.toLowerCase().includes(query) ||
            team.members.some((login) => login.includes(query)),
    );
});

const questCount = computed(() => data.value?.quests.length ?? 0);

// Players and admins without a team, suggested when adding members.
const teamless = computed(() =>
    (data.value?.users ?? [])
        .filter((user) => user.role !== "NPC" && !user.team)
        .map((user) => user.login),
);

// Drops teams that no longer exist from the selection.
watch(data, () => {
    const names = new Set(data.value?.teams.map((team) => team.name));
    selected.value = selected.value.filter((name) => names.has(name));
});

function validatedCount(team: NonNullable<typeof data.value>["teams"][number]) {
    return Object.values(team.progress).filter(
        (entry) => entry.status === "VALIDATED",
    ).length;
}

async function createTeam() {
    const name = newTeam.value.trim();

    if (await apply({ teams: [{ name }] }, { success: t("admin.teams.created", { name }) })) {
        newTeam.value = "";
    }
}

function startRename(name: string) {
    renaming.value = name;
    renameValue.value = name;
}

async function rename(name: string) {
    const value = renameValue.value.trim();

    if (value && value !== name) {
        await apply({ teams: [{ name, rename: value }] });
    }

    renaming.value = null;
}

// Random names, never one a team already has. The admins' sandbox teams keep
// theirs.
const realTeams = computed(() => (data.value?.teams ?? []).filter((team) => !team.sandbox));

function freshNames(count: number) {
    return randomTeamNames(
        count,
        locale.value,
        (data.value?.teams ?? []).map((team) => team.name),
    );
}

function rerollName(name: string) {
    const [rename] = freshNames(1);
    return apply(
        { teams: [{ name, rename }] },
        { success: t("admin.teams.renamed", { old: name, name: rename! }) },
    );
}

function rerollAllNames() {
    const names = freshNames(realTeams.value.length);

    return apply(
        {
            teams: realTeams.value.map((team, index) => ({
                name: team.name,
                rename: names[index],
            })),
        },
        {
            confirm: t("admin.teams.rerollAllConfirm", { count: realTeams.value.length }),
            success: t("admin.teams.rerollAllDone", { count: realTeams.value.length }),
        },
    );
}

async function addMembers(team: string) {
    const logins = splitLogins(newMembers.value[team] ?? "");

    if (!logins.length) {
        return;
    }

    if (await apply({ teams: [{ name: team, members: logins }] })) {
        newMembers.value[team] = "";
    }
}

function removeMember(login: string) {
    return apply({ users: [{ login, team: null }] });
}

function newQrCode(name: string) {
    return apply(
        { teams: [{ name, newQrCode: true }] },
        {
            confirm: t("admin.teams.newQrConfirm", { name }),
            success: t("admin.teams.newQrDone", { name }),
        },
    );
}

function deleteTeams(names: string[]) {
    return apply(
        { teams: names.map((name) => ({ name, $delete: true as const })) },
        {
            confirm:
                names.length === 1
                    ? t("admin.teams.deleteOne", { name: names[0]! })
                    : t("admin.teams.deleteMany", { count: names.length }),
        },
    );
}

function toggleAll(event: Event) {
    selected.value = (event.target as HTMLInputElement).checked
        ? teams.value.map((team) => team.name)
        : [];
}
</script>

<template>
    <main v-if="data" class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.teams.title") }}</h1>
            </div>
            <form v-if="canEdit" class="row create" @submit.prevent="createTeam">
                <input
                    v-model="newTeam"
                    class="input grow"
                    :placeholder="t('admin.teams.newName')"
                    :aria-label="t('admin.teams.newName')"
                    maxlength="80"
                    required
                >
                <button class="btn btn-primary" :disabled="busy">{{ t("common.create") }}</button>
            </form>
        </header>

        <div v-if="canEdit" class="grid tools">
            <TeamGenerator />
            <AssignPanel />
        </div>

        <div class="row toolbar">
            <input
                v-model="search"
                type="search"
                class="input grow"
                :placeholder="t('admin.teams.search')"
                :aria-label="t('common.search')"
            >
            <label v-if="canEdit" class="row select-all">
                <input
                    type="checkbox"
                    class="checkbox"
                    :checked="!!teams.length && selected.length === teams.length"
                    @change="toggleAll"
                >
                {{ t("common.selectAll") }}
            </label>
            <button
                v-if="canEdit && selected.length"
                class="btn btn-danger"
                :disabled="busy"
                @click="deleteTeams(selected)"
            >
                {{ t("admin.teams.deleteSelection", { count: selected.length }) }}
            </button>
            <button
                v-if="canEdit && realTeams.length"
                class="btn btn-ghost"
                :disabled="busy"
                @click="rerollAllNames"
            >
                <Icon name="solar:refresh-bold-duotone" class="ico" aria-hidden="true" />
                {{ t("admin.teams.rerollAll") }}
            </button>
        </div>

        <p v-if="!data.teams.length" class="card empty">{{ t("admin.teams.empty") }}</p>
        <p v-else-if="!teams.length" class="card empty">{{ t("common.noResult") }}</p>

        <datalist id="teamless-players">
            <option v-for="login in teamless" :key="login" :value="login" />
        </datalist>

        <div class="grid teams">
            <article
                v-for="team in teams"
                :key="team.id"
                class="card team"
                :class="{ selected: selected.includes(team.name) }"
            >
                <div class="team-header">
                    <input
                        v-if="canEdit"
                        v-model="selected"
                        type="checkbox"
                        class="checkbox"
                        :value="team.name"
                        :aria-label="t('common.select', { name: team.name })"
                    >
                    <form
                        v-if="renaming === team.name"
                        class="row grow"
                        @submit.prevent="rename(team.name)"
                    >
                        <input
                            v-model="renameValue"
                            class="input grow"
                            :aria-label="t('admin.teams.newNameLabel')"
                            maxlength="80"
                            autofocus
                            required
                            @keydown.esc="renaming = null"
                        >
                        <button class="btn btn-small btn-primary" :disabled="busy">OK</button>
                    </form>
                    <h2 v-else class="grow team-name">
                        <button
                            v-if="canEdit"
                            class="name-button"
                            :title="t('admin.teams.rename')"
                            @click="startRename(team.name)"
                        >
                            {{ team.name }}
                        </button>
                        <template v-else>{{ team.name }}</template>
                        <span
                            v-if="team.sandbox"
                            class="badge badge-primary"
                            :title="t('admin.teams.sandbox')"
                        >
                            {{ t("common.admin") }}
                        </span>
                    </h2>
                    <button
                        v-if="canEdit && !team.sandbox && renaming !== team.name"
                        class="btn btn-small btn-ghost reroll"
                        :title="t('admin.teams.reroll')"
                        :aria-label="t('admin.teams.reroll')"
                        :disabled="busy"
                        @click="rerollName(team.name)"
                    >
                        <Icon name="solar:refresh-bold-duotone" class="ico" aria-hidden="true" />
                    </button>
                    <span class="badge badge-success" :title="t('admin.teams.validated', { count: validatedCount(team) })">
                        {{ validatedCount(team) }}/{{ questCount }}
                    </span>
                </div>

                <ul v-if="team.members.length" class="members">
                    <li v-for="login in team.members" :key="login" class="chip">
                        {{ login }}
                        <button
                            v-if="canEdit"
                            class="chip-remove"
                            :aria-label="t('admin.teams.removeMember', { login })"
                            :disabled="busy"
                            @click="removeMember(login)"
                        >
                            <Icon name="pixelarticons:close" class="ico" aria-hidden="true" />
                        </button>
                    </li>
                </ul>
                <p v-else class="muted small">{{ t("admin.teams.noMembers") }}</p>

                <form v-if="canEdit" class="row" @submit.prevent="addMembers(team.name)">
                    <input
                        v-model="newMembers[team.name]"
                        class="input grow"
                        list="teamless-players"
                        :placeholder="t('admin.teams.addPlaceholder')"
                        :aria-label="t('admin.teams.addLabel', { name: team.name })"
                        autocapitalize="none"
                        autocomplete="off"
                        spellcheck="false"
                    >
                    <button class="btn" :disabled="busy">{{ t("common.add") }}</button>
                </form>

                <div v-if="canEdit" class="row team-actions">
                    <a
                        :href="`/api/teams/${team.id}/qrcode`"
                        target="_blank"
                        class="btn btn-small"
                    >
                        {{ t("admin.teams.qrCode") }}
                    </a>
                    <button class="btn btn-small btn-ghost" :disabled="busy" @click="newQrCode(team.name)">
                        {{ t("admin.teams.newQrCode") }}
                    </button>
                    <button
                        class="btn btn-small btn-ghost-danger delete"
                        :disabled="busy"
                        @click="deleteTeams([team.name])"
                    >
                        {{ t("common.delete") }}
                    </button>
                </div>
            </article>
        </div>
    </main>
</template>

<style scoped>
.create {
    flex: 1 1 20rem;
    max-width: 28rem;
}

.tools {
    --min: 24rem;

    align-items: start;
}

.toolbar {
    gap: 0.75rem;
}

.select-all {
    gap: 0.4rem;
    font-size: 0.925rem;
    cursor: pointer;
}

.teams {
    --min: 20rem;
}

.team.selected {
    border-color: var(--primary);
}

.team-header {
    display: flex;
    align-items: center;
    gap: 0.6rem;
}

.team-header > .grow {
    flex: 1;
    min-width: 0;
}

.team-name .badge {
    margin-left: 0.4rem;
    vertical-align: middle;
}

.team-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.reroll {
    flex-shrink: 0;
    padding-inline: 0.45rem;
}

.name-button {
    padding: 0;
    border: none;
    background: none;
    color: inherit;
    font: inherit;
    cursor: text;
}

.name-button:hover {
    text-decoration: underline dotted;
}

.members {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.team-actions {
    gap: 0.35rem;
    padding-top: 0.75rem;
    border-top: 1px solid var(--border);
}

.delete {
    margin-left: auto;
}
</style>
