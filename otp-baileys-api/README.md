# OTP Baileys API

API Node.js/Express/TypeScript pour l'authentification OTP via WhatsApp (Baileys).

## Stack
- **Runtime**: Node.js 18+, TypeScript
- **Framework**: Express
- **WhatsApp**: @adiwajshing/baileys
- **DB**: PostgreSQL
- **Cache/Rate-limit**: Redis
- **Auth**: JWT

## Setup

### 1. Installer les dépendances
```bash
npm install
```

### 2. Configurer l'environnement
```bash
cp .env.example .env
# Éditer .env avec tes valeurs
```

### 3. Initialiser la base de données
```bash
psql -U user -d dbname -f schema.sql
```

### 4. Démarrer en développement
```bash
npm run dev
```

Au premier démarrage, un QR code s'affiche dans le terminal — scanne-le avec le compte WhatsApp expéditeur.

## Endpoints

### POST /api/auth/send-otp
```json
{ "phone": "237612345678" }
```
Réponse :
```json
{ "ok": true, "sent": true, "debug_otp": "123456" }
```
*(debug_otp uniquement si SMS_ALLOW_RETURN_OTP=true et NODE_ENV≠production)*

### POST /api/auth/verify-otp
```json
{ "phone": "237612345678", "code": "123456" }
```
Réponse :
```json
{ "ok": true, "token": "JWT...", "is_new_user": true }
```

## Sécurité
- Ne jamais activer `SMS_ALLOW_RETURN_OTP=true` en production.
- Ne pas exposer les fichiers `baileys_store/` publiquement.
- WhatsApp peut bannir le compte en cas d'envoi massif.
