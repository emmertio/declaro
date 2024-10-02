<template>
    <Panel> Testing {{ $route.params.test }} </Panel>
</template>

<script lang="ts" setup>
definePageMeta({
    title: 'Admin',
    layout: 'dashboard',
})
</script>
