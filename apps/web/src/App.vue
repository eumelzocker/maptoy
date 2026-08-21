<template>
  <div class="shell">
    <header class="topbar">
      <RouterLink class="brand" to="/" aria-label="maptoy home">maptoy</RouterLink>
      <nav aria-label="Main navigation">
        <RouterLink to="/">Map</RouterLink>
        <RouterLink to="/docs/en">Documentation</RouterLink>
      </nav>
    </header>
    <RouterView />
  </div>
</template>
