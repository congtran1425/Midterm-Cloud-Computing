# AWS Deployment Guide

This project is easiest to deploy on AWS with:

- `EC2` for the Node.js app
- `RDS MySQL` for the database
- `Nginx` as reverse proxy
- `PM2` to keep the app running
- `SES SMTP` optionally for receipt emails

Because the backend already serves the built frontend from `frontend/dist`, you only need one Node.js process in production.

## 1. Recommended Architecture

Use this setup:

- `Amazon EC2 Ubuntu 24.04` for the application server
- `Amazon RDS MySQL 8.0` for the database
- `Security Group`:
  - allow `22` from your IP only
  - allow `80` and `443` from the internet
  - allow `3000` only from the EC2 security group if needed for internal testing, or keep it closed
- `Nginx` receives public traffic and forwards it to `localhost:3000`
- `PM2` runs `node src/server.js`

This is a good fit for the current codebase because:

- frontend and backend are deployed together
- the app expects a MySQL database
- email can work through SMTP without code changes

## 2. Create AWS Resources

### EC2

Create one EC2 instance:

- AMI: `Ubuntu Server 24.04 LTS`
- Instance type: `t3.small` or `t3.micro` for demo/testing
- Storage: `20 GB` is enough for this assignment
- Attach a security group that allows:
  - `SSH 22` from your IP
  - `HTTP 80` from `0.0.0.0/0`
  - `HTTPS 443` from `0.0.0.0/0`

### RDS MySQL

Create one RDS database:

- Engine: `MySQL 8.0`
- Template: `Free tier` or `Dev/Test`
- DB name: `cloud_pos_db`
- Keep the endpoint, port, username, and password

Security group for RDS:

- allow `3306`
- source should be the EC2 security group, not public internet

## 3. Connect to EC2

From your local machine:

```bash
ssh -i your-key.pem ubuntu@YOUR_EC2_PUBLIC_IP
```

## 4. Install Runtime on EC2

Run these commands on the EC2 instance:

```bash
sudo apt update
sudo apt install -y nginx
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
node -v
npm -v
pm2 -v
```

The project requires `Node.js >= 20`.

## 5. Upload or Clone the Project

Option 1: clone from GitHub

```bash
git clone <your-repository-url> cloud-pos-saas
cd cloud-pos-saas
```

Option 2: upload the current project from your machine to EC2 with `scp` or WinSCP.

## 6. Install Dependencies and Build

Inside the project folder on EC2:

```bash
npm install
npm run build
```

This creates `frontend/dist`, and the backend will serve it automatically in production.

## 7. Configure Environment Variables

Create the production environment file:

```bash
cp .env.example .env
nano .env
```

Recommended production values:

```env
NODE_ENV=production
PORT=3000
APP_ORIGIN=http://YOUR_DOMAIN_OR_EC2_PUBLIC_IP

JWT_SECRET=replace-with-a-long-random-secret
JWT_EXPIRES_IN=8h

DB_HOST=YOUR_RDS_ENDPOINT
DB_PORT=3306
DB_USER=YOUR_RDS_USERNAME
DB_PASSWORD=YOUR_RDS_PASSWORD
DB_NAME=cloud_pos_db

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASS=
MAIL_FROM="Cloud POS <no-reply@yourdomain.com>"
```

If you will use HTTPS with a real domain, change `APP_ORIGIN` to:

```env
APP_ORIGIN=https://your-domain.com
```

Important notes:

- `JWT_SECRET` must be changed
- `DB_HOST` should be the RDS endpoint, not `localhost`
- leave SMTP empty if you do not need receipt email yet

## 8. Initialize Database

Open the RDS database using MySQL Workbench or MySQL CLI, then run:

```sql
Database/Create_DB.sql
```

After that, seed demo data from the EC2 server:

```bash
npm run seed
```

Demo accounts created by the seed:

- platform admin: `superadmin / Admin@123`
- tenant user: `owner / Tenant@123`
- tenant codes: `coffeehouse`, `minimart`

## 9. Start the App with PM2

This repo includes a PM2 config file, so you can start the app with:

```bash
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup
```

Check status:

```bash
pm2 status
pm2 logs cloud-pos-saas
```

Test locally on the server:

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{"ok":true,"service":"cloud-pos-saas"}
```

## 10. Configure Nginx

Copy the sample config from `deploy/nginx/cloud-pos-saas.conf` into Nginx:

```bash
sudo cp deploy/nginx/cloud-pos-saas.conf /etc/nginx/sites-available/cloud-pos-saas
sudo nano /etc/nginx/sites-available/cloud-pos-saas
```

Replace:

- `YOUR_DOMAIN_OR_IP`

Then enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/cloud-pos-saas /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

If the default site conflicts, remove it:

```bash
sudo rm /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

Now open:

```text
http://YOUR_DOMAIN_OR_EC2_PUBLIC_IP
```

## 11. Enable HTTPS with Let's Encrypt

If you have a real domain pointing to EC2:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Then update `.env`:

```env
APP_ORIGIN=https://your-domain.com
```

Restart the app:

```bash
pm2 restart cloud-pos-saas
```

## 12. Optional: Configure AWS SES SMTP

This app sends receipt emails through SMTP. AWS SES works without code changes.

In AWS SES:

1. Verify your sender domain or sender email
2. Create SMTP credentials
3. Put them into `.env`

Example:

```env
SMTP_HOST=email-smtp.ap-southeast-1.amazonaws.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=YOUR_SES_SMTP_USERNAME
SMTP_PASS=YOUR_SES_SMTP_PASSWORD
MAIL_FROM="Cloud POS <no-reply@yourdomain.com>"
```

If your SES account is still in sandbox, you can only send to verified addresses.

## 13. Update Workflow

When you change code later:

```bash
cd cloud-pos-saas
git pull
npm install
npm run build
pm2 restart cloud-pos-saas
```

If database schema changes:

- run the required SQL migration manually on RDS
- then restart the app

## 14. Troubleshooting

### App does not start

Check:

```bash
pm2 logs cloud-pos-saas
```

Common causes:

- wrong DB credentials
- RDS security group does not allow EC2
- `.env` is missing or invalid

### API works but frontend is blank

Run:

```bash
npm run build
pm2 restart cloud-pos-saas
```

This app expects the built frontend inside `frontend/dist`.

### Cannot connect to database

Verify:

- RDS status is `Available`
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME` are correct
- RDS security group allows inbound `3306` from the EC2 security group

### Receipt email fails

Verify:

- `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` are filled
- SES sender is verified
- SES sandbox restrictions are removed or recipient is verified

## 15. Suggested Next Improvements

If you want to harden this deployment further, the next steps are:

- store secrets in `AWS Systems Manager Parameter Store` or `AWS Secrets Manager`
- add a CI/CD pipeline with `GitHub Actions`
- use `Application Load Balancer` if you later scale to multiple EC2 instances
- create SQL migration scripts instead of rerunning one large schema file
