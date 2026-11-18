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
          path: 'clients',
          name: 'clients',
          component: () => import('@/views/ClientsView.vue'),
          meta: { title: 'Clients', permissions: ['clients.view', 'clients.view.own'] },
        },
        {
          path: 'clients/:id(\\d+)',
          name: 'client',
          component: () => import('@/views/ClientDetailView.vue'),
          props: true,
          meta: { title: 'Fiche client', permissions: ['clients.view', 'clients.view.own'] },
        },
        {
          path: 'demandes',
          name: 'client-requests',
          component: () => import('@/views/ClientRequestsView.vue'),
          meta: { title: 'Demandes clients', permissions: ['client_requests.view', 'client_requests.view.own'] },
        },
        {
          path: 'projets',
          name: 'projects',
          component: () => import('@/views/ProjectsView.vue'),
          meta: { title: 'Projets', permissions: ['projects.view', 'projects.view.own'] },
        },
        {
          path: 'projets/:id(\\d+)',
          name: 'project',
          component: () => import('@/views/ProjectDetailView.vue'),
          props: true,
          meta: { title: 'Projet', permissions: ['projects.view', 'projects.view.own'] },
        },
        {
          path: 'devis',
          name: 'quotes',
          component: () => import('@/views/QuotesView.vue'),
          meta: { title: 'Devis', permissions: ['quotes.view', 'quotes.view.own'] },
        },
        {
          path: 'devis/modeles',
          name: 'quote-templates',
          component: () => import('@/views/QuoteTemplatesView.vue'),
          meta: { title: 'Modèles de devis', permissions: ['quotes.create', 'quotes.update', 'quotes.update.own'] },
        },
        {
          path: 'devis/:id(\\d+)',
          name: 'quote',
          component: () => import('@/views/QuoteDetailView.vue'),
          props: true,
          meta: { title: 'Devis', permissions: ['quotes.view', 'quotes.view.own'] },
        },
        {
          path: 'factures',
          name: 'invoices',
          component: () => import('@/views/InvoicesView.vue'),
          meta: { title: 'Factures', permissions: ['invoices.view'] },
        },
        {
          path: 'factures/:id(\\d+)',
          name: 'invoice',
          component: () => import('@/views/InvoiceDetailView.vue'),
          props: true,
          meta: { title: 'Facture', permissions: ['invoices.view'] },
        },
        {
          path: 'contacts',
          name: 'contacts',
          component: () => import('@/views/ContactsView.vue'),
          meta: { title: 'Contacts', permissions: ['clients.view', 'clients.view.own'] },
        },
        {
          path: 'utilisateurs',
          name: 'users',
          component: () => import('@/views/UsersView.vue'),
          meta: { title: 'Utilisateurs', permissions: ['users.view'] },
        },
        {
          path: 'entreprise',
          name: 'company',
          component: () => import('@/views/CompanyView.vue'),
          meta: { title: 'Entreprise et paramètres', permissions: ['company.view', 'bank.view', 'signature.manage', 'settings.view'] },
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
