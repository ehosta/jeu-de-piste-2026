<script setup lang="ts">
const { user, clear } = useUserSession();
</script>

<template>
    <div v-if="user">
        <p>Hello {{ user.intraLogin }} ({{ user.role }})</p>
        <button @click="clear">Logout</button>
    </div>

    <a v-else href="/auth/42">Login with 42</a>
</template>
