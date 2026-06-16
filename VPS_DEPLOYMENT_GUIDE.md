# Skillmatch VPS Deployment Guide (Docker Containerized)

This guide covers the step-by-step process of deploying the fully containerized Skillmatch ecosystem to a Linux VPS (Ubuntu 22.04/24.04 recommended). 

Since you have containerized your architecture, you no longer need to install Node.js, PM2, or PostgreSQL directly on your server. Docker will handle everything.

## Prerequisites
- SSH access to your VPS
- Your GitHub repository URL
- Your configured domains/subdomains (e.g., `api.greenfarmers.works`, `admin.greenfarmers.works`, `otp.greenfarmers.works`)

---

## Step 1: Initial Server Setup & Docker Installation

Connect to your server via SSH:
```bash
ssh username@your_vps_ip
```

Update your system and install essential packages, including Nginx for reverse proxying and SSL:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx
```

Install **Docker** and **Docker Compose**:
```bash
# Add Docker's official GPG key and repository
sudo apt-get install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch="$(dpkg --print-architecture)" signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  "$(. /etc/os-release && echo "$VERSION_CODENAME")" stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

---

## Step 2: Clone the Repository & Configure Environment

Navigate to your web directory and clone your repository:
```bash
cd /opt
sudo git clone https://github.com/your-username/skillmatch.git
sudo chown -R $USER:$USER /opt/skillmatch
cd /opt/skillmatch
```

Your `docker-compose.yml` already contains all environment variables. Open it to replace placeholders with production values:
```bash
nano docker-compose.yml
```
Ensure you update variables like:
- `JWT_SECRET`
- `PAWAPAY_API_KEY`
- Database credentials (if you want to change them from the default)
- `VITE_API_URL` (under the `admin-panel` service) should point to your live API domain (e.g., `https://api.greenfarmers.works/api`)

---

## Step 3: Build and Start Containers

```bash
docker compose up -d --build
```
*(Les conteneurs sont configurés pour n'écouter qu'en interne sur 127.0.0.1. Seuls les ports 80 et 443 ont besoin d'être ouverts sur votre VPS pour Nginx).*

To check that all services are running:
```bash
docker compose ps
docker compose logs -f backend
```

---

## Step 4: Configure Nginx (Reverse Proxy)

You will route traffic to your Docker containers using Nginx server blocks.

### 1. Backend Nginx Config
```bash
sudo nano /etc/nginx/sites-available/api.greenfarmers.works
```
```nginx
server {
    listen 80;
    server_name api.greenfarmers.works;

    location / {
        proxy_pass http://localhost:3111; # Routes to Backend container
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 2. Admin Panel Nginx Config
```bash
sudo nano /etc/nginx/sites-available/admin.greenfarmers.works
```
```nginx
server {
    listen 80;
    server_name admin.greenfarmers.works;

    location / {
        proxy_pass http://localhost:6002; # Routes to Admin Panel container
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. OTP API Nginx Config (Optional)
If you need external access to the Baileys OTP API:
```bash
sudo nano /etc/nginx/sites-available/otp.greenfarmers.works
```
```nginx
server {
    listen 80;
    server_name otp.greenfarmers.works;

    location / {
        proxy_pass http://localhost:6003; # Routes to OTP API container
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Enable Sites & Restart Nginx
```bash
sudo ln -s /etc/nginx/sites-available/api.greenfarmers.works /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.greenfarmers.works /etc/nginx/sites-enabled/
# sudo ln -s /etc/nginx/sites-available/otp.greenfarmers.works /etc/nginx/sites-enabled/

sudo nginx -t
sudo systemctl restart nginx
```

---

## Step 5: Secure with SSL / HTTPS (Certbot)

Run Certbot to automatically configure Let's Encrypt SSL certificates for your subdomains:
```bash
sudo certbot --nginx -d api.greenfarmers.works -d admin.greenfarmers.works
```
Follow the prompts to enforce HTTPS.

---

## Step 6: Final Verification

1. **Test the API**: Visit `https://api.greenfarmers.works`
2. **Test the Admin Panel**: Visit `https://admin.greenfarmers.works` and verify you can log in.
3. **Check OTP API Logs**: Use `docker compose logs -f otp-baileys-api` to scan the QR code to link your WhatsApp account for the OTP gateway.

## Update Workflow (Future Deployments)
When you make changes and push to GitHub, update your VPS seamlessly:
```bash
cd /opt/skillmatch
git pull origin main

# Rebuild and restart only the containers that changed
docker compose up -d --build
```
