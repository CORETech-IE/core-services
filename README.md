# core-services

**Multi-client backend service for PDF/ZPL generation, email sending, and logging.**

This service loads **client-specific configuration** securely from encrypted files using [SOPS](https://github.com/getsops/sops) and [GPG](https://gnupg.org/).

---

## 🧠 What This Service Does

- Generates PDFs from templates.
- Generates ZPL (Zebra label printer) content.
- Sends emails via OAuth2 SMTP (e.g., Microsoft 365).
- Emits job logs with traceability.
- All configuration is **per client**, securely encrypted.

---

## ⚙️ Requirements

1. **Node.js** (v18 or later)
2. **npm**
3. **Git**
4. **SOPS** (You can use `sops.exe` on Windows)
5. A cloned copy of the private configuration repo: `core-envs-private`

Folder layout must look like this:

```
C:/CORE/GitHub/
├── core-services/
└── core-envs-private/
```

---

## 🔐 Initial Setup

### 1. Clone the configuration repo

```bash
cd C:/CORE/GitHub/
git clone git@github.com:yourorg/core-envs-private.git
```

### 2. Decrypt secrets

Replace `core-dev` with your client ID:

```bash
cd core-services/
sops -d ../core-envs-private/clients/core-dev/secrets.sops.yaml > .env
```

This will create a temporary `.env` file used by the app.

### 3. Install dependencies

```bash
npm install
```

---

## 🚀 Run in development

Replace `core-dev` with the desired client:

```bash
npm run dev -- core-dev
```

---

## 📁 Folder structure

```
core-services/
├── src/
│   ├── config/           # Loads YAML config for a client
│   ├── controllers/      # Routes for PDF/ZPL/Email/etc.
│   ├── middlewares/      # Security, logging, etc.
│   └── utils/            # Helpers and logging
├── .env                  # Decrypted secrets (from SOPS)
├── package.json
└── tsconfig.json
```

---

## 🛡️ Security Notes

- Do not commit `.env` or any decrypted secret file.
- Use only encrypted `secrets.sops.yaml` from `core-envs-private`.
- You must have GPG access to the right key to decrypt.

---

## 🧯 Troubleshooting

### App crashes on startup?

Check this:

- Did you decrypt secrets using `sops`?
- Is the `.env` file present?
- Did you run with the correct client? (`npm run dev -- core-dev`)
- Are the paths to `core-envs-private` correct?

---

## 🧪 Example Use Flow

```bash
cd C:/CORE/GitHub/core-services

# Step 1: Decrypt secrets
sops -d ../core-envs-private/clients/core-dev/secrets.sops.yaml > .env

# Step 2: Run app
npm start -- core-dev --standalone --gpg-passphrase="thepass"
```

That's it. You're running a secure, client-specific backend service.
