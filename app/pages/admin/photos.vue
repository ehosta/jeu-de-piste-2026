<script setup lang="ts">
import type { TeamQuestStatus } from "~~/prisma/generated/enums";

// Every photo sent, quest by quest: the ones waiting for an NPC and the
// validated ones. Reviewing stays the NPCs' job: admins only step in on a
// validated (locked) photo an NPC shouldn't have let through, to cancel the
// validation (REJECTED: the team can send another photo) or block the quest
// as a penalty (BLOCKED). Either way the team loses the quest's points.
// Filtering by the NPC who validated shows whether one validates anything.
type Photo = { team: string; status: TeamQuestStatus; photoPath: string | null };
const { data, refresh } = await useAdminState();
const { busy, apply } = useAdminPatch();
const canEdit = useCanEdit();
const { t, formatDateTime } = useI18n();

const REVIEWED: TeamQuestStatus[] = ["SUBMITTED", "VALIDATED", "REJECTED", "BLOCKED"];
// Hidden unless asked for: nothing left to check.
const CLOSED: TeamQuestStatus[] = ["REJECTED", "BLOCKED"];

const statusFilter = ref<TeamQuestStatus | "">("");
const search = ref("");
const showRejected = ref(false);
const validator = ref("");

// The NPCs who validated at least one photo, with how many.
const validators = computed(() => {
    const counts = new Map<string, number>();

    for (const team of data.value?.teams ?? []) {
        for (const progress of Object.values(team.progress)) {
            if (progress.status === "VALIDATED" && progress.validatedBy) {
                counts.set(progress.validatedBy, (counts.get(progress.validatedBy) ?? 0) + 1);
            }
        }
    }

    return [...counts].sort(([a], [b]) => a.localeCompare(b));
});

// Photos arrive during the game.
let poll: ReturnType<typeof setInterval> | undefined;

onMounted(() => {
    poll = setInterval(() => {
        if (document.visibilityState === "visible" && !busy.value) {
            refresh();
        }
    }, 15_000);
});

onBeforeUnmount(() => clearInterval(poll));

const quests = computed(() => {
    const query = search.value.trim().toLowerCase();
    const teams = (data.value?.teams ?? []).filter(
        (team) => !query || team.name.toLowerCase().includes(query),
    );

    const all = (data.value?.quests ?? []).map((quest) => {
        const photos = teams.flatMap((team) => {
            const progress = team.progress[quest.key];

            if (
                !progress?.photoPath ||
                !REVIEWED.includes(progress.status) ||
                (statusFilter.value && progress.status !== statusFilter.value) ||
                (!statusFilter.value && CLOSED.includes(progress.status) && !showRejected.value) ||
                (validator.value && progress.validatedBy !== validator.value)
            ) {
                return [];
            }

            return [{ team: team.name, sandbox: team.sandbox, ...progress }];
        });

        // Waiting photos first, then the most recent.
        photos.sort(
            (a, b) =>
                Number(b.status === "SUBMITTED") - Number(a.status === "SUBMITTED") ||
                String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? "")),
        );

        return { ...quest, photos };
    });

    // While filtering by NPC, only their quests.
    return validator.value ? all.filter((quest) => quest.photos.length) : all;
});

const total = computed(() =>
    quests.value.reduce((sum, quest) => sum + quest.photos.length, 0),
);

// Cancel (REJECTED), block (BLOCKED) or unblock (back to REJECTED).
type Correction = "cancel" | "block" | "unblock";

// Only changes the photo shown, at the status shown: if it changed meanwhile,
// the patch is refused and the page refreshed.
function correct(photo: Photo, quest: { key: string; label: string }, correction: Correction) {
    const { team, status, photoPath } = photo;
    const params = { team, quest: quest.label };

    return apply(
        {
            progress: [
                {
                    team,
                    quest: quest.key,
                    status: correction === "block" ? "BLOCKED" : "REJECTED",
                    expected: { status, photoPath },
                },
            ],
        },
        {
            confirm: t(`admin.photos.${correction}Confirm`, params),
            success: t(`admin.photos.${correction}Done`, params),
        },
    );
}
</script>

<template>
    <main v-if="data" class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.photos.title") }}</h1>
            </div>
            <span class="muted">{{ t("admin.photos.count", { count: total }) }}</span>
        </header>

        <div class="row toolbar">
            <input
                v-model="search"
                type="search"
                class="input grow"
                :placeholder="t('admin.photos.search')"
                :aria-label="t('common.search')"
            >
            <select v-model="statusFilter" class="select" :aria-label="t('admin.photos.filter')">
                <option value="">{{ t("admin.photos.all") }}</option>
                <option v-for="status in REVIEWED" :key="status" :value="status">
                    {{ t(`questStatus.${status}`) }}
                </option>
            </select>
            <select
                v-if="validators.length"
                v-model="validator"
                class="select"
                :aria-label="t('admin.photos.validatorFilter')"
            >
                <option value="">{{ t("admin.photos.allValidators") }}</option>
                <option v-for="[name, count] in validators" :key="name" :value="name">
                    {{ t("admin.photos.validatorOption", { name, count }) }}
                </option>
            </select>
            <label v-if="!statusFilter" class="row show-rejected">
                <input v-model="showRejected" type="checkbox" class="checkbox">
                {{ t("admin.photos.showRejected") }}
            </label>
        </div>

        <p v-if="!quests.length" class="card empty">
            {{ validator ? t("common.noResult") : t("admin.photos.noQuest") }}
        </p>

        <section v-for="quest in quests" :key="quest.key" class="stack quest">
            <div class="card-header">
                <div>
                    <h2 class="quest-title">
                        <span class="stars">{{ stars(quest.difficulty) }}</span>
                        {{ quest.label }}
                    </h2>
                    <p class="muted small">{{ quest.npcs.join(" · ") }}</p>
                </div>
                <span class="badge">{{ quest.photos.length }}</span>
            </div>

            <p v-if="!quest.photos.length" class="muted small">{{ t("admin.photos.none") }}</p>

            <div v-else class="grid photos">
                <article
                    v-for="photo in quest.photos"
                    :key="photo.team"
                    class="card photo"
                    :class="`photo-${photo.status.toLowerCase()}`"
                >
                    <a
                        :href="`/api/photos/${photo.photoPath}`"
                        target="_blank"
                        class="thumb"
                        :title="t('admin.overview.progress.photo')"
                    >
                        <img
                            :src="`/api/photos/${photo.photoPath}`"
                            :alt="t('admin.photos.alt', { team: photo.team, quest: quest.label })"
                            loading="lazy"
                        >
                    </a>
                    <div class="row photo-header">
                        <strong class="grow">{{ photo.team }}</strong>
                        <span v-if="photo.sandbox" class="badge badge-primary">{{ t("common.admin") }}</span>
                        <StatusBadge :status="photo.status" />
                    </div>
                    <p class="muted small">
                        {{
                            t("admin.photos.sent", {
                                login: photo.submittedBy ?? "?",
                                date: formatDateTime(photo.submittedAt),
                            })
                        }}
                        <template v-if="photo.status === 'VALIDATED' || photo.status === 'BLOCKED'">
                            <br>
                            {{
                                t("admin.photos.validated", {
                                    name: photo.validatedBy ?? t("admin.photos.admin"),
                                    date: formatDateTime(photo.validatedAt),
                                })
                            }}
                        </template>
                    </p>
                    <div v-if="canEdit && photo.status === 'VALIDATED'" class="row actions">
                        <button
                            class="btn btn-small btn-ghost-danger"
                            :disabled="busy"
                            @click="correct(photo, quest, 'cancel')"
                        >
                            {{ t("admin.photos.cancel") }}
                        </button>
                        <button
                            class="btn btn-small btn-danger"
                            :disabled="busy"
                            @click="correct(photo, quest, 'block')"
                        >
                            {{ t("admin.photos.block") }}
                        </button>
                    </div>
                    <button
                        v-else-if="canEdit && photo.status === 'BLOCKED'"
                        class="btn btn-small btn-ghost actions"
                        :disabled="busy"
                        @click="correct(photo, quest, 'unblock')"
                    >
                        {{ t("admin.photos.unblock") }}
                    </button>
                </article>
            </div>
        </section>
    </main>
</template>

<style scoped>
.show-rejected {
    flex-shrink: 0;
    gap: 0.4rem;
    white-space: nowrap;
}

.quest + .quest {
    padding-top: 1.5rem;
    border-top: 2px solid var(--frame-soft);
}

.quest-title {
    font-size: 1.15rem;
}

.stars {
    margin-right: 0.35rem;
    color: var(--gold);
    font-size: 0.9rem;
}

.photos {
    --min: 15rem;

    align-items: start;
}

.photo {
    gap: 0.5rem;
    padding: 0.6rem;
}

.photo-submitted {
    border-color: var(--warning);
}

.photo-rejected,
.photo-blocked {
    opacity: 0.6;
}

.thumb {
    display: block;
    overflow: hidden;
    aspect-ratio: 4 / 3;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
}

.thumb img {
    display: block;
    width: 100%;
    height: 100%;
    object-fit: cover;
}

.photo-header {
    gap: 0.4rem;
    align-items: center;
}

.actions {
    align-self: flex-start;
    gap: 0.4rem;
}
</style>
