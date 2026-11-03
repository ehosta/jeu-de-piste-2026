<script setup lang="ts">
// The "Lore" button of the header: the game's story in a dialogue box, for
// everyone, logged in or not. It follows the admins' edits live.
const { t } = useI18n();
const lore = useLore();
const open = ref(false);

function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
        open.value = false;
    }
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
    <button
        class="btn btn-small btn-ghost lore-button"
        :title="t('lore.open')"
        :aria-label="t('lore.open')"
        @click="open = true"
    >
        <Icon name="solar:book-bookmark-bold-duotone" class="ico" aria-hidden="true" />
        <span class="lore-label">{{ t("lore.button") }}</span>
    </button>

    <Teleport to="body">
        <div
            v-if="open"
            class="lore-overlay"
            role="dialog"
            aria-modal="true"
            :aria-label="t('lore.title')"
            @click.self="open = false"
        >
            <div class="dialogue lore-dialogue">
                <span class="dialogue-speaker">
                    <Icon name="solar:book-bookmark-bold-duotone" class="ico" aria-hidden="true" />
                    {{ t("lore.speaker") }}
                </span>
                <h2 class="lore-title">{{ t("lore.title") }}</h2>
                <LoreText :text="lore" class="lore-body" />
                <button class="btn btn-primary btn-block" autofocus @click="open = false">
                    {{ t("lore.close") }}
                </button>
            </div>
        </div>
    </Teleport>
</template>

<style scoped>
.lore-button {
    flex-shrink: 0;
    color: var(--leather-text);
}

.lore-button:hover {
    border-color: var(--gold);
    background: rgb(255 255 255 / 6%);
}

@media (max-width: 30rem) {
    .lore-label {
        display: none;
    }
}

.lore-overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 1.5rem max(1rem, env(safe-area-inset-right)) 1.5rem max(1rem, env(safe-area-inset-left));
    background: rgb(10 6 20 / 70%);
    backdrop-filter: blur(2px);
}

.lore-dialogue {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: min(38rem, 100%);
    max-height: calc(100dvh - 3rem);
    padding-top: 1.75rem;
}

/* The button already says how to go on. */
.lore-dialogue::after {
    content: none;
}

.lore-title {
    color: var(--dialogue-gold);
}

/* Long stories scroll inside the box, the button stays in view. */
.lore-body {
    overflow-y: auto;
}
</style>
