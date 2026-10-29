<script setup lang="ts">
const { data } = await useAdminState();
const { busy, apply, toast } = useAdminPatch();
const { actAs: switchTo } = useActAs();
const canEdit = useCanEdit();
const { t } = useI18n();

const search = ref("");
const newNpc = reactive({ login: "", name: "", lore: "" });

const npcs = computed(() => {
    const query = search.value.trim().toLowerCase();

    return (data.value?.npcs ?? []).filter(
        (npc) =>
            !query ||
            npc.name.toLowerCase().includes(query) ||
            npc.login.includes(query) ||
            !!npc.group?.toLowerCase().includes(query) ||
            npc.quests.some(
                (quest) =>
                    quest.key.includes(query) ||
                    quest.label.toLowerCase().includes(query),
            ),
    );
});

// NPCs of a group together, solo ones after them without any heading.
const groups = computed(() => {
    const byName = new Map<string, typeof npcs.value>();

    for (const npc of npcs.value) {
        if (npc.group) {
            byName.set(npc.group, [...(byName.get(npc.group) ?? []), npc]);
        }
    }

    return [...byName]
        .map(([name, members]) => ({ name, members }))
        .sort((a, b) => a.name.localeCompare(b.name));
});
const soloNpcs = computed(() => npcs.value.filter((npc) => !npc.group));
const groupNames = computed(() =>
    [...new Set((data.value?.npcs ?? []).flatMap((npc) => npc.group ?? []))].sort(),
);

function groupMates(npc: { id: string; group: string | null }) {
    return (data.value?.npcs ?? [])
        .filter((other) => other.group && other.group === npc.group && other.id !== npc.id)
        .map((other) => other.name);
}

function renameGroup(name: string) {
    const rename = window.prompt(t("admin.npcGroups.renamePrompt"), name)?.trim();

    if (rename && rename !== name) {
        return apply(
            { npcGroups: [{ name, rename }] },
            { success: t("admin.npcGroups.renamed", { name: rename }) },
        );
    }
}

function dissolveGroup(name: string) {
    return apply(
        { npcGroups: [{ name, $delete: true }] },
        {
            confirm: t("admin.npcGroups.dissolveConfirm", { name }),
            success: t("admin.npcGroups.dissolved", { name }),
        },
    );
}

async function createNpc() {
    const report = await apply(
        {
            npcs: [
                {
                    login: newNpc.login,
                    name: newNpc.name,
                    lore: newNpc.lore,
                },
            ],
        },
        { success: t("admin.npcs.created", { name: newNpc.name }) },
    );

    if (report) {
        Object.assign(newNpc, { login: "", name: "", lore: "" });
    }
}

async function actAs(npcId: string) {
    try {
        await switchTo({ role: "NPC", npcId });
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
                <h1>{{ t("admin.npcs.title") }}</h1>
            </div>
            <input
                v-model="search"
                type="search"
                class="input search"
                :placeholder="t('admin.npcs.search')"
                :aria-label="t('common.search')"
            >
        </header>

        <details v-if="canEdit" class="card" :open="!data.npcs.length">
            <summary><h2 class="summary-title">{{ t("admin.npcs.new") }}</h2></summary>
            <form class="stack" @submit.prevent="createNpc">
                <p class="muted small">{{ t("admin.npcs.newHint") }}</p>
                <div class="row">
                    <label class="field grow">
                        <span>{{ t("admin.npcs.login") }}</span>
                        <input
                            v-model="newNpc.login"
                            class="input"
                            autocapitalize="none"
                            spellcheck="false"
                            required
                        >
                    </label>
                    <label class="field grow">
                        <span>{{ t("admin.npcs.name") }}</span>
                        <input v-model="newNpc.name" class="input" maxlength="80" required>
                    </label>
                </div>
                <label class="field">
                    <span>{{ t("admin.npcs.lore") }}</span>
                    <textarea v-model="newNpc.lore" class="textarea" rows="3" />
                </label>
                <button class="btn btn-primary create" :disabled="busy">{{ t("admin.npcs.create") }}</button>
            </form>
        </details>

        <p v-if="!data.npcs.length" class="card empty">{{ t("admin.npcs.empty") }}</p>
        <p v-else-if="!npcs.length" class="card empty">{{ t("common.noResult") }}</p>

        <section v-for="group in groups" :key="group.name" class="stack npc-group">
            <div class="group-header">
                <div>
                    <h2>
                        <Icon name="solar:users-group-rounded-bold-duotone" class="ico" aria-hidden="true" />
                        {{ group.name }}
                    </h2>
                    <p class="muted small">
                        {{ t("admin.npcGroups.hint", { count: group.members.length }) }}
                    </p>
                </div>
                <div v-if="canEdit" class="row">
                    <button class="btn btn-small btn-ghost" :disabled="busy" @click="renameGroup(group.name)">
                        {{ t("admin.npcGroups.rename") }}
                    </button>
                    <button class="btn btn-small btn-ghost-danger" :disabled="busy" @click="dissolveGroup(group.name)">
                        {{ t("admin.npcGroups.dissolve") }}
                    </button>
                </div>
            </div>
            <div class="grid npcs">
                <AdminNpcCard
                    v-for="npc in group.members"
                    :key="npc.id"
                    :npc="npc"
                    :quests="data?.quests ?? []"
                    :groups="groupNames"
                    :group-mates="groupMates(npc)"
                    @act-as="actAs"
                />
            </div>
        </section>

        <div class="grid npcs">
            <AdminNpcCard
                v-for="npc in soloNpcs"
                :key="npc.id"
                :npc="npc"
                :quests="data?.quests ?? []"
                :groups="groupNames"
                :group-mates="[]"
                @act-as="actAs"
            />
        </div>
    </main>
</template>

<style scoped>
.search {
    flex: 1 1 16rem;
    max-width: 24rem;
}

.summary-title {
    display: inline;
}

details[open] summary {
    margin-bottom: 0.75rem;
}

.create {
    align-self: flex-start;
}

.npc-group {
    padding: 1rem;
    border: 2px dashed var(--frame-soft);
    border-radius: var(--radius-sm);
}

.group-header {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}

.group-header h2 {
    display: flex;
    align-items: center;
    gap: 0.4rem;
    margin: 0;
}

.npcs {
    --min: 26rem;

    align-items: start;
}
</style>
