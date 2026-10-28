<script setup lang="ts">
import type { Role } from "~~/prisma/generated/enums";

const { data } = await useAdminState();
const { busy, apply, toast } = useAdminPatch();
const { actAs } = useActAs();
const { t, formatDateTime } = useI18n();
const route = useRoute();

// "Gérer ce compte", from the banner shown while acting as someone.
const search = ref(String(route.query.q ?? ""));

watch(
    () => route.query.q,
    (q) => (search.value = String(q ?? "")),
);
const roleFilter = ref<Role | "">("");
const selected = ref<string[]>([]);
const bulkTeam = ref("");

const newLogins = ref("");
const newRole = ref<Role>("PLAYER");
const newTeam = ref("");

const users = computed(() => {
    const query = search.value.trim().toLowerCase();

    return (data.value?.users ?? []).filter(
        (user) =>
            (!roleFilter.value || user.role === roleFilter.value) &&
            (!query ||
                user.login.includes(query) ||
                user.team?.toLowerCase().includes(query)),
    );
});

const selectableLogins = computed(() =>
    users.value
        .filter((user) => user.login !== data.value?.me && !user.owner)
        .map((user) => user.login),
);

watch(data, () => {
    const logins = new Set(data.value?.users.map((user) => user.login));
    selected.value = selected.value.filter((login) => logins.has(login));
});

async function addUsers() {
    const logins = splitLogins(newLogins.value);

    if (!logins.length) {
        return;
    }

    const team = newRole.value !== "NPC" && newTeam.value ? newTeam.value : undefined;
    const report = await apply({
        users: logins.map((login) => ({ login, role: newRole.value, team })),
    });

    if (report) {
        newLogins.value = "";
    }
}

function setTeam(login: string, team: string | null) {
    return apply({ users: [{ login, team }] });
}

function setRole(login: string, role: Role) {
    return apply(
        { users: [{ login, role }] },
        {
            confirm:
                role === "ADMIN"
                    ? t("admin.users.promoteConfirm", { login })
                    : undefined,
        },
    );
}

function bulk(changes: { role?: Role; team?: string | null }) {
    return apply({
        users: selected.value.map((login) => ({ login, ...changes })),
    });
}

function deleteUsers(logins: string[]) {
    return apply(
        { users: logins.map((login) => ({ login, $delete: true as const })) },
        {
            confirm:
                logins.length === 1
                    ? t("admin.users.deleteOne", { login: logins[0]! })
                    : t("admin.users.deleteMany", { count: logins.length }),
        },
    );
}

async function impersonate(userId: string) {
    try {
        await actAs({ role: "USER", userId });
    } catch (error) {
        toast.value = toastFromError(error, t);
    }
}

function toggleAll(event: Event) {
    selected.value = (event.target as HTMLInputElement).checked
        ? selectableLogins.value
        : [];
}
</script>

<template>
    <main v-if="data" class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.users.title") }}</h1>
            </div>
        </header>

        <form class="card add" @submit.prevent="addUsers">
            <h2>{{ t("admin.users.addTitle") }}</h2>
            <label class="field">
                <span>{{ t("admin.users.logins") }}</span>
                <textarea
                    v-model="newLogins"
                    class="textarea"
                    rows="2"
                    :placeholder="t('admin.users.loginsPlaceholder')"
                    autocapitalize="none"
                    spellcheck="false"
                    required
                />
            </label>
            <div class="row">
                <label class="field grow">
                    <span>{{ t("admin.users.role") }}</span>
                    <select v-model="newRole" class="select">
                        <option v-for="role in ROLES_ORDER" :key="role" :value="role">
                            {{ t(`roles.${role}`) }}
                        </option>
                    </select>
                </label>
                <label v-if="newRole !== 'NPC'" class="field grow">
                    <span>{{ t("admin.users.team") }}</span>
                    <select v-model="newTeam" class="select">
                        <option value="">{{ t("common.noTeam") }}</option>
                        <option v-for="team in data.teams" :key="team.id" :value="team.name">
                            {{ team.name }}
                        </option>
                    </select>
                </label>
            </div>
            <p v-if="newRole === 'NPC'" class="muted small">{{ t("admin.users.npcHint") }}</p>
            <button class="btn btn-primary add-button" :disabled="busy">{{ t("common.add") }}</button>
        </form>

        <div class="row toolbar">
            <input
                v-model="search"
                type="search"
                class="input grow"
                :placeholder="t('admin.users.search')"
                :aria-label="t('common.search')"
            >
            <select v-model="roleFilter" class="select role-filter" :aria-label="t('admin.users.filterRole')">
                <option value="">{{ t("admin.users.allRoles") }}</option>
                <option v-for="role in ROLES_ORDER" :key="role" :value="role">
                    {{ t(`roles.${role}`) }}
                </option>
            </select>
        </div>

        <div v-if="selected.length" class="card bulk">
            <strong>{{ t("common.selected", { count: selected.length }) }}</strong>
            <div class="row">
                <select v-model="bulkTeam" class="select select-small" :aria-label="t('admin.users.team')">
                    <option value="">{{ t("admin.users.chooseTeam") }}</option>
                    <option v-for="team in data.teams" :key="team.id" :value="team.name">
                        {{ team.name }}
                    </option>
                </select>
                <button
                    class="btn btn-small"
                    :disabled="busy || !bulkTeam"
                    @click="bulk({ team: bulkTeam })"
                >
                    {{ t("admin.users.putInTeam") }}
                </button>
                <button class="btn btn-small" :disabled="busy" @click="bulk({ team: null })">
                    {{ t("admin.users.removeFromTeam") }}
                </button>
                <button class="btn btn-small" :disabled="busy" @click="bulk({ role: 'PLAYER' })">
                    {{ t("admin.users.makePlayers") }}
                </button>
                <button
                    class="btn btn-small btn-danger"
                    :disabled="busy"
                    @click="deleteUsers(selected)"
                >
                    {{ t("common.delete") }}
                </button>
                <button class="btn btn-small btn-ghost" @click="selected = []">
                    {{ t("common.deselect") }}
                </button>
            </div>
        </div>

        <p v-if="!users.length" class="card empty">{{ t("admin.users.empty") }}</p>
        <div v-else class="table-wrap">
            <table class="table">
                <thead>
                    <tr>
                        <th>
                            <input
                                type="checkbox"
                                class="checkbox"
                                :aria-label="t('common.selectAll')"
                                :checked="!!selectableLogins.length && selected.length === selectableLogins.length"
                                @change="toggleAll"
                            >
                        </th>
                        <th>{{ t("admin.users.login") }}</th>
                        <th>{{ t("admin.users.role") }}</th>
                        <th>{{ t("admin.users.team") }}</th>
                        <th>{{ t("admin.users.lastLogin") }}</th>
                        <th />
                    </tr>
                </thead>
                <tbody>
                    <tr
                        v-for="user in users"
                        :key="user.login"
                        :class="{ selected: selected.includes(user.login) }"
                    >
                        <td>
                            <input
                                v-model="selected"
                                type="checkbox"
                                class="checkbox"
                                :value="user.login"
                                :disabled="user.login === data.me || user.owner"
                                :aria-label="t('common.select', { name: user.login })"
                            >
                        </td>
                        <td>
                            <strong>{{ user.login }}</strong>
                            <span v-if="user.login === data.me" class="muted small"> ({{ t("common.you") }})</span>
                            <span v-if="user.owner" class="muted small"> · {{ t("common.owner") }}</span>
                            <span v-if="user.npc && user.role !== 'NPC'" class="muted small">
                                · {{ t("admin.users.npc", { name: user.npc }) }}
                            </span>
                        </td>
                        <td>
                            <select
                                class="select select-small"
                                :value="user.role"
                                :disabled="busy || user.login === data.me || user.owner"
                                :aria-label="t('admin.users.roleOf', { login: user.login })"
                                @change="setRole(user.login, ($event.target as HTMLSelectElement).value as Role)"
                            >
                                <option v-for="role in ROLES_ORDER" :key="role" :value="role">
                                    {{ t(`roles.${role}`) }}
                                </option>
                            </select>
                        </td>
                        <td>
                            <select
                                v-if="user.role !== 'NPC'"
                                class="select select-small"
                                :value="user.team ?? ''"
                                :disabled="busy"
                                :aria-label="t('admin.users.teamOf', { login: user.login })"
                                @change="setTeam(user.login, ($event.target as HTMLSelectElement).value || null)"
                            >
                                <option value="">{{ t("common.noTeam") }}</option>
                                <option v-for="team in data.teams" :key="team.id" :value="team.name">
                                    {{ team.name }}
                                </option>
                            </select>
                            <span v-else class="muted">—</span>
                        </td>
                        <td class="muted">{{ formatDateTime(user.lastLoginAt) }}</td>
                        <td class="row-actions">
                            <button
                                v-if="user.login !== data.me"
                                class="btn btn-small btn-ghost"
                                :title="t('admin.users.impersonateTitle', { login: user.login })"
                                @click="impersonate(user.id)"
                            >
                                {{ t("common.impersonate") }}
                            </button>
                            <button
                                v-if="user.login !== data.me && !user.owner"
                                class="btn btn-small btn-ghost-danger"
                                :disabled="busy"
                                @click="deleteUsers([user.login])"
                            >
                                {{ t("common.delete") }}
                            </button>
                        </td>
                    </tr>
                </tbody>
            </table>
        </div>
    </main>
</template>

<style scoped>
.add .row {
    align-items: flex-end;
}

.add-button {
    align-self: flex-start;
}

.role-filter {
    width: auto;
}

.row-actions {
    text-align: right;
}

.bulk {
    position: sticky;
    top: calc(var(--header-height) + 4rem);
    z-index: 3;
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.75rem 1rem;
    padding: 0.85rem 1rem;
    border-color: var(--primary);
}

@media (min-width: 64rem) {
    .bulk {
        top: calc(var(--header-height) + 1rem);
    }
}
</style>
