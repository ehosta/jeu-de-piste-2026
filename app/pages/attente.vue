<script setup lang="ts">
const { user, fetch: fetchSession } = useUserSession();
const { data: game } = useGame();
const { t } = useI18n();

// Leaves as soon as an admin adds the account: the server then tells the
// browser to refetch its session (app/plugins/realtime.client.ts).
watch(
    () => user.value?.role,
    (role) => role && navigateTo("/"),
);

// Also checks after reconnecting, or regularly while the live connection is
// down (both refresh "game").
useRealtime(["game"], fetchSession);
</script>

<template>
    <main class="container page narrow waiting">
        <div class="portal" aria-hidden="true">
            <Icon name="solar:hourglass-bold-duotone" class="ico" aria-hidden="true" />
        </div>
        <h1>{{ t("waitingPage.title") }}</h1>
        <div class="dialogue">
            <span class="dialogue-speaker">{{ t("waitingPage.speaker") }}</span>
            <!-- Before the game, logging in again is enough to join. -->
            <template v-if="game.phase === 'WAITING'">
                <p>
                    <strong>{{ t("waitingPage.halt", { login: user?.intraLogin ?? "" }) }}</strong>
                    {{ t("waitingPage.removed") }}
                </p>
                <p>{{ t("waitingPage.relogin") }}</p>
            </template>
            <template v-else>
                <p>
                    <strong>{{ t("waitingPage.halt", { login: user?.intraLogin ?? "" }) }}</strong>
                    {{ t("waitingPage.started") }}
                </p>
                <p>{{ t("waitingPage.willPlace") }}</p>
            </template>
        </div>
        <LoginButton v-if="game.phase === 'WAITING'" :label="t('waitingPage.join')" />
        <p v-else class="muted small center-text">{{ t("waitingPage.slow") }}</p>
    </main>
</template>

<style scoped>
.waiting {
    justify-content: center;
    align-items: center;
    gap: 1.75rem;
    min-height: calc(100dvh - var(--header-height));
    text-align: center;
}

.center-text {
    text-align: center;
}

/* A swirling portal that the player is waiting to go through. */
.portal {
    display: grid;
    place-items: center;
    width: 5.5rem;
    height: 5.5rem;
    border: 3px solid var(--gold);
    border-radius: 50%;
    background:
        conic-gradient(from 0deg, #8d5fd6, #3d2266, #b48cff, #3d2266, #8d5fd6);
    box-shadow: 0 0 28px rgb(141 95 214 / 55%);
    animation: spin 6s linear infinite;
}

.portal span {
    font-size: 2rem;
    animation: spin 6s linear infinite reverse;
}

@keyframes spin {
    to {
        transform: rotate(360deg);
    }
}
</style>
