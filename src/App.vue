<script setup>
import { RouterLink, RouterView } from 'vue-router'
</script>

<template>
  <div class="app-shell">
    <header class="app-header">
      <div>
        <p class="app-kicker">Electron Native App</p>
        <h1>Renderer-only Vite</h1>
      </div>

      <nav aria-label="主导航">
        <RouterLink to="/">IPC 示例</RouterLink>
        <RouterLink to="/about">关于</RouterLink>
      </nav>
    </header>

    <main class="app-main">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-shell {
  min-height: 100vh;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 24px;
  min-height: 76px;
  padding: 14px clamp(20px, 4vw, 48px);
  color: #ffffff;
  background: #18212f;
  border-bottom: 3px solid #16a394;
}

.app-kicker {
  margin: 0 0 2px;
  color: #9ee5dc;
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

h1 {
  margin: 0;
  color: inherit;
  font-size: 20px;
  font-weight: 650;
}

nav {
  display: flex;
  gap: 6px;
}

nav a {
  padding: 8px 12px;
  color: #cbd5e1;
  border-radius: 4px;
}

nav a:hover,
nav a.router-link-exact-active {
  color: #ffffff;
  background: #344054;
}

.app-main {
  width: min(1280px, 100%);
  margin: 0 auto;
  padding: 28px clamp(16px, 4vw, 48px) 48px;
}

@media (max-width: 560px) {
  .app-header {
    align-items: flex-start;
    flex-direction: column;
    gap: 10px;
  }
}
</style>
