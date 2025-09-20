# Production Deployment Guide

## Overview

This guide covers deploying the Facial Recognition System to production with proper security, scalability, and WAN IP server access.

## Prerequisites

1. **Server Requirements**:
   - Ubuntu 20.04+ / CentOS 8+ / Amazon Linux 2
   - 2+ CPU cores
   - 4GB+ RAM
   - 20GB+ storage
   - Public IP address or domain name

2. **Software Requirements**:
   - Docker & Docker Compose
   - Nginx (for reverse proxy/SSL)
   - PostgreSQL (recommended for production)
   - SSL Certificate (Let's Encrypt recommended)

## Quick Start

### 1. Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Logout and login again for group changes
```

### 2. Project Setup

```bash
# Clone repository
git clone <your-repo-url>
cd facial-recognition-system

# Copy environment files
cp .env.example .env.production
cp facial-recognition-frontend/.env.production.example facial-recognition-frontend/.env.production

# Edit environment variables
nano .env.production
nano facial-recognition-frontend/.env.production
```

### 3. Environment Configuration

#### Backend (.env.production)

```bash
# Generate secure secrets
openssl rand -hex 64  # Use for JWT_SECRET
openssl rand -hex 64  # Use for JWT_REFRESH_SECRET

# Update .env.production with:
NODE_ENV=production
DB_PASSWORD=your_secure_db_password
JWT_SECRET=generated_secret_above
JWT_REFRESH_SECRET=generated_secret_above
CORS_ORIGIN=https://yourdomain.com
```

#### Frontend (.env.production)

```bash
# Update with your domain
REACT_APP_API_URL=https://api.yourdomain.com/api/v1
```

### 4. SSL Certificate Setup

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d yourdomain.com -d api.yourdomain.com
```

### 5. Deploy with Docker

```bash
# Build and start services
docker-compose -f docker-compose.prod.yml up -d

# Check logs
docker-compose -f docker-compose.prod.yml logs -f
```

## Domain Configuration

### DNS Records

Set up the following DNS records:

```
A    yourdomain.com        -> YOUR_SERVER_IP
A    api.yourdomain.com    -> YOUR_SERVER_IP
A    www.yourdomain.com    -> YOUR_SERVER_IP
```

### Nginx Reverse Proxy

Create `/etc/nginx/sites-available/facial-recognition`:

```nginx
# Frontend
server {
    listen 80;
    server_name yourdomain.com www.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com www.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# API Backend
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;

    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/facial-recognition /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Security Considerations

### 1. Firewall Setup

```bash
# UFW Firewall
sudo ufw allow ssh
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

### 2. Database Security

- Use strong passwords
- Enable SSL for database connections
- Regular backups
- Network isolation

### 3. Application Security

- Keep dependencies updated
- Monitor logs
- Regular security audits
- Implement rate limiting

## Monitoring

### Health Checks

- Backend: `https://api.yourdomain.com/api/v1/health`
- Frontend: `https://yourdomain.com/health`

### Log Monitoring

```bash
# Application logs
docker-compose -f docker-compose.prod.yml logs -f backend
docker-compose -f docker-compose.prod.yml logs -f frontend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

## Backup Strategy

### Database Backup

```bash
# Create backup script
cat > backup-db.sh << EOF
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
docker exec facial_recognition_db pg_dump -U facial_recognition_user facial_recognition_prod | gzip > backup_\$DATE.sql.gz
EOF

chmod +x backup-db.sh

# Add to crontab for daily backups
crontab -e
# Add: 0 2 * * * /path/to/backup-db.sh
```

## Performance Optimization

### 1. Enable Redis for Sessions (Optional)

Add to docker-compose.prod.yml:

```yaml
redis:
  image: redis:alpine
  restart: unless-stopped
  volumes:
    - redis_data:/data
```

### 2. CDN Integration

- Use CloudFlare or AWS CloudFront
- Cache static assets
- Optimize images

### 3. Database Optimization

- Enable connection pooling
- Optimize queries
- Add indexes
- Regular maintenance

## Troubleshooting

### Common Issues

1. **CORS Errors**: Check CORS_ORIGIN in environment
2. **SSL Issues**: Verify certificate installation
3. **Database Connection**: Check PostgreSQL configuration
4. **High Memory Usage**: Monitor and optimize queries

### Debug Commands

```bash
# Check container status
docker-compose -f docker-compose.prod.yml ps

# View resource usage
docker stats

# Check nginx configuration
sudo nginx -t

# Test API connection
curl -f https://api.yourdomain.com/api/v1/health
```

## Maintenance

### Updates

```bash
# Pull latest code
git pull origin main

# Rebuild and restart
docker-compose -f docker-compose.prod.yml build
docker-compose -f docker-compose.prod.yml up -d
```

### Certificate Renewal

```bash
# Auto-renewal with cron
echo "0 12 * * * /usr/bin/certbot renew --quiet" | sudo crontab -
```

## Cost Optimization

### Cloud Providers

1. **DigitalOcean**: $20/month (4GB RAM, 2 vCPUs)
2. **AWS EC2**: $25-40/month (t3.medium)
3. **Google Cloud**: $25-35/month (e2-medium)
4. **Linode**: $20/month (4GB plan)

### Recommended Setup

For production use:
- **Small Scale**: 4GB RAM, 2 vCPUs, 25GB SSD
- **Medium Scale**: 8GB RAM, 4 vCPUs, 50GB SSD
- **Large Scale**: 16GB RAM, 8 vCPUs, 100GB SSD

## Support

For issues or questions:
1. Check logs first
2. Review this guide
3. Check GitHub issues
4. Contact development team

---

**Important**: Always test deployment in a staging environment before production!