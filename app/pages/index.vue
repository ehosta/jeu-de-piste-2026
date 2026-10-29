<script setup lang="ts">
const { user } = useUserSession();
const { actAs } = useActAs();
// NPCs can't scan before the game starts or while it is paused.
const lock = useGameLock();
const { t } = useI18n();

// An admin or bocal can also play in a team and be an NPC: shortcuts to switch
// to them.
const { data: views } = useFetch("/api/admin/views", {
    key: "admin-views",
    server: false,
    immediate: !!user.value?.isStaff,
});

// The album on the landing page: one page is restored, the others were erased.
const ALBUM_SLOTS = 6;
const RESTORED_SLOT = 2;
</script>

<template>
    <main v-if="!user" class="container page landing">
        <section class="hero">
            <div class="stack hero-text">
                <p class="eyebrow">{{ t("landing.eyebrow") }}</p>
                <h1>{{ t("landing.titleStart") }} <span class="gilded">Campudex</span></h1>
                <p class="lead">{{ t("landing.lead") }}</p>
                <figure class="spell" tabindex="0">
                    <blockquote>{{ t("landing.spell") }}</blockquote>
                    <figcaption>
                        <span class="spell-hint">{{ t("landing.spellHint") }}</span>
                        <code class="spell-real">rm -rf /* --no-preserve-root</code>
                    </figcaption>
                </figure>
                <p class="muted">{{ t("landing.call") }}</p>
                <a href="/auth/42" class="btn btn-primary login-button">
                    <Icon name="solar:login-3-bold-duotone" class="ico" aria-hidden="true" />
                    {{ t("landing.login") }}
                </a>
            </div>

            <div class="book" aria-hidden="true">
                <div class="book-page">
                    <div
                        v-for="slot in ALBUM_SLOTS / 2"
                        :key="slot"
                        class="album-slot"
                        :class="{ restored: slot === RESTORED_SLOT }"
                    >
                        <Icon v-if="slot === RESTORED_SLOT" name="solar:stars-bold-duotone" />
                        <span v-else>?</span>
                    </div>
                </div>
                <div class="book-page">
                    <div
                        v-for="slot in ALBUM_SLOTS / 2"
                        :key="slot"
                        class="album-slot"
                    >
                        <span>?</span>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <PlayerTeam v-else-if="user.role === 'PLAYER'" />

    <main v-else-if="user.role === 'NPC'" class="container page narrow">
        <section class="card center">
            <p class="eyebrow">{{ t("home.npcEyebrow") }}</p>
            <h1>{{ t("home.npcTitle") }}</h1>
        </section>
        <div class="dialogue">
            <span class="dialogue-speaker">{{ t("npcSpeaker") }}</span>
            <template v-if="lock">
                <p>{{ t(`scan.locked.${lock}Title`) }}</p>
                <p>{{ t(`home.npcLocked.${lock}`) }}</p>
            </template>
            <template v-else>
                <p>{{ t("home.npcLine1") }}</p>
                <p>{{ t("home.npcLine2") }}</p>
            </template>
        </div>
        <button v-if="lock" class="btn btn-primary btn-block" disabled>
            {{ t("home.scan") }}
        </button>
        <NuxtLink v-else to="/scan" class="btn btn-primary btn-block">
            {{ t("home.scan") }}
        </NuxtLink>
        <NpcProfile />
    </main>

    <main v-else class="container page narrow">
        <section class="card center">
            <p class="eyebrow">{{ t("home.adminEyebrow") }}</p>
            <h1>{{ t("home.adminTitle", { login: user.intraLogin }) }}</h1>
            <p class="muted">{{ user.isAdmin ? t("home.adminText") : t("home.bocalText") }}</p>
            <NuxtLink to="/admin" class="btn btn-primary btn-block">
                {{ t("home.openDashboard") }}
            </NuxtLink>
            <div v-if="views?.me.team || views?.me.npc" class="actions me-actions">
                <button
                    v-if="views.me.team"
                    class="btn"
                    @click="actAs({ role: 'PLAYER', teamId: views.me.team.id })"
                >
                    {{ t("home.playWith", { name: views.me.team.name }) }}
                </button>
                <button
                    v-if="views.me.npc"
                    class="btn"
                    @click="actAs({ role: 'NPC', npcId: views.me.npc.id })"
                >
                    {{ t("home.becomeNpc", { name: views.me.npc.name }) }}
                </button>
            </div>
        </section>
    </main>
</template>

<style scoped>
.me-actions {
    width: 100%;
}

.landing {
    justify-content: center;
    min-height: calc(100dvh - var(--header-height));
}

.hero {
    display: grid;
    align-items: center;
    gap: 2.5rem;
}

@media (min-width: 56rem) {
    .hero {
        grid-template-columns: 1.1fr 1fr;
        gap: 4rem;
    }
}

.hero-text {
    --gap: 1rem;
}

.hero h1 {
    font-size: clamp(2.1rem, 1.4rem + 3vw, 3.4rem);
}

.gilded {
    background: linear-gradient(180deg, #f3d27a, var(--gold) 55%, #8a5a12);
    background-clip: text;
    color: transparent;
    filter: drop-shadow(0 2px 0 rgb(0 0 0 / 20%));
}

.lead {
    max-width: 34rem;
    font-size: 1.15rem;
}

/* The botched spell. Hovering it shows what Sir Claudius really typed. */
.spell {
    position: relative;
    margin: 0;
    padding: 0.75rem 1rem;
    border-left: 3px solid var(--gold);
    background: color-mix(in srgb, var(--gold-soft) 55%, transparent);
    cursor: help;
}

.spell blockquote {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.05rem;
    font-style: italic;
}

.spell figcaption {
    display: grid;
    margin-top: 0.25rem;
    font-size: 0.85rem;
}

.spell-hint,
.spell-real {
    grid-area: 1 / 1;
    transition: opacity 0.2s;
}

.spell-hint {
    color: var(--muted);
    font-family: var(--font-pixel);
}

.spell-real {
    justify-self: start;
    border-color: var(--danger);
    color: var(--danger);
    opacity: 0;
}

.spell:hover .spell-hint,
.spell:focus .spell-hint {
    opacity: 0;
}

.spell:hover .spell-real,
.spell:focus .spell-real {
    opacity: 1;
}

.login-button {
    align-self: flex-start;
    min-width: 15rem;
    font-size: 1.1rem;
}

@media (max-width: 30rem) {
    .login-button {
        align-self: stretch;
    }
}

/* The Campudex, open on two pages. */
.book {
    display: grid;
    grid-template-columns: 1fr 1fr;
    padding: 0.75rem;
    border: 3px solid var(--leather);
    border-radius: 10px;
    background: var(--leather);
    box-shadow:
        0 0 0 2px var(--gold),
        0 18px 40px rgb(0 0 0 / 30%);
    transform: perspective(900px) rotateX(8deg) rotate(-2deg);
}

.book-page {
    display: grid;
    gap: 0.6rem;
    padding: 0.85rem;
    background: var(--surface);
}

.book-page:first-child {
    border-radius: 4px 0 0 4px;
    box-shadow: inset -14px 0 18px -12px rgb(0 0 0 / 40%);
}

.book-page:last-child {
    border-radius: 0 4px 4px 0;
    box-shadow: inset 14px 0 18px -12px rgb(0 0 0 / 40%);
}

.album-slot {
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    border: 2px dashed var(--frame-soft);
    border-radius: 3px;
    background:
        repeating-linear-gradient(
            45deg,
            transparent 0 6px,
            rgb(0 0 0 / 3%) 6px 12px
        ),
        var(--surface-2);
    color: var(--frame-soft);
    font-family: var(--font-pixel);
    font-size: 1.6rem;
}

.album-slot.restored {
    border: 2px solid var(--gold);
    background: linear-gradient(135deg, #8d5fd6, #3d2266);
    color: #f3d27a;
    box-shadow: 0 0 18px rgb(231 181 82 / 55%);
    animation: glow 2.4s ease-in-out infinite alternate;
}

@keyframes glow {
    to {
        box-shadow: 0 0 6px rgb(231 181 82 / 25%);
    }
}

@media (max-width: 30rem) {
    .book {
        display: none;
    }
}
</style>
