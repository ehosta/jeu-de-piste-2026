<script setup lang="ts">
import type { DetectedBarcode, EmittedError } from "vue-qrcode-reader";
import zxingWasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import type { TeamQuestStatus } from "~~/prisma/generated/enums";
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
const doneAction = ref<QuestAction | null>(null);
const error = ref("");
const { t } = useI18n();
// No scanning before the game starts or while it is paused.
const lock = useGameLock();

// Why a scan has nothing to offer, depending on where the team stands.
function idleMessage(status: TeamQuestStatus) {
    return status === "GIVEN" ||
        status === "REJECTED" ||
        status === "VALIDATED" ||
        status === "BLOCKED"
        ? t(`scan.idle.${status}`)
        : "";
}

function scanToken(value: string) {
    return $fetch("/api/qrcode/scan", {
        method: "POST",
        body: { token: value },
    });
}

function errorMessage(err: unknown) {
    const { statusCode, statusMessage } = err as {
        statusCode?: number;
        statusMessage?: string;
    };

    switch (statusCode) {
        case 400:
            return t("scan.errors.notOurs");
        case 403:
            return t("scan.errors.notNpc");
        case 404:
            return t("scan.errors.unknown");
        case 409:
            return t("scan.errors.changed");
        case 423:
            return statusMessage === "Game not started"
                ? t("scan.errors.notStarted")
                : t("scan.errors.paused");
        default:
            return t("common.error");
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
        !window.confirm(t("scan.validateConfirm"))
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
        doneAction.value = action;
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
            error.value = t("scan.errors.cameraDenied");
            break;
        case "NotFoundError":
        case "OverconstrainedError":
            error.value = t("scan.errors.noCamera");
            break;
        case "InsecureContextError":
            error.value = t("scan.errors.https");
            break;
        case "NotReadableError":
            error.value = t("scan.errors.cameraBusy");
            break;
        default:
            error.value = t("scan.errors.camera");
    }
}
</script>

<template>
    <main class="container page narrow">
        <p v-if="error" class="notice notice-error" role="alert">{{ error }}</p>

        <section v-if="lock" class="card center">
            <p class="eyebrow">{{ t("scan.eyebrow") }}</p>
            <h1>{{ t(`scan.locked.${lock}Title`) }}</h1>
            <p class="muted">{{ t(`scan.locked.${lock}Text`) }}</p>
            <NuxtLink to="/" class="btn btn-block">{{ t("scan.locked.back") }}</NuxtLink>
        </section>

        <template v-else-if="state === 'scanning' || state === 'loading'">
            <section v-if="!result" class="card center">
                <p class="eyebrow">{{ t("scan.eyebrow") }}</p>
                <h1>{{ t("scan.title") }}</h1>
                <p class="muted">{{ t("scan.aim") }}</p>
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
                        {{ t("common.loading") }}
                    </p>
                </div>
            </section>
            <p v-else class="empty">{{ t("common.loading") }}</p>
        </template>

        <template v-else-if="state === 'result' && result">
            <section class="card">
                <p class="eyebrow">{{ t("scan.team") }}</p>
                <h1>{{ result.team.name }}</h1>
                <p class="muted">{{ result.team.members.join(" · ") }}</p>
            </section>

            <section v-if="!result.quests.length" class="card center">
                <h2>{{ t("scan.oops") }}</h2>
                <p class="muted">{{ t("scan.noQuest") }}</p>
            </section>

            <section
                v-for="quest in result.quests"
                :key="quest.id"
                class="card"
            >
                <div class="card-header">
                    <h2>{{ quest.label }}</h2>
                    <StatusBadge :status="quest.status" />
                </div>
                <p v-if="quest.sharedWith.length" class="muted small">
                    ⇄ {{ t("admin.npcs.sharedWith", { names: quest.sharedWith.join(", ") }) }}
                </p>

                <template v-if="quest.actions.includes('GIVE')">
                    <p>{{ t("scan.give") }}</p>
                    <div class="actions">
                        <button class="btn" @click="scanAgain">{{ t("scan.no") }}</button>
                        <button
                            class="btn btn-primary"
                            @click="applyAction(quest, 'GIVE')"
                        >
                            {{ t("scan.yes") }}
                        </button>
                    </div>
                </template>

                <template v-else-if="quest.actions.includes('VALIDATE')">
                    <p>{{ t("scan.review") }}</p>
                    <img
                        v-if="quest.photoPath"
                        :src="`/api/photos/${quest.photoPath}`"
                        :alt="t('scan.photoAlt')"
                        class="photo"
                    >
                    <p class="muted">
                        {{ t("scan.expected") }} <strong>{{ quest.answer }}</strong>
                    </p>
                    <div class="actions">
                        <button
                            class="btn btn-danger"
                            @click="applyAction(quest, 'REJECT')"
                        >
                            {{ t("scan.reject") }}
                        </button>
                        <button
                            class="btn btn-success"
                            @click="applyAction(quest, 'VALIDATE')"
                        >
                            {{ t("scan.validate") }}
                        </button>
                    </div>
                </template>

                <div v-else class="oops">
                    <p><strong>{{ t("scan.oops") }}</strong></p>
                    <p>{{ idleMessage(quest.status) }}</p>
                </div>
            </section>

            <button class="btn btn-block" @click="scanAgain">
                {{ t("scan.again") }}
            </button>
        </template>

        <template v-else-if="state === 'done'">
            <section class="card center">
                <p class="eyebrow">{{ t("scan.doneEyebrow") }}</p>
                <h1>{{ t("scan.done") }}</h1>
                <p v-if="doneAction">{{ t(`scan.actions.${doneAction}`) }}</p>
            </section>
            <button class="btn btn-primary btn-block" @click="scanAgain">
                {{ t("scan.again") }}
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
    border: 3px solid var(--frame);
    border-radius: var(--radius-sm);
    background: #000000;
}

/* Gold corner marks around the viewfinder. */
.scanner::after {
    --c: #f3d27a;

    content: "";
    position: absolute;
    inset: 12%;
    z-index: 1;
    pointer-events: none;
    background:
        linear-gradient(var(--c), var(--c)) top left / 28px 4px no-repeat,
        linear-gradient(var(--c), var(--c)) top left / 4px 28px no-repeat,
        linear-gradient(var(--c), var(--c)) top right / 28px 4px no-repeat,
        linear-gradient(var(--c), var(--c)) top right / 4px 28px no-repeat,
        linear-gradient(var(--c), var(--c)) bottom left / 28px 4px no-repeat,
        linear-gradient(var(--c), var(--c)) bottom left / 4px 28px no-repeat,
        linear-gradient(var(--c), var(--c)) bottom right / 28px 4px no-repeat,
        linear-gradient(var(--c), var(--c)) bottom right / 4px 28px no-repeat;
}

.scanner-overlay {
    position: absolute;
    inset: 0;
    z-index: 2;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgb(0 0 0 / 60%);
    color: #ffffff;
    font-family: var(--font-pixel);
}

.photo {
    width: 100%;
    max-height: 60vh;
    object-fit: contain;
    border: 3px solid var(--frame);
    border-radius: var(--radius-sm);
    background: #000000;
}

.oops {
    padding: 0.75rem 1rem;
    border: 2px solid currentColor;
    border-radius: var(--radius-sm);
    background: var(--warning-soft);
    color: var(--warning);
    font-family: var(--font-pixel);
}
</style>
