<template>
    <div class="mx-auto max-w-3xl px-4 py-10 lg:max-w-4xl lg:px-8 lg:py-16">
        <ContentRenderer v-if="page" :value="page" :prose="true" class="prose" />
        <div v-else>
            <p>Page not found</p>
            <NuxtLink to="/">Go back to home</NuxtLink>
        </div>
    </div>
</template>

<script lang="ts" setup>
import { isEmpty } from '@declaro/core'
const route = useRoute()

const path = computed(() => {
    return (isEmpty(route.path) ? '/' : route.path) as string
})

const { data: page } = await useAsyncData(async () => {
    const results = await queryCollection('content').path(path.value).first()

    return results
})
</script>
