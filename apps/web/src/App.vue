<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink class="brand" to="/" aria-label="maptoy home">maptoy</RouterLink>
      <nav aria-label="Main navigation">
        <RouterLink to="/">Map</RouterLink>
        <RouterLink to="/map-sets">Map Sets</RouterLink>
        <RouterLink to="/cache">Tile Cache</RouterLink>
        <RouterLink to="/docs">Documentation</RouterLink>
      </nav>
    </header>
    <div class="app-viewport">
      <RouterView />
    </div>
  </div>
</template>
