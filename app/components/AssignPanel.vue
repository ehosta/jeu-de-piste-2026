<script setup lang="ts">
// The people to put in a team: players without one, and the 42 accounts kept
// out because they logged in once the game was running. An admin puts the
// selected ones in an existing team, or forms a new one with a random name.
const { data } = await useAdminState();
const { busy, apply } = useAdminPatch();
const { locale, t, formatDateTime } = useI18n();

const selected = ref<string[]>([]);
const targetTeam = ref("");
const newTeamName = ref("");

const people = computed(() => [
    ...(data.value?.waiting ?? []).map((user) => ({
        login: user.login,
        blocked: true,
        seenAt: user.lastSeenAt as string | null,
    })),
    ...(data.value?.users ?? [])
        .filter((user) => user.role === "PLAYER" && !user.team)
        .map((user) => ({
            login: user.login,
            blocked: false,
            seenAt: user.lastLoginAt as string | null,
        })),
]);

const takenNames = computed(() => (data.value?.teams ?? []).map((team) => team.name));

function rerollName() {
    newTeamName.value = randomTeamNames(1, locale.value, takenNames.value)[0]!;
}

watch(
    people,
    () => {
        const logins = new Set(people.value.map((person) => person.login));
        selected.value = selected.value.filter((login) => logins.has(login));
    },
    { immediate: true },
);

onMounted(rerollName);

function toggleAll(event: Event) {
    selected.value = (event.target as HTMLInputElement).checked
        ? people.value.map((person) => person.login)
        : [];
}

// Unknown logins (the blocked accounts) are created as players.
async function placeInTeam() {
    const count = selected.value.length;

    if (
        await apply(
            { teams: [{ name: targetTeam.value, members: selected.value }] },
            { success: t("admin.assign.placed", { count, team: targetTeam.value }) },
        )
    ) {
        selected.value = [];
    }
}

async function formTeam() {
    const name = newTeamName.value.trim();

    if (
        await apply(
            { teams: [{ name, members: selected.value }] },
            { success: t("admin.assign.formed", { name }) },
        )
    ) {
        selected.value = [];
        rerollName();
    }
}

// Lets a blocked account in, without a team for now.
function admit(login: string) {
    return apply(
        { users: [{ login, role: "PLAYER" }] },
        { success: t("admin.assign.admitted", { login }) },
    );
}
</script>

<template>
    <section v-if="data" class="card assign">
        <div class="card-header">
            <h2>{{ t("admin.assign.title") }}</h2>
            <span class="badge" :class="people.length ? 'badge-warning' : 'badge-success'">
                {{ people.length }}
            </span>
        </div>
        <p class="muted small">{{ t("admin.assign.text") }}</p>

        <p v-if="!people.length" class="muted small">{{ t("admin.assign.empty") }}</p>

        <template v-else>
            <label class="row select-all">
                <input
                    type="checkbox"
                    class="checkbox"
                    :checked="selected.length === people.length"
                    :indeterminate="!!selected.length && selected.length < people.length"
                    @change="toggleAll"
                >
                {{ t("common.selectAll") }}
            </label>

            <ul class="people">
                <li v-for="person in people" :key="person.login">
                    <label class="row person">
                        <input
                            v-model="selected"
                            type="checkbox"
                            class="checkbox"
                            :value="person.login"
                        >
                        <strong>{{ person.login }}</strong>
                        <span
                            class="badge"
                            :class="person.blocked ? 'badge-danger' : 'badge-info'"
                        >
                            {{ person.blocked ? t("admin.assign.blocked") : t("admin.assign.noTeam") }}
                        </span>
                        <span class="muted small grow">{{ formatDateTime(person.seenAt) }}</span>
                    </label>
                    <button
                        v-if="person.blocked"
                        class="btn btn-small btn-ghost"
                        :disabled="busy"
                        @click="admit(person.login)"
                    >
                        {{ t("admin.assign.admit") }}
                    </button>
                </li>
            </ul>

            <div class="stack actions-box" :class="{ disabled: !selected.length }">
                <strong class="small">
                    {{ t("common.selected", { count: selected.length }) }}
                </strong>
                <form class="row" @submit.prevent="placeInTeam">
                    <select
                        v-model="targetTeam"
                        class="select grow"
                        :aria-label="t('admin.assign.existingTeam')"
                        required
                    >
                        <option value="" disabled>{{ t("admin.assign.existingTeam") }}</option>
                        <option
                            v-for="team in data.teams.filter((team) => !team.sandbox)"
                            :key="team.id"
                            :value="team.name"
                        >
                            {{ team.name }} ({{ team.members.length }})
                        </option>
                    </select>
                    <button class="btn" :disabled="busy || !selected.length || !targetTeam">
                        {{ t("admin.assign.place") }}
                    </button>
                </form>
                <form class="row" @submit.prevent="formTeam">
                    <input
                        v-model="newTeamName"
                        class="input grow"
                        :aria-label="t('admin.assign.newTeamName')"
                        maxlength="80"
                        required
                    >
                    <button
                        type="button"
                        class="btn btn-ghost"
                        :title="t('admin.assign.otherName')"
                        :aria-label="t('admin.assign.otherName')"
                        @click="rerollName"
                    >
                        🎲
                    </button>
                    <button class="btn btn-primary" :disabled="busy || !selected.length">
                        {{ t("admin.assign.form") }}
                    </button>
                </form>
            </div>
        </template>
    </section>
</template>

<style scoped>
.select-all {
    gap: 0.5rem;
    font-size: 0.925rem;
    cursor: pointer;
}

.people {
    display: flex;
    flex-direction: column;
    max-height: 22rem;
    margin: 0;
    padding: 0;
    overflow-y: auto;
    list-style: none;
    scrollbar-width: thin;
}

.people li {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-block: 0.4rem;
    border-bottom: 1px dashed var(--border);
}

.people li:last-child {
    border-bottom: none;
}

.person {
    flex: 1;
    gap: 0.6rem;
    cursor: pointer;
}

.actions-box {
    --gap: 0.6rem;

    padding: 0.85rem;
    border: 2px dashed var(--frame-soft);
    border-radius: var(--radius-sm);
}

.actions-box.disabled {
    opacity: 0.7;
}
</style>
