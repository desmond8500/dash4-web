# Dash4 — front web

Interface web de l'ERP **Dash4** pour les gestionnaires (les techniciens utilisent l'application mobile).
Vue 3.5, Vite 8, TypeScript, Pinia, Vue Router 5, PrimeVue 4 (thème Aura).

Production : `https://dash4.yonkou.info` (Netlify). API : [dash4-api](https://github.com/desmond8500/dash4-api).

## Ce qui est en place

- Connexion (jeton Bearer), retour automatique à la connexion quand la session expire
- Menu et pages affichés selon les permissions de l'utilisateur (`src/menu.ts`, `meta.permissions` des routes)
- Comptes technicien redirigés vers une page « utilisez l'application mobile »
- Gestion des utilisateurs : liste filtrable, création, modification, profils, désactivation
- Mon profil, thème clair / sombre

## Développement

```bash
cp .env.example .env    # VITE_API_URL=http://localhost:8000/api
npm install
npm run dev             # http://localhost:5173
npm test
npm run build           # vérifie aussi les types (vue-tsc)
```

L'API doit autoriser `http://localhost:5173` dans `FRONTEND_URLS` (c'est le cas par défaut).

Le code commun (types, client API, droits) vient de [dash4-shared](https://github.com/desmond8500/dash4-shared) :
`npm update @dash4/shared` récupère sa dernière version.

## Déploiement Netlify

1. *Add new site > Import an existing project* → GitHub → `dash4-web`.
2. Les réglages de build sont lus dans `netlify.toml` (`npm run build`, dossier `dist`).
3. L'adresse de l'API est déjà dans `netlify.toml` (`VITE_API_URL`) ; une variable du même nom dans Netlify n'est utile que pour la changer.
4. *Domain management* : ajouter `dash4.yonkou.info` et créer chez le DNS de `yonkou.info` l'enregistrement indiqué par Netlify (CNAME `dash4` → `<site>.netlify.app`).
5. Côté API, `FRONTEND_URLS` doit contenir `https://dash4.yonkou.info`.

Chaque push sur `main` est déployé automatiquement.
