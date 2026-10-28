<script setup lang="ts">
// Lets an admin switch between the admin dashboard, their own team and NPC,
// and the view of any team, NPC or account, from every page, in this session
// only (see /api/admin/act-as). Bocal only get their own team and NPC.
const { user: sessionUser } = useUserSession();
const { actAs } = useActAs();
const { t } = useI18n();
const { data, refresh } = useFetch("/api/admin/views", {
    key: "admin-views",
    server: false,
});
const busy = ref(false);

// The admin's own team and NPC are listed under "Moi" only.
const teams = computed(() =>
    (data.value?.teams ?? []).filter((team) => team.id !== data.value?.me.team?.id),
);
const npcs = computed(() =>
    (data.value?.npcs ?? []).filter((npc) => npc.id !== data.value?.me.npc?.id),
);

async function switchTo(value: string) {
    busy.value = true;

    try {
        await actAs(parseActAsValue(value));
    } catch {
        // The team, NPC or account was deleted meanwhile: show the up-to-date list.
        await refresh();
    } finally {
        busy.value = false;
    }
}
</script>

<template>
    <select
        class="select select-small dashboard-switch"
        :aria-label="t('header.switchView')"
        :value="data?.current ?? 'ADMIN'"
        :disabled="busy"
        @focus="refresh()"
        @change="switchTo(($event.target as HTMLSelectElement).value)"
    >
        <option value="ADMIN">{{ sessionUser?.isAdmin ? t("header.adminSelf") : t("header.bocalSelf") }}</option>
        <optgroup v-if="data?.me.team || data?.me.npc" :label="t('header.me')">
            <option v-if="data.me.team" :value="`PLAYER:${data.me.team.id}`">
                {{ t("header.myTeam", { name: data.me.team.name }) }}
            </option>
            <option v-if="data.me.npc" :value="`NPC:${data.me.npc.id}`">
                {{ t("header.myNpc", { name: data.me.npc.name }) }}
            </option>
        </optgroup>
        <optgroup v-if="teams.length" :label="t('header.player')">
            <option v-for="team in teams" :key="team.id" :value="`PLAYER:${team.id}`">
                {{ t("header.playerOf", { name: team.name }) }}
            </option>
        </optgroup>
        <optgroup v-if="npcs.length" :label="t('header.npc')">
            <option v-for="npc in npcs" :key="npc.id" :value="`NPC:${npc.id}`">
                {{ t("header.npcNamed", { name: npc.name }) }}
            </option>
        </optgroup>
        <optgroup v-if="data?.users.length" :label="t('header.impersonateAccount')">
            <option v-for="user in data.users" :key="user.id" :value="`USER:${user.id}`">
                {{ t("header.accountRole", { login: user.login, role: t(`roles.${user.role}`) }) }}
            </option>
        </optgroup>
    </select>
</template>

<style scoped>
.dashboard-switch {
    max-width: 16rem;
}
</style>
