<script setup lang="ts">
// The NPC's own card: the name the players see (editable) and the quests they
// give, with the NPCs they share them with.
const { data: npc, refresh } = await useFetch("/api/npc/me");
const { t } = useI18n();

const editing = ref(false);
const name = ref("");
const saving = ref(false);
const error = ref("");

function startEditing() {
    name.value = npc.value?.name ?? "";
    error.value = "";
    editing.value = true;
}

async function save() {
    saving.value = true;
    error.value = "";

    try {
        await $fetch("/api/npc/me", { method: "PATCH", body: { name: name.value } });
        await refresh();
        editing.value = false;
    } catch {
        error.value = t("npcProfile.saveError");
    } finally {
        saving.value = false;
    }
}
</script>

<template>
    <section v-if="npc" class="card stack">
        <p class="eyebrow">{{ t("npcProfile.eyebrow") }}</p>

        <form v-if="editing" class="row name-form" @submit.prevent="save">
            <input
                v-model="name"
                class="input grow"
                maxlength="80"
                required
                :aria-label="t('npcProfile.nameLabel')"
            >
            <button class="btn btn-primary" :disabled="saving">{{ t("common.save") }}</button>
            <button type="button" class="btn btn-ghost" @click="editing = false">
                {{ t("common.cancel") }}
            </button>
        </form>
        <div v-else class="row name-row">
            <h2>{{ npc.name }}</h2>
            <button class="btn btn-small btn-ghost" @click="startEditing">
                ✎ {{ t("npcProfile.rename") }}
            </button>
        </div>
        <p v-if="error" class="notice notice-error" role="alert">{{ error }}</p>
        <p class="muted small">{{ t("npcProfile.nameHint") }}</p>

        <h3>{{ t("npcProfile.questsTitle") }}</h3>
        <p v-if="!npc.quests.length" class="muted small">{{ t("npcProfile.noQuest") }}</p>
        <ul v-else class="quests">
            <li v-for="quest in npc.quests" :key="quest.id" class="quest">
                <span class="stars">{{ stars(quest.difficulty) }}</span>
                <p>{{ quest.label }}</p>
                <p class="muted small">{{ t("admin.npcs.answerShort", { answer: quest.answer }) }}</p>
                <p v-if="quest.sharedWith.length" class="small shared">
                    ⇄ {{ t("admin.npcs.sharedWith", { names: quest.sharedWith.join(", ") }) }}
                </p>
            </li>
        </ul>
    </section>
</template>

<style scoped>
.name-row {
    align-items: center;
    gap: 0.5rem;
}

.name-row h2 {
    margin: 0;
}

.name-form {
    gap: 0.5rem;
}

.grow {
    flex: 1 1 12rem;
}

.quests {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.quest {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.quest p {
    margin: 0;
}

.stars {
    color: var(--gold);
    letter-spacing: 0.08em;
}

.shared {
    color: var(--primary);
}
</style>
