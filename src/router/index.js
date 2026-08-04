import { createRouter, createWebHashHistory } from 'vue-router'
import IpcDemoView from '../views/IpcDemoView.vue'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      component: IpcDemoView,
      name: 'home',
      path: '/',
    },
    {
      component: () => import('../views/AboutView.vue'),
      name: 'about',
      path: '/about',
    },
  ],
})

export default router
