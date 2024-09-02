<template>
    <!-- <header>Header</header>
    <div class="sidebar">Sidebar</div>
    <div class="content">
        <slot />
    </div> -->
    <div class="drawer lg:drawer-open">
        <input id="my-drawer-2" type="checkbox" class="drawer-toggle" />
        <div class="drawer-content flex flex-col items-start justify-start">
            <!-- Page content here -->
            <Panel class="w-full lg:hidden">
                <label for="my-drawer-2" class="btn btn-block btn-primary drawer-button">Menu</label>
            </Panel>
            <slot />
        </div>
        <div class="drawer-side">
            <label for="my-drawer-2" aria-label="close sidebar" class="drawer-overlay"></label>
            <ListNav class="w-80 p-4">
                <ListNavItem v-for="item in adminMenuStore.menu" :key="`admin-menu-item-${item.id}`" :item="item" />
            </ListNav>
        </div>
    </div>
</template>

<script lang="ts" setup>
const adminMenuStore = useAdminMenuStore()
</script>
