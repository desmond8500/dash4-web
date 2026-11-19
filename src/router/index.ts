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
          path: 'stock',
          name: 'stock',
          component: () => import('@/views/StockView.vue'),
          meta: { title: 'Stock', permissions: ['stock.view'] },
        },
        {
          path: 'stock/articles/:id(\\d+)',
          name: 'article',
          component: () => import('@/views/ArticleDetailView.vue'),
          props: true,
          meta: { title: 'Article', permissions: ['stock.view'] },
        },
        {
          path: 'stock/emplacements',
          name: 'storage-locations',
          component: () => import('@/views/StorageLocationsView.vue'),
          meta: { title: 'Emplacements', permissions: ['stock.view'] },
        },
        {
          path: 'stock/emplacements/:id(\\d+)',
          name: 'storage-location',
          component: () => import('@/views/StorageLocationView.vue'),
          props: true,
          meta: { title: 'Emplacement', permissions: ['stock.view'] },
        },
        {
          path: 'demandes/boite-mail',
          name: 'inbox',
          component: () => import('@/views/InboxView.vue'),
          meta: { title: 'Boîte mail des demandes', permissions: ['client_requests.update'] },
        },
        {
          path: 'stock/mouvements',
          name: 'stock-movements',
          component: () => import('@/views/StockMovementsView.vue'),
          meta: { title: 'Mouvements de stock', permissions: ['stock.view'] },
        },
        {
          path: 'stock/fournisseurs',
          name: 'providers',
          component: () => import('@/views/ProvidersView.vue'),
          meta: { title: 'Fournisseurs et marques', permissions: ['stock.view', 'purchases.view', 'purchases.view.own'] },
        },
        {
          path: 'stock/fournisseurs/:id(\\d+)',
          name: 'provider',
          component: () => import('@/views/ProviderDetailView.vue'),
          props: true,
          meta: { title: 'Fournisseur', permissions: ['stock.view', 'purchases.view', 'purchases.view.own'] },
        },
        {
          path: 'stock/marques/:id(\\d+)',
          name: 'brand',
          component: () => import('@/views/BrandDetailView.vue'),
          props: true,
          meta: { title: 'Marque', permissions: ['stock.view', 'purchases.view', 'purchases.view.own'] },
        },
        {
          path: 'achats',
          name: 'purchases',
          component: () => import('@/views/PurchasesView.vue'),
          meta: { title: 'Achats', permissions: ['purchases.view', 'purchases.view.own'] },
        },
        {
          path: 'achats/:id(\\d+)',
          name: 'purchase',
          component: () => import('@/views/PurchaseDetailView.vue'),
          props: true,
          meta: { title: 'Achat', permissions: ['purchases.view', 'purchases.view.own'] },
        },
        {
          path: 'depenses',
          name: 'expenses',
          component: () => import('@/views/ExpensesView.vue'),
          meta: { title: 'Dépenses', permissions: ['accounting.view', 'accounting.view.own'] },
        },
        {
          path: 'depenses/caisses/:id(\\d+)',
          name: 'expense-space',
          component: () => import('@/views/ExpenseSpaceView.vue'),
          props: true,
          meta: { title: 'Caisse', permissions: ['accounting.view', 'accounting.view.own'] },
        },
        {
          path: 'comptabilite',
          name: 'accounting',
          component: () => import('@/views/AccountingView.vue'),
          meta: { title: 'Comptabilité', permissions: ['accounting.view'] },
        },
        {
          path: 'taches',
          name: 'tasks',
          component: () => import('@/views/TasksView.vue'),
          meta: { title: 'Tâches', permissions: ['tasks.view', 'tasks.view.own'] },
        },
        {
          path: 'taches/:id(\\d+)',
          name: 'task',
          component: () => import('@/views/TaskDetailView.vue'),
          props: true,
          meta: { title: 'Tâche', permissions: ['tasks.view', 'tasks.view.own'] },
        },
        {
          path: 'contrats',
          name: 'contracts',
          component: () => import('@/views/ContractsView.vue'),
          meta: { title: 'Contrats', permissions: ['contracts.view'] },
        },
        {
          path: 'contrats/:id(\\d+)',
          name: 'contract',
          component: () => import('@/views/ContractDetailView.vue'),
          props: true,
          meta: { title: 'Contrat', permissions: ['contracts.view'] },
        },
        {
          path: 'journaux',
          name: 'journals',
          component: () => import('@/views/JournalsView.vue'),
          meta: { title: 'Journaux', permissions: ['journals.view', 'journals.view.own'] },
        },
        {
          path: 'journaux/:id(\\d+)',
          name: 'journal',
          component: () => import('@/views/JournalDetailView.vue'),
          props: true,
          meta: { title: 'Journal', permissions: ['journals.view', 'journals.view.own'] },
        },
        {
          path: 'espace-technicien',
          name: 'tech-space',
          component: () => import('@/views/TechSpaceView.vue'),
          meta: { title: 'Espace technicien', permissions: ['tech_shares.view', 'tech_shares.view.own', 'tech_access_requests.view', 'tech_access_requests.view.own'] },
        },
        {
          path: 'planning',
          name: 'planning',
          component: () => import('@/views/PlanningView.vue'),
          meta: { title: 'Planning', permissions: ['tasks.view', 'tasks.view.own'] },
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
