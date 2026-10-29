<script setup lang="ts">
// The "log in with 42" button (landing page, /attente). It goes to the 42 page
// only once: clicking again while it loads would spend more of the 42 API's
// requests (2 per second for the whole game, see server/utils/intra.ts). When
// the login fails, the server sends the player back with `?login_error=`,
// explained here.
const props = defineProps<{ label: string }>();

const { t } = useI18n();
const route = useRoute();
const router = useRouter();

// Long enough for the queue of logins waiting on the 42 API to empty a bit.
const BUSY_COOLDOWN_SECONDS = 10;

const loginError = parseLoginError(route.query.login_error);
const leaving = ref(false);
const cooldown = ref(loginError === "busy" ? BUSY_COOLDOWN_SECONDS : 0);
let cooldownTimer: ReturnType<typeof setInterval> | undefined;

function login() {
    if (leaving.value || cooldown.value > 0) {
        return;
    }

    leaving.value = true;
    window.location.assign("/auth/42");
}

// Back from the 42 page with the browser's back button: the page comes back as
// it was left, button disabled.
function onPageShow(event: PageTransitionEvent) {
    if (event.persisted) {
        leaving.value = false;
    }
}

onMounted(() => {
    window.addEventListener("pageshow", onPageShow);

    if (cooldown.value > 0) {
        cooldownTimer = setInterval(() => {
            cooldown.value--;

            if (cooldown.value <= 0) {
                clearInterval(cooldownTimer);
            }
        }, 1000);
    }

    // Not shown again on reload.
    if (route.query.login_error) {
        const { login_error: _, ...query } = route.query;
        router.replace({ query });
    }
});

onBeforeUnmount(() => {
    window.removeEventListener("pageshow", onPageShow);
    clearInterval(cooldownTimer);
});
</script>

<template>
    <p
        v-if="loginError"
        class="notice login-error"
        :class="loginError === 'busy' ? 'notice-warning' : 'notice-error'"
        role="alert"
    >
        {{ t(`login.errors.${loginError}`) }}
    </p>
    <button
        class="btn btn-primary login-button"
        :disabled="leaving || cooldown > 0"
        :aria-busy="leaving"
        @click="login"
    >
        <Icon
            :name="leaving ? 'solar:hourglass-bold-duotone' : 'solar:login-3-bold-duotone'"
            class="ico"
            aria-hidden="true"
        />
        <template v-if="leaving">{{ t("login.leaving") }}</template>
        <template v-else-if="cooldown > 0">{{ t("login.retryIn", { count: cooldown }) }}</template>
        <template v-else>{{ props.label }}</template>
    </button>
</template>

<style scoped>
.login-error {
    max-width: 34rem;
}
</style>
