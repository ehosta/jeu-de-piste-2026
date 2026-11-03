<script setup lang="ts">
import type { NotificationAudience } from "~~/prisma/generated/enums";
import {
    MAX_NOTIFICATION_LENGTH,
    NOTIFICATION_AUDIENCES,
    NOTIFICATION_DURATIONS,
    parseNotificationInput,
    type NotificationDuration,
    type NotificationInputIssue,
} from "#shared/utils/notifications";

// Messages pushed live to the players' and NPCs' screens (NotificationCenter),
// e.g. "Meet in the conference room in 15 min!". Bocal see what is showing.
const { data: state } = await useAdminState();
const { data, refresh } = await useFetch("/api/admin/notifications", {
    key: "admin-notifications",
});
const { busy, toast } = useAdminPatch();
const canEdit = useCanEdit();
const { t, locale } = useI18n();

// What is showing, and how many browsers are connected to receive it.
useRealtime(["notifications", "presence"], refresh);

const message = ref("");
const audience = ref<NotificationAudience>("ALL");
const teamId = ref("");
const urgent = ref(false);
const duration = ref<NotificationDuration>(15);

// Real teams first, the admins' sandbox ones (to test) at the end.
const teams = computed(() =>
    [...(state.value?.teams ?? [])].sort((a, b) => Number(a.sandbox) - Number(b.sandbox)),
);

const input = computed(() => ({
    message: message.value,
    audience: audience.value,
    teamId: teamId.value || null,
    urgent: urgent.value,
    duration: duration.value,
}));
const valid = computed(() => parseNotificationInput(input.value).ok);

function durationLabel(value: NotificationDuration) {
    if (value === null) {
        return t("admin.notifications.forever");
    }

    return value >= 60
        ? t("admin.notifications.hours", { count: value / 60 })
        : t("admin.notifications.minutes", { count: value });
}

function issueMessage(error: unknown) {
    const issue = (error as { data?: { data?: { issue?: NotificationInputIssue } } }).data?.data
        ?.issue;
    return issue ? t(`admin.notifications.issues.${issue}`) : t("common.error");
}

async function run(action: () => Promise<void>, success: string) {
    busy.value = true;

    try {
        await action();
        toast.value = { tone: "success", text: success };
        await refresh();
        return true;
    } catch (error) {
        toast.value = { tone: "error", text: issueMessage(error) };
        return false;
    } finally {
        busy.value = false;
    }
}

async function send() {
    const sent = await run(
        async () => {
            await $fetch("/api/admin/notifications", { method: "POST", body: input.value });
        },
        t("admin.notifications.sent"),
    );

    if (sent) {
        message.value = "";
    }
}

function remove(id: string) {
    return run(
        async () => {
            await $fetch(`/api/admin/notifications/${id}`, { method: "DELETE" });
        },
        t("admin.notifications.removed"),
    );
}

function removeAll() {
    if (!window.confirm(t("admin.notifications.removeAllConfirm"))) {
        return;
    }

    return run(
        async () => {
            await $fetch("/api/admin/notifications", { method: "DELETE" });
        },
        t("admin.notifications.removedAll"),
    );
}

function formatTime(value: string) {
    return new Date(value).toLocaleTimeString(locale.value === "fr" ? "fr-FR" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });
}
</script>

<template>
    <main class="page">
        <header class="page-header">
            <div>
                <p class="eyebrow">{{ t("common.administration") }}</p>
                <h1>{{ t("admin.notifications.title") }}</h1>
                <p class="muted">{{ t("admin.notifications.text") }}</p>
            </div>
            <span v-if="data" class="badge badge-success">
                {{ t("admin.notifications.connected", { count: data.connected }) }}
            </span>
        </header>

        <form v-if="canEdit" class="card stack" @submit.prevent="send">
            <h2>{{ t("admin.notifications.newTitle") }}</h2>

            <label class="field">
                <span>{{ t("admin.notifications.message") }}</span>
                <textarea
                    v-model="message"
                    class="textarea"
                    rows="3"
                    :maxlength="MAX_NOTIFICATION_LENGTH"
                    :placeholder="t('admin.notifications.placeholder')"
                />
                <span class="muted small length">
                    {{ t("admin.notifications.length", { count: message.length, max: MAX_NOTIFICATION_LENGTH }) }}
                </span>
            </label>

            <div class="options">
                <label class="field">
                    <span>{{ t("admin.notifications.audience") }}</span>
                    <select v-model="audience" class="select">
                        <option v-for="value in NOTIFICATION_AUDIENCES" :key="value" :value="value">
                            {{ t(`admin.notifications.audiences.${value}`) }}
                        </option>
                    </select>
                </label>

                <label v-if="audience === 'TEAM'" class="field">
                    <span>{{ t("admin.notifications.team") }}</span>
                    <select v-model="teamId" class="select">
                        <option value="" disabled>{{ t("admin.notifications.chooseTeam") }}</option>
                        <option v-for="team in teams" :key="team.id" :value="team.id">
                            {{ team.name }}{{ team.sandbox ? ` (${t("leaderboard.sandbox")})` : "" }}
                        </option>
                    </select>
                </label>

                <label class="field">
                    <span>{{ t("admin.notifications.duration") }}</span>
                    <select v-model="duration" class="select">
                        <option v-for="value in NOTIFICATION_DURATIONS" :key="String(value)" :value="value">
                            {{ durationLabel(value) }}
                        </option>
                    </select>
                </label>
            </div>

            <label class="urgent">
                <input v-model="urgent" type="checkbox" class="checkbox">
                <span class="stack urgent-text">
                    <strong>{{ t("admin.notifications.urgent") }}</strong>
                    <span class="muted small">{{ t("admin.notifications.urgentHint") }}</span>
                </span>
            </label>

            <div class="actions">
                <button class="btn btn-primary" :disabled="busy || !valid">
                    {{ t("admin.notifications.send") }}
                </button>
            </div>
        </form>

        <section class="card stack">
            <div class="card-header">
                <h2>{{ t("admin.notifications.activeTitle") }}</h2>
                <button
                    v-if="canEdit && data?.notifications.length"
                    class="btn btn-small btn-ghost-danger"
                    :disabled="busy"
                    @click="removeAll"
                >
                    {{ t("admin.notifications.removeAll") }}
                </button>
            </div>

            <p v-if="!data?.notifications.length" class="muted">{{ t("admin.notifications.none") }}</p>

            <ul v-else class="list">
                <li v-for="notification in data.notifications" :key="notification.id" class="item">
                    <div class="stack item-text">
                        <p class="item-message">{{ notification.message }}</p>
                        <div class="row item-meta">
                            <span v-if="notification.urgent" class="badge badge-danger">
                                {{ t("admin.notifications.urgent") }}
                            </span>
                            <span class="badge badge-info">
                                {{
                                    notification.audience === "TEAM"
                                        ? notification.team
                                        : t(`admin.notifications.audiences.${notification.audience}`)
                                }}
                            </span>
                            <span class="muted small">
                                {{ t("admin.notifications.sentBy", { login: notification.sentBy, time: formatTime(notification.createdAt) }) }}
                                ·
                                {{
                                    notification.expiresAt
                                        ? t("admin.notifications.until", { time: formatTime(notification.expiresAt) })
                                        : t("admin.notifications.untilRemoved")
                                }}
                            </span>
                        </div>
                    </div>
                    <button
                        v-if="canEdit"
                        class="btn btn-small btn-ghost-danger"
                        :disabled="busy"
                        @click="remove(notification.id)"
                    >
                        {{ t("admin.notifications.remove") }}
                    </button>
                </li>
            </ul>
        </section>
    </main>
</template>

<style scoped>
.length {
    align-self: flex-end;
}

.options {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0.75rem;
}

.urgent {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    cursor: pointer;
}

.urgent-text {
    --gap: 0.15rem;
}

.list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.item {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem 1.5rem;
    padding-block: 0.9rem;
    border-bottom: 1px solid var(--border);
}

.item:last-child {
    border-bottom: none;
}

.item-text {
    --gap: 0.4rem;

    flex: 1 1 20rem;
    min-width: 0;
}

.item-message {
    overflow-wrap: anywhere;
    white-space: pre-line;
}

.item-meta {
    flex-wrap: wrap;
    gap: 0.4rem 0.6rem;
}
</style>
