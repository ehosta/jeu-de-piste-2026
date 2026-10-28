<script setup lang="ts">
import type { AdminState } from "~/composables/useAdmin";

const props = defineProps<{
    npc: AdminState["npcs"][number];
    // Every quest of the game, to give an existing one to this NPC too.
    quests: AdminState["quests"];
}>();
const emit = defineEmits<{ actAs: [npcId: string] }>();

const { busy, apply } = useAdminPatch();
const canEdit = useCanEdit();
const { t } = useI18n();

// Edits stay local until saved, and reset when the saved data changes.
const draft = reactive({ name: "", lore: "" });
const questDrafts = ref<
    Record<string, { label: string; answer: string; difficulty: number }>
>({});
const newQuest = reactive({ label: "", answer: "", difficulty: 1 });
const sharedKey = ref("");

// The quests this NPC doesn't give yet.
const otherQuests = computed(() => {
    const own = new Set(props.npc.quests.map((quest) => quest.key));
    return props.quests.filter((quest) => !own.has(quest.key));
});

const DIFFICULTIES = Array.from(
    { length: MAX_DIFFICULTY - MIN_DIFFICULTY + 1 },
    (_, index) => MIN_DIFFICULTY + index,
);
const editingQuest = ref<string | null>(null);

// A riddle cut short, to name its quest in a list or a message.
function shorten(label: string) {
    return label.length > 50 ? `${label.slice(0, 49)}…` : label;
}

watch(
    () => props.npc,
    (npc) => {
        draft.name = npc.name;
        draft.lore = npc.lore;
        questDrafts.value = Object.fromEntries(
            npc.quests.map((quest) => [quest.key, { ...quest }]),
        );
    },
    { immediate: true },
);

const dirty = computed(
    () => draft.name !== props.npc.name || draft.lore !== props.npc.lore,
);

function save() {
    return apply(
        { npcs: [{ login: props.npc.login, name: draft.name, lore: draft.lore }] },
        { success: t("admin.npcs.saved", { name: draft.name }) },
    );
}

async function saveQuest(key: string) {
    const quest = questDrafts.value[key];

    if (!quest) {
        return;
    }

    const report = await apply({
        quests: [
            {
                key,
                label: quest.label,
                answer: quest.answer,
                difficulty: quest.difficulty,
            },
        ],
    });

    if (report) {
        editingQuest.value = null;
    }
}

// A shared quest is only taken from this NPC; otherwise it is deleted.
function deleteQuest(quest: AdminState["npcs"][number]["quests"][number]) {
    return apply(
        { npcs: [{ login: props.npc.login, quests: [{ key: quest.key, $delete: true }] }] },
        {
            confirm: quest.sharedWith.length
                ? t("admin.npcs.unshareQuest", {
                    quest: shorten(quest.label),
                    name: props.npc.name,
                    others: quest.sharedWith.map((other) => other.name).join(", "),
                })
                : t("admin.npcs.deleteQuest", { quest: shorten(quest.label) }),
        },
    );
}

async function shareQuest() {
    const quest = props.quests.find((quest) => quest.key === sharedKey.value);
    const report = await apply(
        { npcs: [{ login: props.npc.login, quests: [{ key: sharedKey.value }] }] },
        {
            success: t("admin.npcs.shared", {
                quest: shorten(quest?.label ?? ""),
                name: props.npc.name,
            }),
        },
    );

    if (report) {
        sharedKey.value = "";
    }
}

async function addQuest() {
    const key = uniqueQuestKey(
        newQuest.label,
        props.quests.map((quest) => quest.key),
    );
    const report = await apply({
        npcs: [
            {
                login: props.npc.login,
                quests: [
                    {
                        key,
                        label: newQuest.label,
                        answer: newQuest.answer,
                        difficulty: newQuest.difficulty,
                    },
                ],
            },
        ],
    });

    if (report) {
        Object.assign(newQuest, { label: "", answer: "", difficulty: 1 });
    }
}

function deleteNpc() {
    return apply(
        { npcs: [{ login: props.npc.login, $delete: true }] },
        {
            confirm: t("admin.npcs.deleteNpc", {
                name: props.npc.name,
                count: props.npc.quests.filter((quest) => !quest.sharedWith.length).length,
                login: props.npc.login,
            }),
        },
    );
}
</script>

<template>
    <article class="card npc">
        <div class="card-header">
            <div>
                <h2>{{ npc.name }}</h2>
                <p class="muted small">
                    {{ npc.login }} · {{ t("admin.npcs.quests", { count: npc.quests.length }) }}
                </p>
            </div>
            <div v-if="canEdit" class="row">
                <button class="btn btn-small" @click="emit('actAs', npc.id)">
                    {{ t("admin.npcs.play") }}
                </button>
                <button class="btn btn-small btn-ghost-danger" :disabled="busy" @click="deleteNpc">
                    {{ t("common.delete") }}
                </button>
            </div>
        </div>

        <form v-if="canEdit" class="stack" @submit.prevent="save">
            <label class="field">
                <span>{{ t("admin.npcs.nameField") }}</span>
                <input v-model="draft.name" class="input" maxlength="80" required>
            </label>
            <label class="field">
                <span>{{ t("admin.npcs.lore") }}</span>
                <textarea v-model="draft.lore" class="textarea" rows="3" />
            </label>
            <button v-if="dirty" class="btn btn-primary save" :disabled="busy">
                {{ t("common.save") }}
            </button>
        </form>

        <p v-else-if="npc.lore" class="lore">{{ npc.lore }}</p>

        <div class="stack quests">
            <h3>{{ t("admin.npcs.questsTitle") }}</h3>
            <p v-if="!npc.quests.length" class="muted small">{{ t("admin.npcs.noQuest") }}</p>

            <div v-for="quest in npc.quests" :key="quest.key" class="quest">
                <form
                    v-if="editingQuest === quest.key && questDrafts[quest.key]"
                    class="stack"
                    @submit.prevent="saveQuest(quest.key)"
                >
                    <label class="field">
                        <span>{{ t("admin.npcs.riddle") }}</span>
                        <textarea v-model="questDrafts[quest.key]!.label" class="textarea" rows="2" required />
                    </label>
                    <label class="field">
                        <span>{{ t("admin.npcs.answer") }}</span>
                        <input v-model="questDrafts[quest.key]!.answer" class="input" required>
                    </label>
                    <label class="field">
                        <span>{{ t("admin.npcs.difficulty") }}</span>
                        <select v-model.number="questDrafts[quest.key]!.difficulty" class="select">
                            <option v-for="value in DIFFICULTIES" :key="value" :value="value">
                                {{ stars(value) }}
                            </option>
                        </select>
                    </label>
                    <div class="row">
                        <button class="btn btn-small btn-primary" :disabled="busy">{{ t("common.save") }}</button>
                        <button type="button" class="btn btn-small btn-ghost" @click="editingQuest = null">
                            {{ t("common.cancel") }}
                        </button>
                    </div>
                </form>

                <template v-else>
                    <div class="quest-text">
                        <span
                            class="stars"
                            :title="t('admin.npcs.difficultyTitle', { count: quest.difficulty })"
                        >
                            {{ stars(quest.difficulty) }}
                        </span>
                        <p>{{ quest.label }}</p>
                        <p v-if="quest.sharedWith.length" class="small shared">
                            ⇄ {{
                                t("admin.npcs.sharedWith", {
                                    names: quest.sharedWith.map((other) => other.name).join(", "),
                                })
                            }}
                        </p>
                        <p class="muted small">{{ t("admin.npcs.answerShort", { answer: quest.answer }) }}</p>
                    </div>
                    <div v-if="canEdit" class="row quest-actions">
                        <button class="btn btn-small btn-ghost" @click="editingQuest = quest.key">
                            {{ t("common.edit") }}
                        </button>
                        <button
                            class="btn btn-small btn-ghost-danger"
                            :disabled="busy"
                            @click="deleteQuest(quest)"
                        >
                            {{ quest.sharedWith.length ? t("admin.npcs.unshare") : t("common.delete") }}
                        </button>
                    </div>
                </template>
            </div>

            <details v-if="canEdit && otherQuests.length" class="new-quest">
                <summary>{{ t("admin.npcs.shareQuest") }}</summary>
                <form class="stack" @submit.prevent="shareQuest">
                    <p class="muted small">{{ t("admin.npcs.shareHint") }}</p>
                    <label class="field">
                        <span>{{ t("admin.npcs.existingQuest") }}</span>
                        <select v-model="sharedKey" class="select" required>
                            <option value="" disabled>{{ t("admin.npcs.pickQuest") }}</option>
                            <option v-for="quest in otherQuests" :key="quest.key" :value="quest.key">
                                {{ shorten(quest.label) }} · {{ quest.npcs.join(", ") }}
                            </option>
                        </select>
                    </label>
                    <button class="btn btn-primary save" :disabled="busy || !sharedKey">
                        {{ t("admin.npcs.shareButton") }}
                    </button>
                </form>
            </details>

            <details v-if="canEdit" class="new-quest">
                <summary>{{ t("admin.npcs.addQuest") }}</summary>
                <form class="stack" @submit.prevent="addQuest">
                    <label class="field">
                        <span>{{ t("admin.npcs.riddle") }}</span>
                        <textarea v-model="newQuest.label" class="textarea" rows="2" required />
                    </label>
                    <label class="field">
                        <span>{{ t("admin.npcs.answer") }}</span>
                        <input v-model="newQuest.answer" class="input" required>
                    </label>
                    <label class="field">
                        <span>{{ t("admin.npcs.difficulty") }}</span>
                        <select v-model.number="newQuest.difficulty" class="select">
                            <option v-for="value in DIFFICULTIES" :key="value" :value="value">
                                {{ stars(value) }}
                            </option>
                        </select>
                    </label>
                    <button class="btn btn-primary save" :disabled="busy">{{ t("admin.npcs.addQuestButton") }}</button>
                </form>
            </details>
        </div>
    </article>
</template>

<style scoped>
.lore {
    white-space: pre-line;
}

.save {
    align-self: flex-start;
}

.quests {
    padding-top: 1rem;
    border-top: 1px solid var(--border);
}

.quest {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.75rem;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.quest > form {
    flex: 1;
}

.quest-text {
    display: flex;
    flex-direction: column;
    flex: 1 1 14rem;
    gap: 0.25rem;
    min-width: 0;
}

.stars {
    color: var(--gold);
    letter-spacing: 0.08em;
}

.shared {
    color: var(--primary);
}

.new-quest summary {
    color: var(--primary);
    font-weight: 600;
    cursor: pointer;
}

.new-quest form {
    margin-top: 0.75rem;
}
</style>
