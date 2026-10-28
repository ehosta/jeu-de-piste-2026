<script setup lang="ts">
const { data } = await useAdminState();
const { busy, apply, toast } = useAdminPatch();
const { actAs: switchTo } = useActAs();
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
            npc.quests.some(
                (quest) =>
                    quest.key.includes(query) ||
                    quest.label.toLowerCase().includes(query),
            ),
    );
});

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

        <details class="card" :open="!data.npcs.length">
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

        <div class="grid npcs">
            <AdminNpcCard
                v-for="npc in npcs"
                :key="npc.id"
                :npc="npc"
                :quests="data?.quests ?? []"
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

.npcs {
    --min: 26rem;

    align-items: start;
}
</style>
