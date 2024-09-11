<template>
    <NuxtLink
        :to="item.to"
        :href="item.href"
        class="flex flex-row items-center gap-1.5"
        :class="{
            active: active,
        }"
    >
        <Icon size="1.5em" v-if="item.icon" :name="item.icon" />
        <span>{{ item.label }}</span>
    </NuxtLink>
</template>

<script lang="ts" setup>
import type { PropType } from 'vue'
import type { MenuItem } from '../../utils/nav/menu-definition'

const props = defineProps({
    item: {
        type: Object as PropType<MenuItem>,
        required: true,
    },
    active: {
        type: Boolean,
        default: false,
    },
})
</script>
