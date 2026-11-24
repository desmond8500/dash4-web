# dash4-web — consignes

- Front web Vue 3.5 + Vite 8 + TypeScript + Pinia + Vue Router 5 + PrimeVue 4 (Aura). Interface en français, code en anglais.
- Réservé aux comptes gestionnaires ; les techniciens sont renvoyés vers l'application mobile.
- Appels API uniquement via `api` (`src/services/api.ts`, client de `@dash4/shared`) ; types de `@dash4/shared`.
- Chaque page déclare ses permissions dans `meta.permissions` ; chaque entrée de menu dans `src/menu.ts`. L'interface cache, l'API vérifie.
- Composants PrimeVue importés un par un ; styles communs dans `src/style.css`.
- Erreurs d'API : toujours un `try/catch` (jamais un `try/finally` sans `catch`) autour d'un appel `api.*`, message via `toast.add({ severity: 'error', summary: '…', detail: apiErrorMessage(e), life: 5000 })` (`src/utils/errors.ts`). Un formulaire mappe en plus `ApiError.errors` sur ses champs.
- Push direct sur `main` (déployé par Netlify) ; tests Vitest pour la logique (gardes, menu, stores).
