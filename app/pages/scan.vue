<script setup lang="ts">
import type { DetectedBarcode, EmittedError } from "vue-qrcode-reader";
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { QuestAction } from "~~/shared/utils/quest-actions";

definePageMeta({
    middleware: () => {
        const { user } = useUserSession();

        if (user.value?.role !== "NPC") {
            return navigateTo("/");
        }
    },
});

// The scanner needs the camera, so it is only loaded in the browser. Browsers
// without a native BarcodeDetector (e.g. Safari on iOS) decode with a WASM
// module, served by us instead of the default CDN. Keep `zxing-wasm` pinned to
// the version bundled by vue-qrcode-reader.
const QrcodeStream = defineAsyncComponent(async () => {
    const { QrcodeStream, setZXingModuleOverrides } = await import(
        "vue-qrcode-reader"
    );

    setZXingModuleOverrides({
        locateFile: (path: string, prefix: string) =>
            path.endsWith(".wasm") ? zxingWasmUrl : prefix + path,
    });

    return QrcodeStream;
});

type ScanResult = Awaited<ReturnType<typeof scanToken>>;

const state = ref<"scanning" | "loading" | "result" | "done">("scanning");
const token = ref("");
const result = ref<ScanResult | null>(null);
const doneMessage = ref("");
const error = ref("");

const ACTION_MESSAGES: Record<QuestAction, string> = {
    GIVE: "Quête donnée ! Le groupe peut partir à la recherche du lieu.",
    VALIDATE: "Quête validée ! La photo est maintenant verrouillée.",
    REJECT: "Photo refusée. Le groupe devra en reprendre une.",
};

// Why a scan has nothing to offer, depending on where the team stands.
const IDLE_MESSAGES: Record<string, string> = {
    GIVEN: "Ce groupe a déjà ta quête, mais n'a pas encore envoyé sa photo.",
    REJECTED: "Tu as refusé leur photo, ils doivent en envoyer une nouvelle.",
    VALIDATED: "Ce groupe a déjà validé ta quête.",
};

function scanToken(value: string) {
    return $fetch("/api/qrcode/scan", {
        method: "POST",
        body: { token: value },
    });
}

function errorMessage(err: unknown) {
    const statusCode = (err as { statusCode?: number }).statusCode;

    switch (statusCode) {
        case 400:
            return "Ce QR code ne vient pas du jeu.";
        case 403:
            return "Tu n'es plus donneur de quêtes, recharge la page.";
        case 404:
            return "Ce QR code ne correspond à aucun groupe.";
        case 409:
            return "Ça a changé entre-temps (nouvelle photo ?), rescanne le groupe.";
        default:
            return "Quelque chose s'est mal passé, réessaie.";
    }
}

async function onDetect(codes: DetectedBarcode[]) {
    const value = codes[0]?.rawValue;

    if (!value || state.value !== "scanning") {
        return;
    }

    state.value = "loading";
    error.value = "";

    try {
        result.value = await scanToken(value);
        token.value = value;
        state.value = "result";
    } catch (err) {
        error.value = errorMessage(err);
        state.value = "scanning";
    }
}

async function applyAction(
    quest: ScanResult["quests"][number],
    action: QuestAction,
) {
    if (
        action === "VALIDATE" &&
        !window.confirm("Valider définitivement cette photo ?")
    ) {
        return;
    }

    state.value = "loading";
    error.value = "";

    try {
        await $fetch("/api/qrcode/action", {
            method: "POST",
            body: {
                token: token.value,
                questId: quest.id,
                action,
                photoPath: quest.photoPath,
            },
        });
        doneMessage.value = ACTION_MESSAGES[action];
        state.value = "done";
    } catch (err) {
        error.value = errorMessage(err);
        state.value = "result";
    }
}

function scanAgain() {
    result.value = null;
    token.value = "";
    error.value = "";
    state.value = "scanning";
}

function onCameraError(err: EmittedError) {
    switch (err.name) {
        case "NotAllowedError":
            error.value =
                "Autorise l'accès à la caméra dans ton navigateur pour scanner.";
            break;
        case "NotFoundError":
        case "OverconstrainedError":
            error.value = "Aucune caméra trouvée sur cet appareil.";
            break;
        case "InsecureContextError":
            error.value = "La caméra ne fonctionne qu'en HTTPS.";
            break;
        case "NotReadableError":
            error.value =
                "La caméra est déjà utilisée par une autre application.";
            break;
        default:
            error.value = "Impossible de démarrer la caméra.";
    }
}
</script>

<template>
    <main class="page">
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <template v-if="state === 'scanning' || state === 'loading'">
            <section v-if="!result" class="card center">
                <h1>Scanner un groupe</h1>
                <p class="muted">Vise le QR code affiché sur leur téléphone.</p>
                <div class="scanner">
                    <ClientOnly>
                        <QrcodeStream
                            :constraints="{ facingMode: 'environment' }"
                            :paused="state === 'loading'"
                            @detect="onDetect"
                            @error="onCameraError"
                        />
                    </ClientOnly>
                    <p v-if="state === 'loading'" class="scanner-overlay">
                        Chargement…
                    </p>
                </div>
            </section>
            <p v-else class="muted center">Chargement…</p>
        </template>

        <template v-else-if="state === 'result' && result">
            <section class="card">
                <p class="muted">Groupe</p>
                <h1>{{ result.team.name }}</h1>
                <p class="muted">{{ result.team.members.join(" · ") }}</p>
            </section>

            <section v-if="!result.quests.length" class="card center">
                <h2>Oups, désolé !</h2>
                <p class="muted">Tu n'as aucune quête à donner.</p>
            </section>

            <section
                v-for="quest in result.quests"
                :key="quest.id"
                class="card"
            >
                <h2>{{ quest.label }}</h2>

                <template v-if="quest.actions.includes('GIVE')">
                    <p>Donner cette quête à ce groupe ?</p>
                    <div class="actions">
                        <button class="btn" @click="scanAgain">Non</button>
                        <button
                            class="btn btn-primary"
                            @click="applyAction(quest, 'GIVE')"
                        >
                            Oui
                        </button>
                    </div>
                </template>

                <template v-else-if="quest.actions.includes('VALIDATE')">
                    <p>
                        Le groupe a envoyé sa photo. Est-ce le bon endroit ?
                    </p>
                    <img
                        v-if="quest.photoPath"
                        :src="`/api/photos/${quest.photoPath}`"
                        alt="Photo envoyée par le groupe"
                        class="photo"
                    >
                    <p class="muted">
                        Réponse attendue : <strong>{{ quest.answer }}</strong>
                    </p>
                    <div class="actions">
                        <button
                            class="btn btn-danger"
                            @click="applyAction(quest, 'REJECT')"
                        >
                            Invalider
                        </button>
                        <button
                            class="btn btn-success"
                            @click="applyAction(quest, 'VALIDATE')"
                        >
                            Valider
                        </button>
                    </div>
                </template>

                <div v-else class="oops">
                    <p><strong>Oups, désolé !</strong></p>
                    <p>{{ IDLE_MESSAGES[quest.status] }}</p>
                </div>
            </section>

            <button class="btn btn-block" @click="scanAgain">
                Scanner un autre groupe
            </button>
        </template>

        <template v-else-if="state === 'done'">
            <section class="card center">
                <h1>C'est fait !</h1>
                <p>{{ doneMessage }}</p>
            </section>
            <button class="btn btn-primary btn-block" @click="scanAgain">
                Scanner un autre groupe
            </button>
        </template>
    </main>
</template>

<style scoped>
.scanner {
    position: relative;
    width: 100%;
    aspect-ratio: 1;
    overflow: hidden;
    background: #000000;
    border-radius: var(--radius);
}

.scanner-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 60%);
    color: #ffffff;
    font-weight: 600;
}

.photo {
    width: 100%;
    max-height: 60vh;
    object-fit: contain;
    background: #000000;
    border-radius: var(--radius);
}

.oops {
    padding: 0.75rem 1rem;
    background: var(--warning-bg);
    border-radius: var(--radius);
}
</style>
