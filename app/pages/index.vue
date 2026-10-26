<script setup lang="ts">
const { user } = useUserSession();
</script>

<template>
    <main class="page">
        <section v-if="!user" class="card center">
            <h1>Bienvenue dans le Campudex</h1>
            <p class="muted">Connecte-toi avec ton compte de l'intra pour jouer.</p>
            <a href="/auth/42" class="btn btn-primary btn-block">
                Se connecter avec 42
            </a>
        </section>

        <PlayerTeam v-else-if="user.role === 'PLAYER'" />

        <section v-else-if="user.role === 'NPC'" class="card center">
            <h1>Donneur de quêtes</h1>
            <p class="muted">
                Scanne le QR code d'un groupe pour lui donner ta quête ou
                juger sa photo.
            </p>
            <NuxtLink to="/scan" class="btn btn-primary btn-block">
                Scanner un QR code
            </NuxtLink>
        </section>

        <section v-else class="card center">
            <h1>Administration</h1>
            <p class="muted">
                Suis les groupes et teste le jeu en te mettant dans la peau
                d'un joueur ou d'un PNJ.
            </p>
            <NuxtLink to="/admin" class="btn btn-primary btn-block">
                Ouvrir l'admin
            </NuxtLink>
        </section>
    </main>
</template>
