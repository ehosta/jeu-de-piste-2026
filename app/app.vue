<script setup lang="ts">
import { LOCALES } from "~/i18n";

const { user, clear } = useUserSession();
const { locale, setLocale, t } = useI18n();

useHead({ htmlAttrs: { lang: locale } });
const { actAs } = useActAs();
const { data: game, refresh: refreshGame } = await useGame();
const route = useRoute();

// A pause decided from /admin shows up live.
useRealtime(["game"], refreshGame);
const offline = useState("realtime-offline", () => false);

async function logout() {
    await clear();
    await navigateTo("/");
}

function stopActing() {
    return actAs({ role: "ADMIN" });
}
</script>

<template>
    <header class="header" :class="{ wide: route.path.startsWith('/admin') }">
        <div class="container header-inner">
            <NuxtLink to="/" class="brand">
                <img src="/favicon.svg" alt="" class="brand-mark" width="32" height="32">
                <span class="brand-name">Campudex</span>
            </NuxtLink>
            <div class="header-right">
                <nav v-if="user" class="header-user">
                    <NuxtLink
                        v-if="user.isStaff"
                        to="/admin"
                        class="btn btn-small"
                        :class="route.path.startsWith('/admin') ? 'btn-primary' : 'btn-ghost'"
                        :title="t('header.dashboardTitle')"
                        :aria-label="t('header.dashboard')"
                    >
                        <Icon name="pixelarticons:settings-cog" class="ico dashboard-icon" aria-hidden="true" />
                        <span class="dashboard-label">{{ t("header.dashboard") }}</span>
                    </NuxtLink>
                    <DashboardSwitch v-if="user.isStaff" />
                    <NotificationCenter />
                    <span class="login">{{ user.intraLogin }}</span>
                    <button class="btn btn-small btn-ghost" :aria-label="t('header.logout')" @click="logout">
                        <Icon name="pixelarticons:logout" class="ico logout-icon" aria-hidden="true" />
                        <span class="logout-label">{{ t("header.logout") }}</span>
                    </button>
                </nav>
                <LoreButton />
                <div class="lang" role="group" :aria-label="t('header.language')">
                    <button
                        v-for="value in LOCALES"
                        :key="value"
                        class="lang-option"
                        :class="{ active: locale === value }"
                        :aria-pressed="locale === value"
                        @click="setLocale(value)"
                    >
                        {{ value.toUpperCase() }}
                    </button>
                </div>
            </div>
        </div>
    </header>

    <!-- For everyone in the game: their page, the leaderboard and the log. -->
    <nav
        v-if="user?.role"
        class="tabs"
        :class="{ wide: route.path.startsWith('/admin') }"
        :aria-label="t('nav.label')"
    >
        <div class="container tabs-inner">
            <NuxtLink to="/" class="tab" exact-active-class="active">{{ t("nav.home") }}</NuxtLink>
            <NuxtLink to="/classement" class="tab" active-class="active">
                {{ t("nav.leaderboard") }}
            </NuxtLink>
            <NuxtLink to="/journal" class="tab" active-class="active">{{ t("nav.logs") }}</NuxtLink>
        </div>
    </nav>

    <div v-if="user && offline" class="banner banner-offline" role="status">
        <div class="container banner-inner">
            <span><Icon name="solar:cloud-cross-bold-duotone" class="ico" aria-hidden="true" /> {{ t("header.offline") }}</span>
        </div>
    </div>

    <div v-if="user?.actingAs" class="banner banner-acting">
        <div class="container banner-inner">
            <span>
                <Icon name="solar:magic-stick-3-bold-duotone" class="ico" aria-hidden="true" />
                {{ t("header.acting") }}
                <strong>
                    {{
                        t(`acting.${user.actingAs.kind}`, {
                            name: user.actingAs.name ?? t("acting.deleted"),
                        })
                    }}
                </strong>
            </span>
            <div class="row">
                <NuxtLink
                    v-if="user.actingAsLogin && user.isAdmin"
                    :to="{ path: '/admin/utilisateurs', query: { q: user.actingAsLogin } }"
                    class="btn btn-small btn-ghost"
                >
                    {{ t("header.manageAccount") }}
                </NuxtLink>
                <button class="btn btn-small" @click="stopActing">{{ t("header.backToAdmin") }}</button>
            </div>
        </div>
    </div>

    <div
        v-if="user?.role && game.phase === 'WAITING'"
        class="banner banner-waiting"
        role="status"
    >
        <div class="container banner-inner">
            <span>
                <strong><Icon name="solar:hourglass-bold-duotone" class="ico" aria-hidden="true" /> {{ t("header.waitingTitle") }}</strong>
                {{ t("header.waitingText") }}
            </span>
        </div>
    </div>

    <div
        v-else-if="user && game.paused"
        class="banner banner-paused"
        role="status"
    >
        <div class="container banner-inner">
            <span>
                <strong><Icon name="solar:hourglass-line-bold-duotone" class="ico" aria-hidden="true" /> {{ t("header.pausedTitle") }}</strong>
                {{ game.pauseMessage || t("header.pausedDefault") }}
            </span>
        </div>
    </div>

    <NuxtPage />
</template>

<style scoped>
/* Leather binding with a gold seam, in both color schemes. */
.header {
    position: sticky;
    top: 0;
    z-index: 5;
    padding-top: env(safe-area-inset-top);
    background:
        repeating-linear-gradient(
            90deg,
            transparent 0 3px,
            rgb(255 255 255 / 2%) 3px 4px
        ),
        var(--leather);
    border-bottom: 3px double var(--gold);
    box-shadow: 0 4px 12px rgb(0 0 0 / 25%);
    color: var(--leather-text);
}

/* Lines up with the admin pages, which are wider. */
.header.wide .container,
.tabs.wide .container {
    max-width: 90rem;
}

.header-inner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    min-height: var(--header-height);
}

.brand {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    color: var(--gold);
    font-family: var(--font-display);
    font-size: 1.25rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-decoration: none;
    text-shadow: 0 2px 0 rgb(0 0 0 / 40%);
}

/* The Campudex camera (the favicon), glowing on the cover. Twice its 16 px
   grid, pixels kept sharp. */
.brand-mark {
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    image-rendering: pixelated;
    filter: drop-shadow(0 0 6px rgb(180 140 255 / 45%));
}

.header-right {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.header-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.header-user .btn-ghost {
    color: var(--leather-text);
}

.header-user .btn-ghost:hover {
    border-color: var(--gold);
    background: rgb(255 255 255 / 6%);
}

.header-user :deep(.select) {
    border-color: rgb(255 255 255 / 15%);
    background-color: rgb(255 255 255 / 6%);
    color: var(--leather-text);
    box-shadow: none;
}

.header-user :deep(.select:hover:not(:disabled, :focus)) {
    border-color: var(--gold);
}

.lang {
    display: flex;
    flex-shrink: 0;
    border: 1px solid rgb(255 255 255 / 15%);
    border-radius: var(--radius-sm);
}

.lang-option {
    padding: 0.2rem 0.45rem;
    border: none;
    background: transparent;
    color: var(--leather-muted);
    font-family: var(--font-pixel);
    font-size: 0.8rem;
    cursor: pointer;
}

.lang-option:hover {
    color: var(--leather-text);
}

.lang-option.active {
    background: var(--gold);
    color: #1c1531;
}

.login {
    overflow: hidden;
    color: var(--leather-muted);
    font-family: var(--font-pixel);
    font-size: 0.9rem;
    text-overflow: ellipsis;
    white-space: nowrap;
}

@media (max-width: 30rem) {
    .login,
    .logout-label,
    .dashboard-label,
    /* Admins have the dashboard switch too: only the gem stays. */
    .brand:has(~ .header-right .select) .brand-name {
        display: none;
    }

    /* Shrinks on the narrowest phones; the long label is cut at its border. */
    .header-user :deep(.select) {
        min-width: 4.5rem;
        max-width: 8.5rem;
        contain: paint;
    }
}

@media (min-width: 30.01rem) {
    .logout-icon,
    .dashboard-icon {
        display: none;
    }
}

/* Bookmark tabs hanging from the leather binding. */
.tabs {
    border-bottom: 2px solid var(--frame-soft);
    background: color-mix(in srgb, var(--surface-2) 70%, transparent);
}

.tabs-inner {
    display: flex;
    gap: 0.25rem;
    overflow-x: auto;
    scrollbar-width: none;
}

.tab {
    flex-shrink: 0;
    margin-bottom: -2px;
    padding: 0.55rem 0.9rem 0.45rem;
    border: 2px solid transparent;
    border-bottom: none;
    border-radius: 0 0 var(--radius-sm) var(--radius-sm);
    color: var(--muted);
    font-family: var(--font-pixel);
    font-size: 0.95rem;
    text-decoration: none;
}

.tab:hover {
    color: var(--text);
}

.tab.active {
    border-color: var(--frame);
    border-top-color: transparent;
    background: var(--surface);
    color: var(--text);
    box-shadow: 0 3px 0 var(--gold) inset;
}

.banner {
    border-bottom: 2px solid currentColor;
    font-family: var(--font-pixel);
    font-size: 0.95rem;
}

.banner-inner {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem 1rem;
    padding-block: 0.5rem;
}

.banner-acting {
    background: var(--primary-soft);
    color: var(--primary);
}

.banner-offline {
    background: var(--danger-soft);
    color: var(--danger);
}

.banner-waiting {
    background: var(--info-soft);
    color: var(--info);
}

.banner-paused {
    background:
        repeating-linear-gradient(
            -45deg,
            transparent 0 12px,
            rgb(0 0 0 / 4%) 12px 24px
        ),
        var(--warning-soft);
    color: var(--warning);
}
</style>
