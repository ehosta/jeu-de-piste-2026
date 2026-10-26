<script setup lang="ts">
import type { TeamQuestStatus } from "~~/prisma/generated/enums";

const { data: team, status, refresh } = await useFetch("/api/teams/me");

const showQrCode = ref(false);
const photoInput = useTemplateRef("photoInput");
const uploadingQuestId = ref<string | null>(null);
const error = ref("");

const STATUS_TEXTS: Partial<Record<TeamQuestStatus, string>> = {
    GIVEN: "Trouvez le lieu et prenez-le en photo.",
    SUBMITTED: "Photo envoyée ! Retournez voir le PNJ pour qu'il la valide.",
    REJECTED: "Le PNJ a refusé la photo. Reprenez-en une !",
    VALIDATED: "Quête validée, la photo est verrouillée.",
};

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
        const statusCode = (err as { statusCode?: number }).statusCode;
        error.value =
            statusCode === 409
                ? "Cette quête est déjà validée, la photo ne peut plus changer."
                : "L'envoi de la photo a échoué, réessaie.";
        await refresh();
    } finally {
        uploadingQuestId.value = null;
    }
}
</script>

<template>
    <p v-if="status === 'pending' && !team" class="muted">Chargement…</p>

    <section v-else-if="!team" class="card center">
        <h1>Pas encore de groupe</h1>
        <p class="muted">
            Tu n'as pas encore été placé dans un groupe. Reviens un peu plus
            tard !
        </p>
    </section>

    <template v-else>
        <section class="card center">
            <h1>{{ team.name }}</h1>
            <p class="muted">{{ team.members.join(" · ") }}</p>
            <button class="btn btn-primary btn-block" @click="showQrCode = true">
                Montrer le QR code
            </button>
        </section>

        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <section v-if="!team.quests.length" class="card center">
            <h2>Aucune quête pour l'instant</h2>
            <p class="muted">
                Trouvez un PNJ sur le campus et montrez-lui votre QR code pour
                qu'il vous donne sa quête.
            </p>
        </section>

        <section
            v-for="quest in team.quests"
            :key="quest.id"
            class="card"
            :class="{ validated: quest.status === 'VALIDATED' }"
        >
            <div>
                <h2>{{ quest.label }}</h2>
                <p class="muted">PNJ : {{ quest.npc }}</p>
            </div>
            <p>{{ STATUS_TEXTS[quest.status] }}</p>
            <img
                v-if="quest.photoPath"
                :src="`/api/photos/${quest.photoPath}`"
                alt="Photo envoyée pour cette quête"
                class="photo"
                loading="lazy"
            >
            <button
                v-if="quest.canSubmitPhoto"
                class="btn btn-block"
                :class="{ 'btn-primary': !quest.photoPath }"
                :disabled="!!uploadingQuestId"
                @click="pickPhoto(quest.id)"
            >
                <template v-if="uploadingQuestId === quest.id">Envoi…</template>
                <template v-else-if="quest.photoPath">Reprendre la photo</template>
                <template v-else>Prendre la photo</template>
            </button>
        </section>

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
        aria-label="QR code du groupe"
        @click="showQrCode = false"
    >
        <img
            class="qrcode"
            :src="'/api/teams/me/qrcode'"
            alt="QR code du groupe"
            width="320"
            height="320"
        >
        <p>Monte la luminosité de ton écran. Touche pour fermer.</p>
    </div>
</template>

<style scoped>
.validated {
    border-color: var(--success);
}

.photo {
    width: 100%;
    max-height: 20rem;
    object-fit: cover;
    border-radius: var(--radius);
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
    gap: 1rem;
    padding: 1rem;
    background: #ffffff;
    color: #2b2118;
    text-align: center;
}

.qrcode {
    width: 100%;
    max-width: 22rem;
    height: auto;
    aspect-ratio: 1;
}
</style>
