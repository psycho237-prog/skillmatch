# SkillMatch

SkillMatch est une plateforme de mise en relation entre prestataires de services et clients, avec un système de paiement sécurisé (Escrow) et des fonctionnalités avancées d'échange de compétences (Skill-to-Skill) et de services rémunérés (Skill-to-Cash).

## Table des Matières
1. [Pour les Utilisateurs (Clients et Prestataires)](#pour-les-utilisateurs)
2. [Modèles de Transaction (Escrow)](#modèles-de-transaction)
3. [Pour les Administrateurs](#pour-les-administrateurs)

---

## Pour les Utilisateurs

### 1. Inscription et Authentification
- Lancez l'application et suivez le tutoriel de bienvenue (Onboarding).
- Créez un compte avec votre **email**, **mot de passe** et **nom complet**.
- Vous serez connecté automatiquement après la création de compte.
- Depuis l'onglet "Profile", vous pouvez mettre à jour vos informations (avatar, bio, et demander la certification Pro).

### 2. Trouver un Service
- L'onglet **Home** affiche les services mis en avant (Featured) et recommandés.
- L'onglet **Explore** vous permet de rechercher des services avec une **barre de recherche dynamique**.
- Vous pouvez filtrer les résultats par **Catégorie** (ajoutées dynamiquement par l'admin) et par **Type de Paiement** (Skill-to-Skill ou Cash-to-Skill).

### 3. Poster un Service
- Allez dans l'onglet **Post** (l'icône "+" centrale).
- Remplissez les informations de base :
  - **Images** (jusqu'à 10 photos)
  - **Titre**, **Description**, **Catégorie** et **Localisation**.
- Choisissez le modèle économique :
  - **Skill-to-Cash** : Vous définissez un prix fixe en monnaie locale (XAF, XOF, etc.).
  - **Skill-to-Skill** : Un échange de services (Troc). Vous précisez la compétence recherchée en retour. Un montant de **Holdup (Garantie d'engagement)** est exigé pour sécuriser le troc.
- Le service sera instantanément visible sur la plateforme.

---

## Modèles de Transaction

### Le Système "Escrow" (Séquestre)
Pour garantir la sécurité et la confiance, SkillMatch utilise un système de paiement où les fonds sont gelés jusqu'à la complétion du service.

#### Flux Skill-to-Cash (Achat classique)
1. **Paiement initial** : Le client paie le service via PawaPay (Mobile Money). L'argent est stocké dans un portefeuille virtuel (Escrow) et non transféré directement au prestataire.
2. **Exécution** : Le prestataire réalise le service.
3. **Livraison et Validation** : Le prestataire indique que le service est terminé. Le client doit valider.
4. **Déblocage** : Une fois validé, les fonds sont transférés sur le portefeuille interne (Wallet) du prestataire (moins la commission de la plateforme).
5. **Retrait** : Le prestataire peut retirer son solde vers son compte Mobile Money depuis l'onglet **Wallet**.

#### Flux Skill-to-Skill (Échange de compétences)
1. **Engagement** : Les deux utilisateurs doivent déposer le montant "Holdup" (ex: 500 XAF) comme garantie de leur sérieux.
2. **Validation mutuelle** : Les deux utilisateurs confirms que l'échange a eu lieu avec succès.
3. **Remboursement** : Les montants de garantie sont remboursés intégralement sur leurs portefeuilles (Wallet) respectifs, sans commission.
4. **Litige** : Si un utilisateur ne remplit pas sa part du marché, un litige est ouvert et l'administrateur tranche. L'utilisateur fautif perd sa garantie au profit de l'autre.

---

## Pour les Administrateurs

L'interface d'administration est cachée des utilisateurs normaux. Seuls les super-admins y ont accès.

### Accès au Panel Admin
- Connectez-vous avec un compte ayant le statut `superadmin` dans la base de données.
- Cliquez sur le bouton "Admin Panel" qui apparaîtra dans les paramètres du profil.

### Fonctionnalités Admin
1. **Statistiques Globales** : Vue d'ensemble des métriques (Total utilisateurs, Services actifs, Utilisateurs Pro, Services mis en avant).
2. **Gestion des Catégories** : 
   - Vous pouvez **ajouter** de nouvelles catégories en temps réel.
   - Ces catégories apparaîtront instantanément chez les clients pour la recherche et la création de services.
   - Vous pouvez **supprimer** une catégorie (impossible si elle est actuellement utilisée par des services existants).
3. **Paramètres de la Plateforme** :
   - Ajustez le pourcentage de **commission** prélevé sur les ventes "Skill-to-Cash".
   - Modifiez le prix des abonnements Pro (Mensuel / Annuel).
4. **Gestion des Utilisateurs** : Voir la liste des utilisateurs, les certifier, les suspendre ou gérer leur rôle.
5. **Gestion des Litiges** : Intervenir dans les transactions "Disputed" (Contestées) et choisir de rembourser le client ou de payer le prestataire.

### Gestion du Portefeuille Plateforme (Wallet)
- Les commissions perçues par SkillMatch sont stockées sur le portefeuille système (ID=1).
- Les administrateurs peuvent voir le total des revenus générés.
