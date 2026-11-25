# TODO

## Général

- [x] Ajouter un bouton qui redirige vers le haut de la page (web et mobile) — bouton flottant « Haut de page » sur le web (toutes les pages, apparaît après défilement) ; sur mobile, bouton au-dessus de la barre d'onglets (fait remonter l'écran affiché, non testé sur l'app elle-même)
- [x] Réarrager les formulaires pour que les contenu des champs soient lisibles — modèles de devis : désignation/référence n'étaient plus lisibles (colonnes écrasées par les autres champs à largeur fixe) ; le tableau défile désormais horizontalement et ces deux colonnes ont une largeur minimale.
- [ ] toggle de la sidebar

## Modèles de devis

- [x] Pouvoir ajouter un article du stock et remplir le champ — colonne « Article » dans l'édition d'un modèle : recherche un article, reprend désignation/catégorie/unité (et coût/coefficient avec costs.view)
- [x] affichier les images des articles s'il sont liés aux articles du stock — vignette (photo ou icône) devant chaque ligne liée, cliquable vers la fiche article

## Stock
- [x] Choix d'affichage des articles en carte ou en liste — bascule liste/carte à droite des filtres (Stock), gardée d'une visite à l'autre
- [x] Dupliquer un article — bouton « Dupliquer » sur la fiche article (copie tout sauf code-barres, image et quantité, qui repart de 0)