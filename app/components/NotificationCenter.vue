<script setup lang="ts">
// The admins' messages (/admin/notifications), pushed live: a bell in the
// header with the unread count and the list of messages showing, a bubble for
// each new message, or a dialogue in front of the page for urgent ones.
// What was read or hidden is remembered on this device.
type Notification = {
    id: string;
    message: string;
    urgent: boolean;
    createdAt: string;
    expiresAt: string | null;
};

const STORAGE_KEY = "campudex-notifications";
// Non-urgent bubbles go away on their own.
const TOAST_MS = 10_000;

const { user } = useUserSession();
const { t, locale } = useI18n();

const { data, refresh } = useFetch<Notification[]>("/api/notifications", {
    key: "notifications",
    server: false,
    immediate: !!user.value,
    default: () => [],
});

useRealtime(["notifications"], refresh);

// Someone else logging in (or switching views) sees other messages.
watch(
    () => user.value && `${user.value.intraLogin}|${user.value.role}`,
    (value) => (value ? refresh() : (data.value = [])),
);

// Read and hidden messages, per device.
// Loaded before the messages are fetched (in the browser only, so nothing
// differs from the server-rendered page), not to pop up read ones again.
const seen = ref(new Set<string>());
const dismissed = ref(new Set<string>());

if (import.meta.client) {
    try {
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
        seen.value = new Set(stored.seen ?? []);
        dismissed.value = new Set(stored.dismissed ?? []);
    } catch {
        // Private browsing or corrupted: start over.
    }
}

function save() {
    // Forgets the messages taken down since.
    const ids = new Set(data.value.map((notification) => notification.id));
    const keep = (set: Set<string>) => [...set].filter((id) => ids.has(id));

    try {
        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify({ seen: keep(seen.value), dismissed: keep(dismissed.value) }),
        );
    } catch {
        // Not remembered, nothing more.
    }
}

// Expired messages disappear when they expire, without waiting for the server.
const now = ref(Date.now());
let expiryTimer: ReturnType<typeof setTimeout> | undefined;

watch(
    [data, now],
    () => {
        clearTimeout(expiryTimer);
        const next = Math.min(
            ...data.value
                .map((notification) => Date.parse(notification.expiresAt ?? ""))
                .filter((time) => time > now.value),
        );

        if (Number.isFinite(next)) {
            // setTimeout can't wait more than ~24 days.
            expiryTimer = setTimeout(() => (now.value = Date.now()), Math.min(next - now.value + 50, 2 ** 31 - 1));
        }
    },
    { immediate: true },
);

onBeforeUnmount(() => clearTimeout(expiryTimer));

const shown = computed(() =>
    data.value.filter(
        (notification) =>
            !dismissed.value.has(notification.id) &&
            (!notification.expiresAt || Date.parse(notification.expiresAt) > now.value),
    ),
);

const unread = computed(() => shown.value.filter((notification) => !seen.value.has(notification.id)));

// New messages pop up once per page load: urgent ones one after the other in
// front of the page, the others as bubbles.
const popped = new Set<string>();
const urgentQueue = ref<Notification[]>([]);
const toasts = ref<Notification[]>([]);

watch(unread, (notifications) => {
    const fresh = notifications.filter((notification) => !popped.has(notification.id));

    if (!fresh.length) {
        return;
    }

    for (const notification of fresh) {
        popped.add(notification.id);

        if (notification.urgent) {
            urgentQueue.value.push(notification);
        } else {
            toasts.value.unshift(notification);
            setTimeout(() => closeToast(notification.id), TOAST_MS);
        }
    }

    navigator.vibrate?.(fresh.some((notification) => notification.urgent) ? [200, 100, 200, 100, 400] : 150);
});

// Taken down or expired meanwhile: no longer popping up.
watch(shown, (notifications) => {
    const ids = new Set(notifications.map((notification) => notification.id));
    urgentQueue.value = urgentQueue.value.filter((notification) => ids.has(notification.id));
    toasts.value = toasts.value.filter((notification) => ids.has(notification.id));
});

const urgent = computed(() => urgentQueue.value[0] ?? null);

function acknowledge() {
    const notification = urgentQueue.value.shift();

    if (notification) {
        seen.value.add(notification.id);
        save();
    }
}

function closeToast(id: string) {
    toasts.value = toasts.value.filter((notification) => notification.id !== id);
}

// Opening the menu reads everything in it.
const open = ref(false);
const root = useTemplateRef("root");

watch(open, (value) => {
    if (value) {
        toasts.value = [];

        for (const notification of shown.value) {
            seen.value.add(notification.id);
        }

        save();
    }
});

function dismiss(id: string) {
    dismissed.value.add(id);
    seen.value.add(id);
    save();
}

// The path as it was when clicked: hiding a message removes the clicked button
// from the page before this runs.
function onClickOutside(event: MouseEvent) {
    if (open.value && root.value && !event.composedPath().includes(root.value)) {
        open.value = false;
    }
}

function onKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
        open.value = false;
    }
}

onMounted(() => {
    document.addEventListener("click", onClickOutside);
    document.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
    document.removeEventListener("click", onClickOutside);
    document.removeEventListener("keydown", onKeydown);
});

function formatTime(value: string) {
    return new Date(value).toLocaleTimeString(locale.value === "fr" ? "fr-FR" : "en-GB", {
        hour: "2-digit",
        minute: "2-digit",
    });
}
</script>

<template>
    <div ref="root" class="notifications">
        <button
            class="btn btn-small btn-ghost bell"
            :class="{ ringing: unread.length }"
            :aria-label="unread.length ? t('notifications.openUnread', { count: unread.length }) : t('notifications.open')"
            :aria-expanded="open"
            @click="open = !open"
        >
            <Icon name="solar:bell-bing-bold-duotone" class="ico bell-icon" aria-hidden="true" />
            <span v-if="unread.length" class="bell-count">{{ unread.length }}</span>
        </button>

        <div v-if="open" class="panel" role="dialog" :aria-label="t('notifications.title')">
            <p class="panel-title">{{ t("notifications.title") }}</p>
            <p v-if="!shown.length" class="muted small panel-empty">{{ t("notifications.empty") }}</p>
            <ul v-else class="panel-list">
                <li
                    v-for="notification in shown"
                    :key="notification.id"
                    class="panel-item"
                    :class="{ urgent: notification.urgent }"
                >
                    <div class="stack panel-text">
                        <p>{{ notification.message }}</p>
                        <p class="muted small">
                            {{ t("notifications.sentAt", { time: formatTime(notification.createdAt) }) }}
                            <template v-if="notification.expiresAt">
                                · {{ t("notifications.until", { time: formatTime(notification.expiresAt) }) }}
                            </template>
                        </p>
                    </div>
                    <button
                        class="chip-remove"
                        :aria-label="t('notifications.dismissLabel')"
                        :title="t('notifications.dismiss')"
                        @click="dismiss(notification.id)"
                    >
                        <Icon name="pixelarticons:close" class="ico" aria-hidden="true" />
                    </button>
                </li>
            </ul>
        </div>

        <Teleport to="body">
            <!-- Behind an urgent message, they would only distract from it. -->
            <div v-show="!urgent" class="toasts" aria-live="polite">
                <button
                    v-for="notification in toasts"
                    :key="notification.id"
                    class="notification-toast"
                    @click="closeToast(notification.id)"
                >
                    <Icon name="solar:bell-bing-bold-duotone" class="ico" aria-hidden="true" />
                    <span>{{ notification.message }}</span>
                </button>
            </div>

            <div v-if="urgent" class="overlay" role="alertdialog" aria-modal="true" :aria-label="t('notifications.speaker')">
                <div class="dialogue urgent-dialogue">
                    <span class="dialogue-speaker"><Icon name="solar:volume-loud-bold-duotone" class="ico" aria-hidden="true" /> {{ t("notifications.speaker") }}</span>
                    <p class="urgent-message">{{ urgent.message }}</p>
                    <p class="urgent-time">
                        {{ t("notifications.sentAt", { time: formatTime(urgent.createdAt) }) }}
                    </p>
                    <button class="btn btn-primary btn-block" autofocus @click="acknowledge">
                        {{ t("notifications.ok") }}
                    </button>
                </div>
            </div>
        </Teleport>
    </div>
</template>

<style scoped>
.notifications {
    position: relative;
}

/* On the header's leather, gold when something is unread. */
.bell {
    position: relative;
    color: var(--leather-text);
}

.bell.ringing {
    color: var(--dialogue-gold);
}

.bell.ringing .bell-icon {
    display: inline-block;
    animation: ring 2s ease-in-out infinite;
}

.bell-count {
    position: absolute;
    top: -0.45rem;
    right: -0.45rem;
    min-width: 1.15rem;
    padding: 0 0.3rem;
    border-radius: 999px;
    background: var(--danger);
    color: #fff;
    font-family: var(--font-pixel);
    font-size: 0.75rem;
    line-height: 1.15rem;
    text-align: center;
}

@keyframes ring {
    0%, 60%, 100% {
        transform: rotate(0);
    }

    10%, 30%, 50% {
        transform: rotate(14deg);
    }

    20%, 40% {
        transform: rotate(-14deg);
    }
}

.panel {
    position: absolute;
    top: calc(100% + 0.6rem);
    right: 0;
    z-index: 10;
    width: min(22rem, calc(100vw - 2rem));
    max-height: 70vh;
    overflow-y: auto;
    border: 2px solid var(--frame);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
}

/* The bell is near the right edge on phones: the panel sticks to the screen. */
@media (max-width: 30rem) {
    .panel {
        position: fixed;
        top: calc(var(--header-height) + env(safe-area-inset-top) + 0.25rem);
        right: 1rem;
        left: 1rem;
        width: auto;
    }
}

.panel-title {
    padding: 0.7rem 1rem;
    border-bottom: 1px solid var(--border);
    font-family: var(--font-pixel);
}

.panel-empty {
    padding: 1rem;
}

.panel-list {
    margin: 0;
    padding: 0;
    list-style: none;
}

.panel-item {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid var(--border);
}

.panel-item:last-child {
    border-bottom: none;
}

.panel-item.urgent {
    box-shadow: 4px 0 0 var(--danger) inset;
}

.panel-text {
    --gap: 0.2rem;

    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
    white-space: pre-line;
}

.toasts {
    position: fixed;
    top: calc(var(--header-height) + env(safe-area-inset-top) + 0.75rem);
    right: max(1rem, env(safe-area-inset-right));
    left: max(1rem, env(safe-area-inset-left));
    z-index: 30;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 0.5rem;
    pointer-events: none;
}

.notification-toast {
    display: flex;
    gap: 0.6rem;
    max-width: 26rem;
    padding: 0.75rem 1rem;
    border: 2px solid var(--frame);
    border-left: 4px solid var(--gold);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    color: var(--text);
    font: inherit;
    text-align: left;
    overflow-wrap: anywhere;
    white-space: pre-line;
    cursor: pointer;
    pointer-events: auto;
    animation: slide-in 0.25s ease-out;
}

@keyframes slide-in {
    from {
        opacity: 0;
        transform: translateY(-0.5rem);
    }
}

.overlay {
    position: fixed;
    inset: 0;
    z-index: 40;
    display: grid;
    place-items: center;
    padding: 1.5rem max(1rem, env(safe-area-inset-right)) 1.5rem max(1rem, env(safe-area-inset-left));
    background: rgb(10 6 20 / 70%);
    backdrop-filter: blur(2px);
}

.urgent-dialogue {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    width: min(30rem, 100%);
    padding-top: 1.75rem;
}

/* The button already says how to go on. */
.urgent-dialogue::after {
    content: none;
}

.urgent-message {
    font-size: 1.3rem;
    overflow-wrap: anywhere;
    white-space: pre-line;
}

.urgent-time {
    color: var(--dialogue-gold);
    font-size: 0.85rem;
}
</style>
