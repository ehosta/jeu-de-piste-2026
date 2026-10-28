<script setup lang="ts">
import type { TeamQuestStatus } from "~~/prisma/generated/enums";

defineProps<{ status: TeamQuestStatus }>();

const { t } = useI18n();
</script>

<template>
    <span class="badge" :class="QUEST_STATUS_TONES[status] && `badge-${QUEST_STATUS_TONES[status]}`">
        {{ t(`questStatus.${status}`) }}
    </span>
</template>
