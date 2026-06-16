# Skillmatch VPS Deployment Guide

This guide covers the step-by-step process of deploying the Skillmatch backend and admin panel to a Linux VPS (Ubuntu 22.04/24.04 recommended).

Since you have already configured your DNS and pushed your code to GitHub, you are ready to set up the server.

## Prerequisites
- SSH access to your VPS
- Your GitHub repository URL
- Your configured domains/subdomains (e.g., `api.greenfarmers.works`, `admin.greenfarmers.works`)

---

## Step 1: Initial Server Setup & Dependencies

Connect to your server via SSH:
```bash
ssh username@your_vps_ip
```

Update your system and install essential packages:
```bash
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git nginx certbot python3-certbot-nginx
```

Install **Node.js** (LTS version, e.g., v20):
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

Install **PM2** globally (to keep your Node.js apps running in the background):
```bash
sudo npm install -g pm2
```

---

## Step 2: Database Setup (PostgreSQL)

If you are hosting PostgreSQL on the same VPS, install it:
```bash
sudo apt install -y postgresql postgresql-contrib
```

Access the PostgreSQL prompt and create your database and user:
```bash
sudo -u postgres psql
```
Inside the SQL prompt:
```sql
CREATE DATABASE skillmatch_db;
CREATE USER skillmatch_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE skillmatch_db TO skillmatch_user;
ALTER DATABASE skillmatch_db OWNER TO skillmatch_user;
\q
```

---

## Step 3: Clone the Repository & Setup Environments

Navigate to your web directory and clone your repository:
```bash
cd /var/www
# You might need to generate an SSH key on your server and add it to GitHub, or use a Personal Access Token
sudo git clone https://github.com/your-username/skillmatch.git
# Change ownership to your current user (replace 'username' with your actual linux username)
sudo chown -R $USER:$USER /var/www/skillmatch
cd /var/www/skillmatch
```

### Configure Backend Environment
```bash
cd backend
nano .env
```
Paste your local `.env` variables. It should look something like:
```env
PORT=3000
DATABASE_URL=postgresql://skillmatch_user:your_secure_password@localhost:5432/skillmatch_db
JWT_SECRET=your_jwt_secret
PAWAPAY_API_KEY=your_pawapay_key
# ... add any other credentials (Expo, Cloudinary, etc.)
```

### Configure Admin Panel Environment
```bash
cd ../admin
nano .env
```
Add your production API URL:
```env
VITE_API_BASE_URL=https://api.greenfarmers.works
```

---

## Step 4: Install Dependencies & Build

### Backend
```bash
cd /var/www/skillmatch/backend
npm install
```
If you are using Prisma or Sequelize, run your database migrations here. For example:
```bash
# Example if using npm scripts for migrations:
npm run db:migrate 
```

### Admin Panel
```bash
cd /var/www/skillmatch/admin
npm install
npm run build
```
*(The build process will generate a `dist` or `build` folder containing static HTML/CSS/JS files).*

---

## Step 5: Start the Backend with PM2

Go to your backend folder and start the server with PM2:
```bash
cd /var/www/skillmatch/backend
pm2 start src/index.js --name "skillmatch-backend" # Update path if your main file is named differently
```

Ensure PM2 restarts your app if the server reboots:
```bash
pm2 save
pm2 startup
# Copy and paste the command PM2 outputs in your terminal to enable startup
```

---

## Step 6: Configure Nginx (Reverse Proxy & Static Files)

You will need two Nginx server blocks: one for the API (Backend) and one for the Admin Panel.

### 1. Backend Nginx Config
```bash
sudo nano /etc/nginx/sites-available/api.greenfarmers.works
```
Paste the configuration:
```nginx
server {
    listen 80;
    server_name api.greenfarmers.works;

    location / {
        proxy_pass http://localhost:3000; # Must match your backend PORT in .env
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
Paste the configuration:
```nginx
server {
    listen 80;
    server_name admin.greenfarmers.works;

    # Point to the Vite build directory
    root /var/www/skillmatch/admin/dist; 
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

### Enable Sites & Restart Nginx
```bash
sudo ln -s /etc/nginx/sites-available/api.greenfarmers.works /etc/nginx/sites-enabled/
sudo ln -s /etc/nginx/sites-available/admin.greenfarmers.works /etc/nginx/sites-enabled/

# Test configuration to ensure no typos
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

---

## Step 7: Secure with SSL / HTTPS (Certbot)

Run Certbot to automatically fetch and configure Let's Encrypt SSL certificates for both subdomains:
```bash
sudo certbot --nginx -d api.greenfarmers.works -d admin.greenfarmers.works
```
Follow the on-screen prompts. Certbot will update your Nginx configurations to enforce HTTPS.

---

## Step 8: Final Verification

1. **Test the API**: Visit `https://api.greenfarmers.works/health` (or your equivalent health check endpoint).
2. **Test the Admin Panel**: Visit `https://admin.greenfarmers.works` and verify you can log in and see your dashboard.
3. **Test Push Notifications / PawaPay**: Make a test transaction or trigger a push notification to ensure external services are authenticating properly using the `.env` variables you pasted.

## Update Workflow (Future Deployments)
When you make new changes locally and push to GitHub, run this on the VPS to update:
```bash
cd /var/www/skillmatch
git pull origin main

# If backend changed:
cd backend
npm install
pm2 restart skillmatch-backend

# If admin changed:
cd ../admin
npm install
npm run build
```
