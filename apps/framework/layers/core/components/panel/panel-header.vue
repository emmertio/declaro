<template>
    <div class="flex flex-row align-center gap-2 justify-between grow">
        <div class="flex grow items-center px-2">
            <h2 class="text-xl font-bold">{{ title }}</h2>
        </div>
        <div class="join">
            <slot name="actions" />
        </div>
    </div>
</template>

<script lang="ts" setup>
const props = defineProps({
    title: String,
})
</script>
