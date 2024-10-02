<template>
    <li v-if="item" :class="{ active: isExact }">
        <ListNavItemButton :item="item" :active="isExact" v-if="!hasChildren" />
        <details v-if="hasChildren" :open="isActive">
            <summary :class="{ active: isExact }">
                <ListNavItemButton :item="item" :active="isExact" />
            </summary>
            <ListNav>
                <ListNavItem v-for="child in item.children" :key="`nav-item-${item.id}-${child.id}`" :item="child" />
            </ListNav>
        </details>
    </li>
</template>

<script lang="ts" setup>
import type { PropType } from 'vue'
import type { MenuItem } from '../../utils/nav/menu-definition'

const props = defineProps({
    item: Object as PropType<MenuItem>,
})

const route = useRoute()
const router = useRouter()

const isActive = computed(() => {
    if (!props.item?.to || props.item?.href) {
        return false
    }
    const itemRoute = router.resolve(props.item?.to)
    return route.fullPath?.includes(itemRoute.fullPath)
})

const isExact = computed(() => {
    if (!props.item?.to || props.item?.href) {
        return false
    }
    const itemRoute = router.resolve(props.item?.to)
    return route.fullPath === itemRoute.fullPath
})

const hasChildren = computed(() => (props.item?.children?.length ?? 0) > 0)
</script>
