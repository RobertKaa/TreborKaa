# Speedrun

Ce document fixe le cadrage produit, UX et securite du mode Speedrun. Il sert de reference pour les tickets Trello lies au mode et pour les futures migrations Supabase.

## Regles MVP

Le run MVP est court, stable et comparable entre joueurs.

- Format: 6 questions, sans pause.
- Etapes: pays vers drapeau facile, drapeau vers pays facile, capitale vers drapeau facile, puis les memes formats en difficile.
- Ordre: fixe pour le MVP afin de limiter la complexite UX et faciliter la validation serveur. Une seed quotidienne pourra remplacer cet ordre plus tard.
- Timer: demarre apres le compte a rebours et s'arrete a la derniere reponse.
- Erreur: chaque mauvaise reponse ajoute 5 secondes au temps classe.
- Skip: non disponible dans le MVP.
- Abandon ou refresh: run non classe.
- Invite: le joueur peut jouer, mais aucun score public n'est envoye.
- Connecte: meilleur temps local conserve, score public uniquement via validation backend.

Un temps public valide doit respecter ces conditions:

- utilisateur authentifie;
- run demarre cote serveur;
- run termine via l'endpoint de validation;
- etapes et ordre conformes a la regle courante;
- temps brut coherent avec les horodatages serveur;
- score soumis une seule fois pour un `attempt_id`;
- aucune ecriture directe frontend dans une table de classement public.

## Textes affichables

FR:

- "Six questions, un timer continu."
- "Chaque erreur ajoute 5 secondes."
- "Connecte-toi pour envoyer un temps classe."
- "Un run interrompu n'est pas classe."

EN:

- "Six questions, one continuous timer."
- "Each mistake adds 5 seconds."
- "Sign in to submit a ranked time."
- "An interrupted run is not ranked."

## Gamification

Le Speedrun ne doit pas encourager le grind aveugle. Les recompenses doivent valoriser la precision, la comprehension et l'amelioration personnelle.

Succeses proposes:

- Premier run Speedrun: terminer un run, meme avec erreurs.
- Run valide: terminer un run connecte et accepte par le backend.
- Sans erreur: terminer les 6 etapes sans penalite.
- Sous 60 secondes: atteindre un premier temps cible accessible.
- Sous 40 secondes: cible avancee.
- Regularite: ameliorer son meilleur temps 3 fois.

Decision XP:

- Pas d'XP proportionnelle a chaque run pour eviter le farm.
- XP uniquement via succes Speedrun.
- Les records personnels sont visibles dans le profil, mais separes du classement public.

Profil et menu joueur:

- Afficher le meilleur temps personnel Speedrun.
- Afficher le statut "non classe" quand le temps est local uniquement.
- Afficher les succes Speedrun avec les autres succes, sans section separee au MVP.

Saisonnalite:

- Hors MVP.
- A envisager plus tard avec des seeds hebdomadaires et une table de saisons.

## Strategie anti-triche

Menaces couvertes:

- timer modifie dans le navigateur;
- payload de score modifie avant l'envoi;
- refresh ou navigation pour eviter une erreur;
- multi-submit du meme run;
- temps impossibles;
- ordre d'etapes exploite sans validation.

Strategie MVP:

- `speedrun-start` cree un `attempt_id`, une seed et un plan d'etapes cote serveur.
- `speedrun-submit` accepte uniquement un utilisateur authentifie.
- La fonction recharge l'attempt, refuse tout attempt deja termine et valide les bornes du temps.
- Le temps classe est recalcule cote serveur avec la penalite officielle.
- Les tables privees n'ont pas de policy d'ecriture frontend.
- La table publique de leaderboard ne contient que les champs affichables.

Ce niveau ne rend pas la triche impossible, mais ferme les failles triviales et evite les scores publics ecrits directement depuis Angular.

## UX/UI

Parcours retenu:

- entree visible sur l'accueil, mais distincte de la liste classique;
- ecran de preparation avec 3 regles courtes;
- compte a rebours avant timer;
- timer dans un dock sticky pour rester lisible sans recouvrir les choix;
- feedback correct/erreur via les cartes de reponse deja standardisees;
- resultat final avec temps brut, penalite, temps classe et erreurs;
- page classement separee avec meilleur temps personnel et top public.

Mobile:

- boutons pleine largeur ou grille simple sous 640 px;
- zone drapeau avec hauteur minimale reduite;
- dock sticky compact;
- aucun texte critique dans une zone trop etroite;
- navigation clavier conservee par boutons et liens natifs.

## Leaderboard securise

Tables:

- `speedrun_run_attempts`: table privee des attempts, validation et payload technique.
- `speedrun_leaderboard`: table publique sanitisee pour l'affichage.

Lecture:

- `anon` et `authenticated` peuvent lire `speedrun_leaderboard`.
- La page limite l'affichage au top 50.

Ecriture:

- aucune policy `insert`, `update` ou `delete` pour `anon` ou `authenticated`.
- seules les Edge Functions avec service role peuvent ecrire.

Etats UI attendus:

- chargement;
- classement vide;
- erreur de lecture;
- meilleur temps personnel local;
- top public trie par `total_time_ms`.
