<script setup lang="ts">
// Bocal see every page but the ones only made to change the game.
const ADMIN_ONLY = ["/admin/import", "/admin/maintenance"];

definePageMeta({
    middleware: (to) => {
        const { user } = useUserSession();

        if (!user.value?.isStaff) {
            return navigateTo("/");
        }

        if (!user.value.isAdmin && ADMIN_ONLY.includes(to.path)) {
            return navigateTo("/admin");
        }
    },
});

const { data } = await useAdminState();
const { toast } = useAdminPatch();
const canEdit = useCanEdit();
const { t } = useI18n();

// Photos waiting for an NPC.
const toReview = computed(
    () =>
        data.value?.teams
            .flatMap((team) => Object.values(team.progress))
            .filter((progress) => progress.status === "SUBMITTED").length,
);

const links = computed(() => [
    { to: "/admin", label: t("admin.nav.overview"), count: data.value?.waiting.length },
    { to: "/admin/groupes", label: t("admin.nav.teams"), count: data.value?.teams.length },
    { to: "/admin/utilisateurs", label: t("admin.nav.users"), count: data.value?.users.length },
    { to: "/admin/pnj", label: t("admin.nav.npcs"), count: data.value?.npcs.length },
    { to: "/admin/photos", label: t("admin.nav.photos"), count: toReview.value },
    { to: "/admin/import", label: t("admin.nav.import") },
    { to: "/admin/maintenance", label: t("admin.nav.maintenance") },
].filter((link) => canEdit.value || !ADMIN_ONLY.includes(link.to)));

// Success messages go away on their own, errors stay until dismissed.
let timeout: ReturnType<typeof setTimeout> | undefined;

watch(toast, (value) => {
    clearTimeout(timeout);

    if (value?.tone === "success") {
        timeout = setTimeout(() => (toast.value = null), 4000);
    }
});
</script>

<template>
    <div class="container admin">
        <nav class="admin-nav" :aria-label="t('admin.nav.label')">
            <NuxtLink
                v-for="link in links"
                :key="link.to"
                :to="link.to"
                class="admin-link"
                exact-active-class="active"
            >
                {{ link.label }}
                <span v-if="link.count" class="count">{{ link.count }}</span>
            </NuxtLink>
        </nav>

        <div class="admin-content">
            <p v-if="!canEdit" class="card readonly" role="note">{{ t("admin.readonly") }}</p>
            <NuxtPage />
        </div>

        <div v-if="toast" class="toast" :class="`toast-${toast.tone}`" role="status">
            <div class="stack toast-body">
                <p>{{ toast.text }}</p>
                <ul v-if="toast.issues" class="issues">
                    <li v-for="(issue, index) in toast.issues" :key="index">
                        <code v-if="issue.path">{{ issue.path }}</code>
                        {{ describeIssue(issue, t) }}
                    </li>
                </ul>
            </div>
            <button class="chip-remove" :aria-label="t('admin.nav.close')" @click="toast = null">
                ✕
            </button>
        </div>
    </div>
</template>

<style scoped>
.admin {
    max-width: 90rem;
}

.admin-nav {
    position: sticky;
    top: calc(var(--header-height) + env(safe-area-inset-top));
    z-index: 4;
    display: flex;
    gap: 0.25rem;
    margin-inline: -1rem;
    padding: 0.6rem 1rem;
    overflow-x: auto;
    background: var(--bg);
    border-bottom: 2px solid var(--frame-soft);
    scrollbar-width: none;
}

.admin-link {
    display: inline-flex;
    flex-shrink: 0;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.85rem;
    border: 2px solid transparent;
    border-radius: var(--radius-sm);
    color: var(--muted);
    font-family: var(--font-pixel);
    text-decoration: none;
    white-space: nowrap;
}

.admin-link:hover {
    background: var(--surface-2);
    color: var(--text);
}

.admin-link.active {
    border-color: var(--frame);
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 2px 0 var(--frame);
}

.admin-link.active::before {
    content: "▶";
    margin-right: -0.2rem;
    color: var(--gold);
    font-size: 0.7rem;
}

.count {
    margin-left: auto;
    padding: 0 0.45rem;
    border-radius: 2px;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 0.75rem;
}

.active .count {
    background: var(--gold);
    color: #1c1531;
}

.readonly {
    margin-top: 1.5rem;
    border-left: 4px solid var(--info);
}

/* Sidebar on large screens. */
@media (min-width: 64rem) {
    .admin {
        display: grid;
        grid-template-columns: 14rem minmax(0, 1fr);
        gap: 2.5rem;
    }

    .admin-nav {
        top: calc(var(--header-height) + 2rem);
        align-self: start;
        flex-direction: column;
        margin: 2rem 0 0;
        padding: 0;
        border: none;
        background: transparent;
    }
}

.toast {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right));
    bottom: max(1rem, env(safe-area-inset-bottom));
    left: max(1rem, env(safe-area-inset-left));
    z-index: 20;
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    max-width: 30rem;
    max-height: 60vh;
    margin-left: auto;
    padding: 0.85rem 0.85rem 0.85rem 1.1rem;
    overflow-y: auto;
    border: 2px solid var(--frame);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow);
    font-weight: 500;
}

.toast-success {
    border-left: 4px solid var(--success);
}

.toast-error {
    border-left: 4px solid var(--danger);
}

.toast-body {
    --gap: 0.4rem;

    flex: 1;
    min-width: 0;
}

.issues {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    margin: 0;
    padding-left: 1.1rem;
    font-size: 0.875rem;
    font-weight: 400;
}
</style>
