# SSH Key Setup for GitHub Actions → NAS Deploy

## 1. Generate the key pair (run on your local machine)

```powershell
ssh-keygen -t ed25519 -C "github-actions-t212" -f ~/.ssh/t212_deploy_key -N ""
```

This creates:
- `~/.ssh/t212_deploy_key` — private key (goes into GitHub secret)
- `~/.ssh/t212_deploy_key.pub` — public key (goes onto NAS)

## 2. Add public key to NAS

SSH into your NAS and run:

```bash
ssh admin@192.168.0.18

mkdir -p ~/.ssh
chmod 700 ~/.ssh
echo "PASTE_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys
chmod 600 ~/.ssh/authorized_keys
```

Or paste the contents of `~/.ssh/t212_deploy_key.pub`.

## 3. Add private key to GitHub Secrets

1. Open `~/.ssh/t212_deploy_key` in a text editor
2. Copy the entire contents (including `-----BEGIN...` and `-----END...` lines)
3. Go to: GitHub repo → Settings → Secrets and variables → Actions → New repository secret
4. Name: `NAS_SSH_KEY`
5. Value: paste the private key

## 4. Verify connection

```bash
ssh -i ~/.ssh/t212_deploy_key admin@192.168.0.18 "echo connected"
```

## All required GitHub Secrets

| Secret | Value |
|--------|-------|
| `DOCKER_USERNAME` | Your Docker Hub username |
| `DOCKER_PASSWORD` | Docker Hub → Account Settings → Security → New Access Token |
| `NAS_HOST` | `192.168.0.18` |
| `NAS_SSH_USER` | Your NAS SSH username (e.g. `admin`) |
| `NAS_SSH_KEY` | Contents of `~/.ssh/t212_deploy_key` |
| `DISCORD_WEBHOOK` | Discord channel → Edit → Integrations → Webhooks (optional) |
