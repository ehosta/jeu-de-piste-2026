<script setup lang="ts">
import { MAX_LORE_LENGTH } from "#shared/utils/admin-patch";

// The story behind the "Lore" button of the header, rewritten here and pushed
// live to every screen (the patch publishes "game"). Bocal only read it.
const { data } = await useAdminState();
const { busy, apply } = useAdminPatch();
const canEdit = useCanEdit();
const { t } = useI18n();

const saved = computed(() => data.value?.game.lore ?? null);
const text = ref(saved.value ?? t("lore.default"));

// Another admin saving meanwhile: their text, unless this one is being edited.
const dirty = computed(() => text.value !== (saved.value ?? t("lore.default")));

watch(saved, (value) => {
    if (!dirty.value) {
        text.value = value ?? t("lore.default");
    }
});

function save() {
    return apply({ game: { lore: text.value } }, { success: t("admin.lore.saved") });
}

async function reset() {
    const report = await apply(
        { game: { lore: null } },
        { confirm: t("admin.lore.resetConfirm"), success: t("admin.lore.resetDone") },
    );

    if (report) {
        text.value = t("lore.default");
    }
}
</script>

<template>
    <main v-if="data" class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.lore.title") }}</h1>
                <p class="muted">{{ t("admin.lore.text") }}</p>
            </div>
        </header>

        <div class="lore-grid">
            <form class="card stack" @submit.prevent="save">
                <p v-if="saved === null" class="notice">{{ t("admin.lore.isDefault") }}</p>

                <label class="field">
                    <span>{{ t("admin.lore.label") }}</span>
                    <textarea
                        v-model="text"
                        class="textarea"
                        rows="16"
                        :maxlength="MAX_LORE_LENGTH"
                        :readonly="!canEdit"
                    />
                    <span class="muted small length">
                        {{ t("admin.lore.length", { count: text.length, max: MAX_LORE_LENGTH }) }}
                    </span>
                </label>

                <div v-if="canEdit" class="actions">
                    <button class="btn btn-primary" :disabled="busy || !text.trim() || !dirty">
                        {{ t("admin.lore.save") }}
                    </button>
                    <button
                        type="button"
                        class="btn btn-ghost"
                        :disabled="busy || saved === null"
                        @click="reset"
                    >
                        {{ t("admin.lore.reset") }}
                    </button>
                </div>
            </form>

            <section class="stack">
                <h2>{{ t("admin.lore.preview") }}</h2>
                <div class="dialogue preview">
                    <span class="dialogue-speaker">{{ t("lore.speaker") }}</span>
                    <h3 class="preview-title">{{ t("lore.title") }}</h3>
                    <LoreText :text="text" />
                </div>
            </section>
        </div>
    </main>
</template>

<style scoped>
.lore-grid {
    display: grid;
    gap: 1.5rem;
    align-items: start;
}

@media (min-width: 64rem) {
    .lore-grid {
        grid-template-columns: 1fr 1fr;
    }
}

.length {
    align-self: flex-end;
}

.preview {
    display: flex;
    flex-direction: column;
    gap: 0.85rem;
    margin-top: 1rem;
}

.preview-title {
    color: var(--dialogue-gold);
}
</style>
