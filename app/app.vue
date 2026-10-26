<script setup lang="ts">
const { user, clear, fetch: fetchSession } = useUserSession();

async function logout() {
    await clear();
    await navigateTo("/");
}

async function stopActing() {
    await $fetch("/api/admin/act-as", {
        method: "POST",
        body: { role: "ADMIN" },
    });
    await fetchSession();
    await navigateTo("/admin");
}
</script>

<template>
    <header class="header">
        <NuxtLink to="/" class="brand">Campudex</NuxtLink>
        <div v-if="user" class="header-user">
            <NuxtLink v-if="user.isAdmin" to="/admin" class="btn btn-small">
                Admin
            </NuxtLink>
            <span class="muted">{{ user.intraLogin }}</span>
            <button class="btn btn-small" @click="logout">Déconnexion</button>
        </div>
    </header>
    <div v-if="user?.actingAs" class="acting-as">
        <span>Mode test : <strong>{{ user.actingAs }}</strong></span>
        <button class="btn btn-small" @click="stopActing">Redevenir admin</button>
    </div>
    <NuxtPage />
</template>

<style scoped>
.header {
    position: sticky;
    top: 0;
    z-index: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
    padding: max(0.5rem, env(safe-area-inset-top)) 1rem 0.5rem;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
}

.brand {
    color: var(--primary);
    font-size: 1.15rem;
    font-weight: 700;
    text-decoration: none;
}

.header-user {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    min-width: 0;
}

.header-user span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.acting-as {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: var(--warning-bg);
    border-bottom: 1px solid var(--border);
}
</style>
