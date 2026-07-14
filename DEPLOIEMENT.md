# Guide de déploiement — Football Analysis

On repart avec un dépôt tout neuf pour éviter toute confusion avec les tentatives précédentes. Les anciens dépôts/projets ne servent plus à rien : ignore-les, tu pourras les supprimer plus tard si tu veux.

**Envoie-moi une capture après chaque PARTIE (B, C, D), pas seulement à la fin.**

---

## PARTIE A — Préparer le fichier sur ton ordinateur

**A1.** Ouvre le Finder, clique sur **Téléchargements** dans la colonne de gauche.

**A2.** Cherche le fichier `football-analysis.zip`. S'il y a plusieurs versions (`football-analysis (1).zip` etc.), garde uniquement la plus récente (colonne "Modifié le"), mets les autres à la corbeille.

**A3.** Double-clique dessus. Un dossier `football-analysis` apparaît.

**A4.** Ouvre ce dossier. Tu dois voir exactement :
- un dossier `src`
- `DEPLOIEMENT.md`
- `index.html`
- `package.json`
- `vite.config.js`

**A5.** Ouvre le dossier `src` : 2 fichiers dedans, `App.jsx` et `main.jsx`.

Si tout correspond, passe à la Partie B.

---

## PARTIE B — Créer un nouveau dépôt GitHub

**B1.** Va sur **github.com**, vérifie que ton avatar est affiché en haut à droite (connecté).

**B2.** Clique sur le **+** en haut à droite, puis sur **New repository**.

**B3.** Dans le champ **Repository name**, tape : `football-analysis`. Ne touche à rien d'autre. Descends tout en bas, clique sur le bouton vert **Create repository**.

**B4.** Sur la page du dépôt vide, clique sur les mots bleus soulignés **uploading an existing file** (dans la phrase *"Get started by creating a new file or uploading an existing file"*).

**B5.** Reviens au Finder, dans le dossier `football-analysis` décompressé. Clique une fois dans la fenêtre, appuie sur **Cmd+A**, puis fais glisser toute la sélection vers la zone grise du navigateur.

**B6.** Patiente que la liste des fichiers apparaisse (avec le dossier `src` dedans).

**B7.** Descends tout en bas, clique sur le bouton vert **Commit changes**.

**→ Envoie-moi une capture de la page du dépôt avant de continuer.**

---

## PARTIE C — Déployer sur Vercel

**C1.** Va sur **vercel.com**, vérifie que tu es connecté.

**C2.** Clique sur **Add New...** puis **Project**.

**C3.** Cherche `football-analysis` dans la liste des dépôts. S'il n'apparaît pas, clique sur **Adjust GitHub App Permissions** (ou **Install**), autorise l'accès, reviens sur cette page.

**C4.** Clique sur **Import** à droite de `football-analysis`.

**C5.** Ne touche à aucun champ. Ignore la section "Environment Variables", laisse-la vide. Clique directement sur **Deploy**.

**C6.** Patiente 30 secondes à 2 minutes pendant que les logs défilent.

**→ Envoie-moi une capture du résultat (confettis ou erreur en rouge).**

---

## PARTIE D — Vérifier

**D1.** Si succès : clique sur **Continue to Dashboard**, repère l'adresse du type `football-analysis-xxxxx.vercel.app`, clique dessus.

**D2.** Tu dois voir un fond très sombre, "ASSISTANT COACHING" en petit en haut, **"Football Analysis"** en gros, et un bouton doré **+ Nouveau match**.

**D3.** Clique dessus, remplis les 3 champs, clique sur **Commencer le tagging**.

**D4.** Tu arrives sur un écran avec un cadre en pointillés et un bouton **Choisir la vidéo** — teste avec une petite vidéo.

**→ Dernière capture pour confirmer.**
