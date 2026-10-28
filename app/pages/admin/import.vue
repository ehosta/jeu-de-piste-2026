<script setup lang="ts">
import type { PatchReport } from "#shared/utils/admin-patch";

const { busy, apply } = useAdminPatch();
const { t } = useI18n();

const EXAMPLE = {
    teams: [
        { name: "Les Raclettes", members: ["jdoe", "asmith", "bwayne"] },
        { name: "Ancien nom", rename: "Nouveau nom" },
    ],
    users: [
        { login: "ckent", role: "PLAYER", team: "Les Raclettes" },
        { login: "pparker", team: null },
        { login: "ancien-joueur", $delete: true },
    ],
    npcs: [
        {
            login: "dprince",
            name: "Sir Claudius",
            lore: "Apprenti mage, auteur du maléfice.",
            quests: [
                {
                    key: "cantine",
                    label: "J'ai faim, je cherche un endroit où l'on cuisine avec passion pour 8 euros.",
                    answer: "La cantine",
                },
            ],
        },
        // The same quest under a second NPC: it is shared between them.
        { login: "bwayne", name: "Dame Brume", quests: [{ key: "cantine" }] },
    ],
    progress: [{ team: "Les Raclettes", quest: "cantine", status: "GIVEN" }],
};

const text = ref("");
const preview = ref<PatchReport | null>(null);
const fileInput = useTemplateRef("fileInput");

const parsed = computed(() =>
    text.value.trim() ? parseAdminPatchText(text.value) : null,
);
const patch = computed(() => (parsed.value?.ok ? parsed.value.patch : null));

watch(text, () => (preview.value = null));

function loadExample() {
    text.value = JSON.stringify(EXAMPLE, null, 2);
}

async function loadExport() {
    text.value = JSON.stringify(await $fetch("/api/admin/export"), null, 2);
}

async function downloadExport() {
    const data = await $fetch("/api/admin/export");
    const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `campudex-${new Date().toISOString().slice(0, 16).replace(":", "h")}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
}

async function onFilePicked(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";

    if (file) {
        text.value = await file.text();
    }
}

async function simulate() {
    if (patch.value) {
        preview.value = await apply(patch.value, { dryRun: true });
    }
}

async function submit() {
    if (!patch.value) {
        return;
    }

    const wipe = patch.value.wipe?.length
        ? `\n\n${t("admin.import.wipeWarning", { targets: patch.value.wipe.join(", ") })}`
        : "";

    await apply(patch.value, {
        confirm: `${t("admin.import.confirm")}${wipe}`,
    });
    preview.value = null;
}
</script>

<template>
    <main class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.import.title") }}</h1>
                <p class="muted">{{ t("admin.import.text") }}</p>
            </div>
        </header>

        <div class="layout">
            <section class="card editor-card">
                <div class="row">
                    <button class="btn btn-small" @click="fileInput?.click()">
                        {{ t("admin.import.open") }}
                    </button>
                    <button class="btn btn-small btn-ghost" @click="loadExport">
                        {{ t("admin.import.loadCurrent") }}
                    </button>
                    <button class="btn btn-small btn-ghost" @click="loadExample">
                        {{ t("admin.import.example") }}
                    </button>
                    <span class="spacer" />
                    <button class="btn btn-small btn-ghost" @click="downloadExport">
                        {{ t("admin.import.download") }}
                    </button>
                </div>
                <input
                    ref="fileInput"
                    type="file"
                    accept="application/json,.json"
                    hidden
                    @change="onFilePicked"
                >

                <textarea
                    v-model="text"
                    class="textarea editor"
                    spellcheck="false"
                    autocapitalize="none"
                    placeholder='{ "teams": [{ "name": "Les Raclettes", "members": ["jdoe"] }] }'
                    :aria-label="t('admin.import.document')"
                />

                <div v-if="parsed && !parsed.ok" class="notice notice-error">
                    <p><strong>{{ t("admin.import.issues", { count: parsed.issues.length }) }}</strong></p>
                    <ul class="issues">
                        <li v-for="(issue, index) in parsed.issues.slice(0, 20)" :key="index">
                            <code v-if="issue.path">{{ issue.path }}</code>
                            {{ describeIssue(issue, t) }}
                        </li>
                    </ul>
                </div>
                <p v-else-if="patch" class="notice notice-success">
                    {{ t("admin.import.valid") }}
                    <template v-if="patch.wipe?.length">
                        {{ t("admin.import.wipesFirst") }} <strong>{{ patch.wipe.join(", ") }}</strong>.
                    </template>
                </p>

                <div v-if="preview" class="notice notice-warning">
                    <strong>{{ t("admin.import.simulation") }}</strong> {{ describeReport(preview, t) }}
                    {{ t("admin.import.nothingYet") }}
                </div>

                <div class="actions">
                    <button class="btn" :disabled="busy || !patch" @click="simulate">
                        {{ t("admin.import.simulate") }}
                    </button>
                    <button class="btn btn-primary" :disabled="busy || !patch" @click="submit">
                        {{ t("admin.import.apply") }}
                    </button>
                </div>
            </section>

            <aside class="card help">
                <h2>{{ t("admin.import.format") }}</h2>
                <p class="small muted">
                    <I18nText path="admin.import.formatText">
                        <template #delete><code>"$delete": true</code></template>
                    </I18nText>
                </p>
                <dl class="small">
                    <dt><code>wipe</code></dt>
                    <dd>
                        <I18nText path="admin.import.wipeHelp">
                            <template #targets>
                                <code>progress</code>, <code>quests</code>,
                                <code>npcs</code>, <code>teams</code>,
                                <code>players</code>
                            </template>
                        </I18nText>
                    </dd>
                    <dt><code>game</code></dt>
                    <dd>
                        <I18nText path="admin.import.gameHelp">
                            <template #fields>
                                <code>phase</code>, <code>paused</code>,
                                <code>pauseMessage</code>
                            </template>
                        </I18nText>
                    </dd>
                    <dt><code>teams[]</code></dt>
                    <dd>
                        <I18nText path="admin.import.teamsHelp">
                            <template #fields>
                                <code>name</code>, <code>rename</code>,
                                <code>newQrCode</code>, <code>members</code>
                            </template>
                        </I18nText>
                    </dd>
                    <dt><code>users[]</code></dt>
                    <dd>
                        <I18nText path="admin.import.usersHelp">
                            <template #fields>
                                <code>login</code>, <code>role</code> (PLAYER, NPC,
                                ADMIN), <code>team</code>
                            </template>
                        </I18nText>
                    </dd>
                    <dt><code>npcs[]</code></dt>
                    <dd>
                        <code>login</code>, <code>name</code>,
                        <code>lore</code>, <code>quests[]</code>.
                        {{ t("admin.import.npcsHelp") }}
                    </dd>
                    <dt><code>quests[]</code></dt>
                    <dd>
                        <code>key</code>, <code>rename</code>,
                        <code>npcs</code> (logins), <code>label</code>,
                        <code>answer</code>, <code>difficulty</code> (1–5)
                    </dd>
                    <dt><code>progress[]</code></dt>
                    <dd>
                        <code>team</code>, <code>quest</code>,
                        <code>status</code> (HIDDEN, GIVEN, SUBMITTED,
                        VALIDATED, REJECTED, BLOCKED), <code>expected</code>
                    </dd>
                </dl>
                <p class="small muted">
                    <I18nText path="admin.import.order">
                        <template #doc><code>docs/ADMIN.md</code></template>
                    </I18nText>
                </p>
            </aside>
        </div>
    </main>
</template>

<style scoped>
.layout {
    display: grid;
    gap: 1.25rem;
    align-items: start;
}

@media (min-width: 80rem) {
    .layout {
        grid-template-columns: minmax(0, 1fr) 20rem;
    }

    .help {
        position: sticky;
        top: calc(var(--header-height) + 2rem);
    }
}

.editor {
    min-height: 26rem;
    font-family: var(--font-mono);
    font-size: 0.85rem;
    line-height: 1.55;
    tab-size: 2;
    white-space: pre;
}

.issues {
    display: flex;
    flex-direction: column;
    gap: 0.25rem;
    margin: 0.4rem 0 0;
    padding-left: 1.1rem;
    font-size: 0.875rem;
    font-weight: 400;
}

.help dl {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    margin: 0;
}

.help dd {
    margin: 0 0 0.6rem;
    color: var(--muted);
}
</style>
