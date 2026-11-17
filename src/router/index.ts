import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { onUnauthorized } from '@/services/api'
import { resolveNavigation } from './guard'
import AppLayout from '@/layouts/AppLayout.vue'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/connexion',
      name: 'login',
      component: () => import('@/views/LoginView.vue'),
      meta: { public: true, title: 'Connexion' },
    },
    {
      path: '/technicien',
      name: 'technician',
      component: () => import('@/views/TechnicianView.vue'),
      meta: { title: 'Application mobile' },
    },
    {
      path: '/',
      component: AppLayout,
      children: [
        {
          path: '',
          name: 'home',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: 'Tableau de bord' },
        },
        {
          path: 'utilisateurs',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: { title: 'Utilisateurs', permissions: ['users.view'] },
        },
        {
          path: 'profil',
          name: 'profile',
          component: () => import('@/views/ProfileView.vue'),
          meta: { title: 'Mon profil' },
        },
        {
          path: 'acces-refuse',
          name: 'forbidden',
          component: () => import('@/views/ForbiddenView.vue'),
          meta: { title: 'Accès refusé' },
        },
        {
          path: ':pathMatch(.*)*',
          name: 'not-found',
          component: () => import('@/views/NotFoundView.vue'),
          meta: { title: 'Page introuvable' },
        },
      ],
    },
  ],
})

router.beforeEach(async (to) => {
  const auth = useAuthStore()
  await auth.init()

  return resolveNavigation(to, {
    isAuthenticated: auth.isAuthenticated,
    isTechnician: auth.isTechnician,
    canAny: auth.canAny,
  })
})

router.afterEach((to) => {
  document.title = to.meta.title ? `${to.meta.title} · Dash4` : 'Dash4'
})

// Jeton expiré ou compte désactivé : retour à la connexion
onUnauthorized(() => {
  useAuthStore().clear()
  const current = router.currentRoute.value
  if (!current.meta.public) {
    void router.push({ name: 'login', query: { redirect: current.fullPath } })
  }
})
