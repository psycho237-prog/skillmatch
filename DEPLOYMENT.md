# SkillMatch Deployment Guide (VPS)

This guide walks you through deploying the SkillMatch backend and database using Docker to a standard VPS (like DigitalOcean, Linode, AWS EC2, or Hetzner).

## Prerequisites
1. A Linux VPS (Ubuntu 22.04+ recommended).
2. [Docker](https://docs.docker.com/engine/install/) and [Docker Compose](https://docs.docker.com/compose/install/) installed on your server.
3. A registered Domain Name (optional but highly recommended for HTTPS).

## 1. Transfer Project to VPS
You can clone your repository directly to the VPS, or copy the files via `scp`:
```bash
scp -r ./skillmatch user@your_vps_ip:/home/user/skillmatch
```

## 2. Environment Configuration
Navigate to your project directory on the VPS:
```bash
cd /home/user/skillmatch
```

Review the `docker-compose.yml` file. You should update the `JWT_SECRET` and `PAWAPAY_API_KEY` under the `backend` environment variables before starting the server.

## 3. Build and Start the Services
Run the following command to build the backend Docker image and start both the PostgreSQL database and Node.js API:
```bash
docker-compose up -d --build
```

You can check the logs to ensure the backend connected to the DB successfully:
```bash
docker-compose logs -f backend
```

## 4. Payment Aggregator Callback Configuration (PawaPay)
To allow PawaPay to notify your backend when a Mobile Money deposit or withdrawal is successful, you must configure the following **Webhook Callback URL** in your PawaPay Merchant Dashboard:

**Callback URL**:
`https://<YOUR_DOMAIN_OR_IP>/api/webhooks/mobile-money/callback`

*(Make sure your server is open to external traffic on the configured port, or proxy it through Nginx).*

## 5. Setting up Nginx & HTTPS (Recommended)
It is highly recommended to put Nginx in front of your Node.js backend to handle SSL/TLS (HTTPS). PawaPay and other modern APIs require webhooks to be served over HTTPS.

1. Install Nginx and Certbot:
```bash
sudo apt update
sudo apt install nginx certbot python3-certbot-nginx
```

2. Create an Nginx configuration file (`/etc/nginx/sites-available/skillmatch`):
```nginx
server {
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

3. Enable the site and restart Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/skillmatch /etc/nginx/sites-enabled/
sudo systemctl restart nginx
```

4. Obtain an SSL Certificate:
```bash
sudo certbot --nginx -d api.yourdomain.com
```

## 6. Mobile App Deployment (Frontend)
Before building the APK/AAB for production:
1. Update `this.baseUrl` and `this.socketUrl` in `frontend/src/services/api.ts` to point to your live VPS domain (e.g., `https://api.yourdomain.com/api` and `https://api.yourdomain.com`).
2. Build your app using EAS:
```bash
cd frontend
eas build -p android --profile production
```
