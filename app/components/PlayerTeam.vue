<script setup lang="ts">
const { data: team, status, refresh } = await useFetch("/api/teams/me");
const { data: game } = useGame();
const { t, ordinal, locale } = useI18n();

// No photo before the game starts or while it is paused.
const locked = computed(() => game.value.phase === "WAITING" || game.value.paused);

const showQrCode = ref(false);
const photoInput = useTemplateRef("photoInput");
// The quest whose photo is being sent or withdrawn.
const uploadingQuestId = ref<string | null>(null);
const error = ref("");

const validatedCount = computed(
    () =>
        team.value?.quests.filter((quest) => quest.status === "VALIDATED")
            .length ?? 0,
);

// Out of every quest of the game, not only the ones given so far.
const progress = computed(() =>
    team.value?.questCount
        ? `${(validatedCount.value / team.value.questCount) * 100}%`
        : "0%",
);

// Quests the team still has to do: given, photo sent or rejected.
const activeCount = computed(
    () =>
        team.value?.quests.filter((quest) =>
            ["GIVEN", "SUBMITTED", "REJECTED"].includes(quest.status),
        ).length ?? 0,
);

// Every quest of the game validated: the Campudex is complete.
const allDone = computed(
    () => !!team.value?.questCount && validatedCount.value >= team.value.questCount,
);

// The NPC's decision shows up without reloading the page.
let poll: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    poll = setInterval(() => {
        if (document.visibilityState === "visible" && !uploadingQuestId.value) {
            refresh();
        }
    }, 10_000);
});

onBeforeUnmount(() => clearInterval(poll));

// Draws a new random name for the team.
const renaming = ref(false);

async function rerollName() {
    renaming.value = true;
    error.value = "";

    try {
        await $fetch("/api/teams/me/name", {
            method: "POST",
            body: { locale: locale.value },
        });
        await refresh();
    } catch {
        error.value = t("player.errors.rename");
    } finally {
        renaming.value = false;
    }
}

let targetQuestId: string | null = null;

function pickPhoto(questId: string) {
    targetQuestId = questId;
    error.value = "";
    photoInput.value?.click();
}

async function onPhotoPicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";

    if (!file || !targetQuestId) {
        return;
    }

    uploadingQuestId.value = targetQuestId;

    try {
        const body = new FormData();
        body.append("photo", await compressPhoto(file), "photo.jpg");

        await $fetch(`/api/teams/me/quests/${targetQuestId}/photo`, {
            method: "POST",
            body,
        });
        await refresh();
    } catch (err) {
        error.value = photoErrorMessage(err, t("player.errors.upload"));
        await refresh();
    } finally {
        uploadingQuestId.value = null;
    }
}

// Lets the team retake a wrong photo before the NPC reviews it.
async function withdrawPhoto(questId: string) {
    if (!window.confirm(t("player.withdrawConfirm"))) {
        return;
    }

    uploadingQuestId.value = questId;
    error.value = "";

    try {
        await $fetch(`/api/teams/me/quests/${questId}/photo`, { method: "DELETE" });
    } catch (err) {
        error.value = photoErrorMessage(err, t("player.errors.withdraw"));
    } finally {
        await refresh();
        uploadingQuestId.value = null;
    }
}

function photoErrorMessage(err: unknown, fallback: string) {
    const { statusCode, statusMessage } = err as {
        statusCode?: number;
        statusMessage?: string;
    };

    if (statusCode === 423) {
        return statusMessage === "Game not started"
            ? t("player.errors.notStarted")
            : t("player.errors.paused");
    }

    switch (statusMessage) {
        case "Photo pending":
            return t("player.errors.pending");
        case "Photo locked":
            return t("player.errors.locked");
        case "No photo pending":
            return t("player.errors.noPending");
        default:
            return fallback;
    }
}
</script>

<template>
    <main class="container page">
        <p v-if="status === 'pending' && !team" class="empty">{{ t("common.loading") }}</p>

        <div v-else-if="!team" class="stack narrow no-team">
            <h1>{{ t("player.noTeamTitle") }}</h1>
            <div class="dialogue">
                <span class="dialogue-speaker">{{ t("npcSpeaker") }}</span>
                <template v-if="game.phase === 'WAITING'">
                    <p>{{ t("player.waitingLine1") }}</p>
                    <p>{{ t("player.waitingLine2") }}</p>
                </template>
                <template v-else>
                    <p>{{ t("player.noTeamLine1") }}</p>
                    <p>{{ t("player.noTeamLine2") }}</p>
                </template>
            </div>
        </div>

        <template v-else>
            <section class="card team">
                <div class="stack team-text">
                    <p class="eyebrow">{{ t("player.teamEyebrow") }}</p>
                    <div class="team-name">
                        <h1>{{ team.name }}</h1>
                        <button
                            v-if="!team.sandbox"
                            class="btn btn-small btn-ghost reroll"
                            :disabled="renaming"
                            :title="t('player.rerollName')"
                            :aria-label="t('player.rerollName')"
                            @click="rerollName"
                        >
                            🎲
                        </button>
                    </div>
                    <ul class="party">
                        <li v-for="member in team.members" :key="member">
                            <span class="avatar" aria-hidden="true">
                                {{ member.charAt(0).toUpperCase() }}
                            </span>
                            {{ member }}
                        </li>
                    </ul>
                </div>
                <div class="team-side">
                    <div class="score">
                        <div class="score-label">
                            <span>{{ t("player.progress") }}</span>
                            <strong>
                                {{ validatedCount }}<small>/{{ team.questCount }}</small>
                            </strong>
                        </div>
                        <div class="meter" role="presentation">
                            <span :style="{ '--value': progress }" />
                        </div>
                        <NuxtLink v-if="team.points !== null" to="/classement" class="standing">
                            <span>{{ t("player.points", { count: team.points }) }}</span>
                            <span v-if="team.rank">
                                · {{ t("player.rankLabel") }} {{ ordinal(team.rank) }}
                            </span>
                        </NuxtLink>
                    </div>
                    <button class="btn btn-primary" @click="showQrCode = true">
                        {{ t("player.showQrCode") }}
                    </button>
                </div>
            </section>

            <p v-if="error" class="notice notice-error" role="alert">
                {{ error }}
            </p>

            <div v-if="allDone" class="dialogue victory" role="status">
                <span class="dialogue-speaker">{{ t("player.victorySpeaker") }}</span>
                <p><strong>{{ t("player.victoryLine1") }}</strong></p>
                <p>{{ t("player.victoryLine2") }}</p>
            </div>

            <div v-else-if="!team.quests.length" class="dialogue">
                <span class="dialogue-speaker">{{ t("npcSpeaker") }}</span>
                <p>{{ t("player.emptyLine1") }}</p>
                <p>
                    {{ t("player.emptyLine2Start") }}
                    <strong>{{ t("player.emptyLine2Code") }}</strong>
                    {{ t("player.emptyLine2End") }}
                </p>
            </div>

            <!-- Nothing left to do, but quests nobody gave them yet. -->
            <div v-else-if="!activeCount" class="dialogue">
                <span class="dialogue-speaker">{{ t("npcSpeaker") }}</span>
                <p>{{ t("player.citizensLine1") }}</p>
                <p>{{ t("player.citizensLine2") }}</p>
            </div>

            <template v-if="team.quests.length">
                <div class="ornament" aria-hidden="true">✦</div>
                <div class="grid quests">
                    <article
                        v-for="(quest, index) in team.quests"
                        :key="quest.id"
                        class="card quest"
                        :class="{ validated: quest.status === 'VALIDATED' }"
                    >
                        <div class="quest-top">
                            <span class="page-number">{{ t("player.page", { number: index + 1 }) }}</span>
                            <span
                                class="stars"
                                :title="t('admin.npcs.difficultyTitle', { count: quest.difficulty })"
                            >
                                {{ stars(quest.difficulty) }}
                            </span>
                            <StatusBadge :status="quest.status" />
                        </div>
                        <div class="photo-slot">
                            <img
                                v-if="quest.photoPath"
                                :src="`/api/photos/${quest.photoPath}`"
                                :alt="t('player.sentPhotoAlt')"
                                loading="lazy"
                            >
                            <span v-else class="erased" aria-hidden="true">
                                <span>?</span>
                                <small>{{ t("player.erased") }}</small>
                            </span>
                            <span
                                v-if="quest.status === 'VALIDATED'"
                                class="seal"
                                aria-hidden="true"
                            >
                                {{ t("player.restored") }}
                            </span>
                        </div>
                        <div class="stack quest-text">
                            <h2>{{ quest.label }}</h2>
                            <p class="muted small npc">{{ t("player.givenBy", { name: quest.npc }) }}</p>
                            <p v-if="quest.otherNpcs.length" class="muted small npc">
                                {{ t("player.alsoReviewedBy", { names: quest.otherNpcs.join(", ") }) }}
                            </p>
                            <p v-if="quest.submittedBy && quest.photoPath" class="small sender">
                                {{ t("player.photoBy") }} <strong>{{ quest.submittedBy }}</strong>
                            </p>
                            <p class="small">{{ t(`player.status.${quest.status}`) }}</p>
                        </div>
                        <button
                            v-if="quest.canSubmitPhoto"
                            class="btn btn-block"
                            :class="{ 'btn-primary': !quest.photoPath }"
                            :disabled="!!uploadingQuestId || locked"
                            @click="pickPhoto(quest.id)"
                        >
                            <template v-if="uploadingQuestId === quest.id">
                                {{ t("player.sending") }}
                            </template>
                            <template v-else-if="quest.photoPath">
                                {{ t("player.retake") }}
                            </template>
                            <template v-else>{{ t("player.take") }}</template>
                        </button>
                        <button
                            v-if="quest.canWithdrawPhoto"
                            class="btn btn-block btn-ghost-danger"
                            :disabled="!!uploadingQuestId || locked"
                            @click="withdrawPhoto(quest.id)"
                        >
                            {{ uploadingQuestId === quest.id ? t("player.withdrawing") : t("player.withdraw") }}
                        </button>
                    </article>
                </div>
            </template>

            <input
                ref="photoInput"
                type="file"
                accept="image/*"
                hidden
                @change="onPhotoPicked"
            >
        </template>

        <div
            v-if="showQrCode && team"
            class="qrcode-overlay"
            role="dialog"
            :aria-label="t('player.qrCodeLabel')"
            @click="showQrCode = false"
        >
            <div class="qrcode-frame">
                <img
                    class="qrcode"
                    :src="'/api/teams/me/qrcode'"
                    :alt="t('player.qrCodeLabel')"
                    width="320"
                    height="320"
                >
            </div>
            <p class="qrcode-name">{{ team.name }}</p>
            <p>{{ t("player.qrCodeHint") }}</p>
        </div>
    </main>
</template>

<style scoped>
.no-team {
    --gap: 1.75rem;

    align-self: center;
    width: 100%;
    margin-top: 8vh;
    text-align: center;
}

/* Character sheet of the team. */
.team-name {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.4rem;
}

.reroll {
    font-size: 1.1rem;
}

.team {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 1.25rem;
}

.team-text {
    --gap: 0.5rem;

    flex: 1 1 16rem;
}

.party {
    display: flex;
    flex-wrap: wrap;
    gap: 0.4rem 1rem;
    margin: 0;
    padding: 0;
    list-style: none;
    font-family: var(--font-pixel);
    font-size: 0.95rem;
}

.party li {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
}

.avatar {
    display: grid;
    place-items: center;
    width: 1.6rem;
    height: 1.6rem;
    border: 2px solid var(--frame);
    background: var(--primary-soft);
    color: var(--primary);
    font-size: 0.85rem;
    image-rendering: pixelated;
}

.team-side {
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: 1rem 1.5rem;
}

@media (max-width: 30rem) {
    .team-side,
    .team-side .btn,
    .score {
        width: 100%;
    }
}

.score {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 12rem;
}

.score-label {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 1rem;
    color: var(--muted);
    font-family: var(--font-pixel);
    font-size: 0.85rem;
}

.score-label strong {
    color: var(--gold);
    font-size: 1.6rem;
    font-weight: 600;
    line-height: 1;
}

.score-label small {
    color: var(--muted);
    font-size: 0.9rem;
}

.quests {
    --min: 16rem;
}

/* An album page. */
.quest {
    gap: 0.7rem;
    padding: 0.85rem;
}

.quest-top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding-inline: 0.3rem;
}

.stars {
    margin-right: auto;
    color: var(--gold);
    font-size: 0.85rem;
    letter-spacing: 0.08em;
}

.standing {
    align-self: flex-end;
    color: var(--gold);
    font-family: var(--font-pixel);
    font-size: 0.9rem;
    text-decoration: none;
}

.standing:hover {
    text-decoration: underline;
}

/* The Campudex complete: the souls speak, in gold. */
.victory {
    border-color: var(--gold);
    background:
        radial-gradient(circle at 50% 0%, rgb(231 181 82 / 25%), transparent 70%),
        var(--dialogue-bg);
    box-shadow:
        0 0 28px rgb(231 181 82 / 35%),
        0 6px 0 rgb(0 0 0 / 25%);
}

.page-number {
    color: var(--muted);
    font-family: var(--font-display);
    font-size: 0.85rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

.quest-text {
    --gap: 0.3rem;

    flex: 1;
    padding-inline: 0.35rem;
}

.npc {
    font-style: italic;
}

.sender {
    font-family: var(--font-pixel);
}

.validated {
    border-color: var(--gold);
    box-shadow:
        inset 0 0 0 4px var(--surface),
        inset 0 0 0 5px var(--gold),
        0 0 0 1px var(--gold),
        0 0 22px color-mix(in srgb, var(--gold) 35%, transparent),
        var(--shadow);
}

.photo-slot {
    position: relative;
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    overflow: hidden;
    border: 2px dashed var(--frame-soft);
    border-radius: 3px;
    background:
        repeating-linear-gradient(
            45deg,
            transparent 0 8px,
            rgb(0 0 0 / 3%) 8px 16px
        ),
        var(--surface-2);
}

.photo-slot:has(img) {
    border: 3px solid var(--frame);
}

.photo-slot img {
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.erased {
    display: flex;
    flex-direction: column;
    align-items: center;
    color: var(--frame-soft);
    font-family: var(--font-pixel);
}

.erased span {
    font-size: 2.75rem;
    line-height: 1;
}

.erased small {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
}

/* Wax seal stamped on a validated photo. */
.seal {
    position: absolute;
    right: 0.6rem;
    bottom: 0.6rem;
    display: grid;
    place-items: center;
    width: 5rem;
    height: 5rem;
    border: 3px double #f3d27a;
    border-radius: 50%;
    background: radial-gradient(circle at 35% 30%, #c94a3a, #7c1f19 70%);
    box-shadow: 0 3px 8px rgb(0 0 0 / 45%);
    color: #f9e3b0;
    font-family: var(--font-display);
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    transform: rotate(-14deg);
}

/* White, full screen: scanners need the contrast, even in dark mode. */
.qrcode-overlay {
    position: fixed;
    inset: 0;
    z-index: 10;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 0.75rem;
    padding: 1rem;
    background: #ffffff;
    color: #2b1d14;
    font-family: var(--font-pixel);
    text-align: center;
}

.qrcode-frame {
    width: 100%;
    max-width: min(27rem, 70vh);
    padding: 0.75rem;
    border: 4px double #b7821f;
}

.qrcode {
    width: 100%;
    height: auto;
    aspect-ratio: 1;
}

.qrcode-name {
    font-family: var(--font-display);
    font-size: 1.4rem;
    font-weight: 700;
}
</style>
