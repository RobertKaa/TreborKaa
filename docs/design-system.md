# Design System - Vexiio

## Objectif
Ce document definit la base visuelle et interactionnelle de l'application.
Toute modification UI (couleurs, formes, composants, etats) doit etre reportee ici dans la section `Changelog DS`.

## Fondation

### Typographie
- Titre: `DM Serif Display`
- Texte UI: `Outfit`
- Labels techniques et meta: `Space Mono`

### Charte Couleur
- Accent principal: `#ef8d35`
- Accent fort: `#d86a21`
- Secondaire: `#0c7f6f`
- Succes: `#2f9962`
- Erreur: `#b53e53`

Theme clair:
- Fond app: `#fcf7ef`
- Fond secondaire: `#f5ecdf`
- Card: `#fff8ee`
- Surface elevee: `#fffdf8`
- Texte principal: `#1f1b2e`
- Texte secondaire: `#605975`

Theme sombre:
- Fond app: `#0c131b`
- Fond secondaire: `#121b26`
- Card: `#182331`
- Surface elevee: `#202d3d`
- Texte principal: `#ecf1f8`
- Texte secondaire: `#a9b6c8`

### Charte Forme
- Rayon petit: `12px`
- Rayon moyen: `16px`
- Rayon grand: `24px`
- Rayon XL cards/modales: `28px`
- Boutons et chips: `999px` (pill)

### Ombres
- Card clair: `0 24px 50px rgba(56, 32, 20, 0.14)`
- Pop clair: `0 22px 42px rgba(34, 20, 14, 0.24)`
- Card sombre: `0 24px 50px rgba(5, 10, 17, 0.55)`
- Pop sombre: `0 22px 42px rgba(3, 7, 14, 0.74)`

## Tokens CSS
Les tokens globaux sont declares dans:
- [src/styles/design-system.css](/C:/Users/sbran/Documents/projects/FindTheFlag/src/styles/design-system.css)

Les tokens semantiques appliques dans l'app shell sont mappes dans:
- [src/app/app.css](/C:/Users/sbran/Documents/projects/FindTheFlag/src/app/app.css)

## Composants

### Boutons
- `primary`: action principale (degrade accent)
- `secondary/ghost`: action secondaire sur surface
- Toutes les actions de modale de fin doivent utiliser un vrai element bouton (`button`) pour rester homogene avec les autres controles.

### Cards
- Utiliser `--card`, `--line`, `--shadow`.
- Rayon standard card: `28px`.

### Modale de fin
- Clic sur backdrop: ferme et relance la partie.
- Actions footer:
  - `Accueil`: navigation vers `/`
  - `Recommencer/Rejouer`: relance immediate du mode courant

## Regles Jeux - Mode Formes
- `Facile`:
  - Affiche la capitale.
  - Pool reduit a ~150 pays (formes les plus reconnaissables).
- `Difficile`:
  - N'affiche pas la capitale.
  - Pool etendu a tous les pays disponibles, en excluant petites iles et archipels.

Implementation:
- [src/app/pages/shape-to-country-game-page.component.ts](/C:/Users/sbran/Documents/projects/FindTheFlag/src/app/pages/shape-to-country-game-page.component.ts)
- [src/app/pages/shape-to-country-game-page.component.html](/C:/Users/sbran/Documents/projects/FindTheFlag/src/app/pages/shape-to-country-game-page.component.html)

## Changelog DS
- `2026-04-26`
  - Refonte palette sombre (`fond` + `card`) avec contraste plus propre et teintes moins violettes.
  - Initialisation des tokens globaux dans `src/styles/design-system.css`.
  - Standardisation action `Accueil` dans les modales de fin avec element `button`.
  - Formalisation des regles `facile/difficile` du mode reconnaissance de formes.
  - Mode formes: `viewBox` dynamique sur la forme pour conserver les proportions visibles des pays tres larges/hauts.
  - Mode formes: taille desktop reduite (`max-width`/`max-height`) pour eviter une silhouette trop dominante.
  - Quiz progression: largeur mobile bornee avec `box-sizing: border-box` + `safe-area` pour supprimer le depassement ecran.
  - Modale de fin (quiz): espace vertical reduit entre liste d'erreurs et boutons d'action pour un footer plus proche du contenu.
  - Home mobile: CTA `Jouer/Reprendre` des cartes de jeux passes en largeur adaptative (`min-width: 0`, colonnes fluides) pour eliminer les depassements horizontaux.
  - Home mobile (`mobile-viewport`): mode classique passe en empilement vertical `Facile` puis `Difficile` avec boutons pleine largeur pour supprimer tout chevauchement.
  - Home mobile: ajout de `box-sizing: border-box` sur les CTA de lancement pour garantir qu'aucun bouton ne depasse de la card avec le padding.
