<script setup lang="ts">
import type { AdminPatch } from "#shared/utils/admin-patch";

const { data } = await useAdminState();
const { busy, apply, toast } = useAdminPatch();
const { t } = useI18n();

const CONFIRM_WORD = computed(() => t("admin.maintenance.wipeAll.word"));
const confirmWord = ref("");

const counts = computed(() => {
    const users = data.value?.users ?? [];
    const teams = data.value?.teams ?? [];

    return {
        progress: teams.reduce(
            (total, team) => total + Object.keys(team.progress).length,
            0,
        ),
        teams: teams.length,
        players: users.filter((user) => user.role === "PLAYER").length,
        npcs: data.value?.npcs.length ?? 0,
        quests: data.value?.quests.length ?? 0,
    };
});

// `key` names the action's texts (admin.maintenance.actions.<key> in app/i18n).
const ACTIONS: {
    key: "progress" | "qrCodes" | "teams" | "players" | "quests" | "npcs";
    count: keyof typeof counts.value;
    patch: () => AdminPatch;
}[] = [
    {
        key: "progress",
        count: "progress",
        patch: () => ({ wipe: ["progress"] }),
    },
    {
        key: "qrCodes",
        count: "teams",
        patch: () => ({
            teams: (data.value?.teams ?? []).map((team) => ({
                name: team.name,
                newQrCode: true,
            })),
        }),
    },
    {
        key: "teams",
        count: "teams",
        patch: () => ({ wipe: ["teams"] }),
    },
    {
        key: "players",
        count: "players",
        patch: () => ({ wipe: ["players"] }),
    },
    {
        key: "quests",
        count: "quests",
        patch: () => ({ wipe: ["quests"] }),
    },
    {
        key: "npcs",
        count: "npcs",
        patch: () => ({ wipe: ["npcs"] }),
    },
];

function run(action: (typeof ACTIONS)[number]) {
    return apply(action.patch(), {
        confirm: t("admin.maintenance.confirm", {
            label: t(`admin.maintenance.actions.${action.key}.label`),
            description: t(`admin.maintenance.actions.${action.key}.description`),
        }),
    });
}

// prefill.json (admins, volunteer NPCs and their quests…), without its game
// state. Entries already there get the prefill's values back.
async function reapplyPrefill() {
    if (
        !window.confirm(t("admin.maintenance.prefill.confirm"))
    ) {
        return;
    }

    busy.value = true;

    try {
        const report = await $fetch("/api/admin/prefill", { method: "POST" });
        await refreshNuxtData(["admin-state", "admin-views"]);
        toast.value = { tone: "success", text: describeReport(report, t) };
    } catch (error) {
        toast.value = toastFromError(error, t);
    } finally {
        busy.value = false;
    }
}

async function wipeAll() {
    const report = await apply(
        { wipe: ["progress", "quests", "npcs", "teams", "players"] },
        { success: t("admin.maintenance.wipeAll.done") },
    );

    if (report) {
        confirmWord.value = "";
    }
}
</script>

<template>
    <main v-if="data" class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.maintenance.title") }}</h1>
                <p class="muted">{{ t("admin.maintenance.text") }}</p>
            </div>
        </header>

        <section class="card list">
            <div v-for="action in ACTIONS" :key="action.key" class="action">
                <div class="stack action-text">
                    <h3>{{ t(`admin.maintenance.actions.${action.key}.label`) }}</h3>
                    <p class="muted small">
                        {{ t(`admin.maintenance.actions.${action.key}.description`) }}
                    </p>
                </div>
                <button
                    class="btn btn-ghost-danger"
                    :disabled="busy || !counts[action.count]"
                    @click="run(action)"
                >
                    {{
                        counts[action.count]
                            ? t("admin.maintenance.run", { count: counts[action.count] })
                            : t("admin.maintenance.nothingToDo")
                    }}
                </button>
            </div>
        </section>

        <section class="card">
            <div class="action">
                <div class="stack action-text">
                    <h3>{{ t("admin.maintenance.prefill.title") }}</h3>
                    <p class="muted small">
                        <I18nText path="admin.maintenance.prefill.text">
                            <template #file><code>prefill.json</code></template>
                        </I18nText>
                    </p>
                </div>
                <button class="btn" :disabled="busy" @click="reapplyPrefill">
                    {{ t("admin.maintenance.prefill.button") }}
                </button>
            </div>
        </section>

        <section class="card danger">
            <h2>{{ t("admin.maintenance.wipeAll.title") }}</h2>
            <p class="muted">
                {{ t("admin.maintenance.wipeAll.textStart") }}
                <strong>{{ CONFIRM_WORD }}</strong>
                {{ t("admin.maintenance.wipeAll.textEnd") }}
            </p>
            <form class="row" @submit.prevent="wipeAll">
                <input
                    v-model="confirmWord"
                    class="input grow"
                    :placeholder="CONFIRM_WORD"
                    :aria-label="t('admin.maintenance.wipeAll.wordLabel')"
                    autocomplete="off"
                >
                <button class="btn btn-danger" :disabled="busy || confirmWord !== CONFIRM_WORD">
                    {{ t("admin.maintenance.wipeAll.button") }}
                </button>
            </form>
        </section>
    </main>
</template>

<style scoped>
.list {
    gap: 0;
    padding-block: 0.5rem;
}

.action {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1.5rem;
    padding-block: 1rem;
    border-bottom: 1px solid var(--border);
}

.action:last-child {
    border-bottom: none;
}

.action-text {
    --gap: 0.25rem;

    flex: 1 1 20rem;
}

.danger {
    border-color: var(--danger);
    background: linear-gradient(var(--danger-soft), var(--danger-soft)) top / 100% 0.35rem no-repeat,
        var(--surface);
}
</style>
