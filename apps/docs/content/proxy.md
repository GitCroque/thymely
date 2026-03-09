# Reverse Proxy

Running Thymely behind a reverse proxy (Nginx, Traefik, Caddy) allows you to serve it on a custom domain with HTTPS.

A typical setup looks like this:

```
User --> https://support.example.com --> Nginx --> Thymely (port 3000 / 5003)
```

Thymely exposes two ports:

- **3000**: the web interface (Next.js frontend)
- **5003**: the API (Fastify backend)

Both need to be proxied if you want the application to work behind a single domain or two subdomains.

## Environment variables

When running behind a reverse proxy, set these in your `.env`:

```ini
TRUST_PROXY=true
COOKIE_SECURE=true
```

## Nginx setup

This guide uses Nginx on Debian/Ubuntu.

### Install Nginx

```bash
sudo apt update
sudo apt install nginx
```

Verify it is running:

```bash
systemctl status nginx
```

### Configure the firewall

```bash
sudo ufw allow 'Nginx Full'
```

### Create proxy configuration files

Create a file for the frontend:

```bash
sudo nano /etc/nginx/conf.d/thymely-client.conf
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name support.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_read_timeout 300s;
    }

    client_max_body_size 10M;
}
```

Create a file for the API:

```bash
sudo nano /etc/nginx/conf.d/thymely-api.conf
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.support.example.com;

    location / {
        proxy_pass http://127.0.0.1:5003;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_redirect off;
        proxy_read_timeout 300s;
    }

    client_max_body_size 10M;
}
```

Replace `support.example.com` and `api.support.example.com` with your actual domain names.

### Restart Nginx

```bash
sudo systemctl restart nginx
```

Your Thymely instance should now be accessible at `http://support.example.com`.

## Enabling HTTPS with Certbot

### Install Certbot

For Debian/Ubuntu:

```bash
sudo apt install python3 python3-venv libaugeas0
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot certbot-nginx
sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot
```

For Fedora/CentOS:

```bash
sudo dnf install python3 augeas-libs
sudo python3 -m venv /opt/certbot/
sudo /opt/certbot/bin/pip install --upgrade pip
sudo /opt/certbot/bin/pip install certbot certbot-nginx
sudo ln -s /opt/certbot/bin/certbot /usr/bin/certbot
```

### Obtain certificates

```bash
sudo certbot --nginx
```

Follow the prompts. Certbot will automatically update your Nginx configuration to use HTTPS.

### Auto-renewal

Set up a cron job to renew certificates automatically:

```bash
echo "0 0,12 * * * root /opt/certbot/bin/python -c 'import random; import time; time.sleep(random.random() * 3600)' && sudo certbot renew -q" | sudo tee -a /etc/crontab > /dev/null
```

After enabling HTTPS, update your `.env`:

```ini
COOKIE_SECURE=true
PUBLIC_APP_URL=https://support.example.com
```

## Notes

- The API must be accessible over HTTPS if the frontend is served over HTTPS (browsers block mixed content).
- If you use a single domain, you can route `/api/v1` to port 5003 and everything else to port 3000 within a single Nginx server block.
