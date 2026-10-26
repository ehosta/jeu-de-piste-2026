<script setup lang="ts">
import type { TeamQuestStatus } from "~~/prisma/generated/enums";

definePageMeta({
    middleware: () => {
        const { user } = useUserSession();

        if (!user.value?.isAdmin) {
            return navigateTo("/");
        }
    },
});

const { fetch: fetchSession } = useUserSession();
const { data, refresh } = await useFetch("/api/admin/overview");

const teamId = ref("");
const npcId = ref("");
const newLogins = ref<Record<string, string>>({});
const busy = ref(false);
const error = ref("");

const STATUS_LABELS: Record<TeamQuestStatus, string> = {
    HIDDEN: "Pas donnée",
    GIVEN: "Donnée",
    SUBMITTED: "Photo envoyée",
    VALIDATED: "Validée",
    REJECTED: "Refusée",
};

const quests = computed(() =>
    (data.value?.npcs ?? []).flatMap((npc) =>
        npc.quests.map((quest) => ({ ...quest, npc: npc.name })),
    ),
);

watchEffect(() => {
    teamId.value ||= data.value?.teams[0]?.id ?? "";
    npcId.value ||= data.value?.npcs[0]?.id ?? "";
});

async function run(
    action: () => Promise<unknown>,
    messages: Record<number, string> = {},
) {
    busy.value = true;
    error.value = "";

    try {
        await action();
    } catch (err) {
        const statusCode = (err as { statusCode?: number }).statusCode ?? 0;
        error.value =
            messages[statusCode] ?? "Quelque chose s'est mal passé, réessaie.";
    } finally {
        busy.value = false;
    }
}

function actAs(body: { role: "PLAYER" | "NPC" | "ADMIN"; teamId?: string; npcId?: string }) {
    return run(async () => {
        await $fetch("/api/admin/act-as", { method: "POST", body });
        await fetchSession();
        await navigateTo(body.role === "NPC" ? "/scan" : "/");
    });
}

function createTestData() {
    return run(async () => {
        await $fetch("/api/admin/test-data", { method: "POST" });
        await refresh();
    });
}

function addMember(teamId: string) {
    return run(
        async () => {
            await $fetch("/api/admin/team-members", {
                method: "POST",
                body: { teamId, intraLogin: newLogins.value[teamId] },
            });
            newLogins.value[teamId] = "";
            await refresh();
        },
        {
            400: "Ce login 42 n'est pas valide.",
            409: "Ce login est admin ou PNJ, il ne peut pas être joueur.",
        },
    );
}

function removeMember(intraLogin: string) {
    return run(async () => {
        await $fetch("/api/admin/team-members", {
            method: "DELETE",
            body: { intraLogin },
        });
        await refresh();
    });
}

function setStatus(teamId: string, questId: string, status: string) {
    return run(async () => {
        await $fetch("/api/admin/team-quest", {
            method: "PUT",
            body: { teamId, questId, status },
        });
        await refresh();
    });
}
</script>

<template>
    <main class="page">
        <h1>Administration</h1>
        <p v-if="error" class="error" role="alert">{{ error }}</p>

        <section class="card">
            <h2>Se mettre dans la peau de…</h2>
            <p class="muted">
                Seulement pour cette session : tu peux être PNJ sur ton
                téléphone et rester admin sur ton ordinateur.
            </p>

            <form
                v-if="data?.teams.length"
                class="field"
                @submit.prevent="actAs({ role: 'PLAYER', teamId })"
            >
                <label for="act-team">Un joueur du groupe</label>
                <div class="row">
                    <select id="act-team" v-model="teamId">
                        <option
                            v-for="team in data.teams"
                            :key="team.id"
                            :value="team.id"
                        >
                            {{ team.name }}
                        </option>
                    </select>
                    <button class="btn btn-primary" :disabled="busy">Jouer</button>
                </div>
            </form>

            <form
                v-if="data?.npcs.length"
                class="field"
                @submit.prevent="actAs({ role: 'NPC', npcId })"
            >
                <label for="act-npc">Le PNJ</label>
                <div class="row">
                    <select id="act-npc" v-model="npcId">
                        <option
                            v-for="npc in data.npcs"
                            :key="npc.id"
                            :value="npc.id"
                        >
                            {{ npc.name }}
                        </option>
                    </select>
                    <button class="btn btn-primary" :disabled="busy">Jouer</button>
                </div>
            </form>

            <p v-if="!data?.teams.length || !data?.npcs.length" class="muted">
                Il faut au moins un groupe et un PNJ. Crée des données de test
                ci-dessous.
            </p>
        </section>

        <section class="card">
            <h2>Données de test</h2>
            <p class="muted">
                Crée le groupe « Les Testeurs » et un « PNJ de test » avec deux
                quêtes. Ne fait rien s'ils existent déjà.
            </p>
            <button class="btn btn-block" :disabled="busy" @click="createTestData">
                Créer les données de test
            </button>
        </section>

        <section v-for="team in data?.teams" :key="team.id" class="card">
            <div class="team-header">
                <h2>{{ team.name }}</h2>
                <a
                    :href="`/api/teams/${team.id}/qrcode`"
                    target="_blank"
                    class="btn btn-small"
                >
                    QR code
                </a>
            </div>

            <ul v-if="team.members.length" class="members">
                <li v-for="login in team.members" :key="login" class="member">
                    {{ login }}
                    <button
                        class="member-remove"
                        :aria-label="`Retirer ${login} du groupe`"
                        :disabled="busy"
                        @click="removeMember(login)"
                    >
                        ✕
                    </button>
                </li>
            </ul>
            <p v-else class="muted">Aucun membre.</p>

            <form class="row" @submit.prevent="addMember(team.id)">
                <input
                    v-model="newLogins[team.id]"
                    type="text"
                    placeholder="Login 42 d'un joueur"
                    :aria-label="`Ajouter un joueur à ${team.name}`"
                    autocapitalize="none"
                    autocomplete="off"
                    spellcheck="false"
                    required
                >
                <button class="btn btn-primary" :disabled="busy">Ajouter</button>
            </form>

            <p v-if="!quests.length" class="muted">Aucune quête pour l'instant.</p>

            <div v-for="quest in quests" :key="quest.id" class="field">
                <label :for="`status-${team.id}-${quest.id}`">
                    {{ quest.label }}
                    <span class="muted">· {{ quest.npc }}</span>
                </label>
                <select
                    :id="`status-${team.id}-${quest.id}`"
                    :value="team.progress[quest.id]?.status ?? 'HIDDEN'"
                    :disabled="busy"
                    @change="
                        setStatus(
                            team.id,
                            quest.id,
                            ($event.target as HTMLSelectElement).value,
                        )
                    "
                >
                    <option
                        v-for="(label, status) in STATUS_LABELS"
                        :key="status"
                        :value="status"
                    >
                        {{ label }}
                    </option>
                </select>
                <a
                    v-if="team.progress[quest.id]?.photoPath"
                    :href="`/api/photos/${team.progress[quest.id]?.photoPath}`"
                    target="_blank"
                    class="photo-link"
                >
                    Voir la photo
                </a>
            </div>
        </section>
    </main>
</template>

<style scoped>
.field {
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
}

.field label {
    font-weight: 600;
}

.row {
    display: flex;
    gap: 0.5rem;
}

.row select,
.row input {
    flex: 1;
    min-width: 0;
}

select,
input {
    min-height: 3rem;
    padding: 0.5rem 0.75rem;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--text);
    font: inherit;
}

.members {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    margin: 0;
    padding: 0;
    list-style: none;
}

.member {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.25rem 0.25rem 0.75rem;
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 999px;
}

.member-remove {
    width: 2rem;
    height: 2rem;
    border: none;
    border-radius: 999px;
    background: transparent;
    color: var(--muted);
    font: inherit;
    cursor: pointer;
}

.photo-link {
    color: var(--primary);
    font-weight: 600;
}

.team-header {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
}
</style>
