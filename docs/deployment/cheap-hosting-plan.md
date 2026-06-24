# Cheap Hosting Plan

Date checked: 24 June 2026.

This app is designed to red-team decision-making artefacts of any kind: projects, proposals, essays, policies, code changes, investment memos, operating plans and other choices. The cheapest credible hosting plan is a single VPS running Docker Compose, with Caddy handling HTTPS for a custom domain.

## Recommended Starting Architecture

- One 2 vCPU / 4 GiB RAM VPS.
- Docker Compose stack from `deploy/cheap-vps/docker-compose.prod.yml`.
- Caddy reverse proxy with automatic HTTPS.
- PostgreSQL with pgvector, Redis and MinIO on private Docker networks.
- Cloudflare Registrar and Free DNS for the domain.
- Nightly off-server backups before any real user data is stored.

## Why This Is The Cheapest Sensible Shape

The app currently needs API, web, worker, PostgreSQL, Redis and S3-compatible object storage. Splitting those across managed services is operationally cleaner, but it is not the cheapest route. A single VPS keeps the first deployment simple and low-cost while the product is still personal or low-traffic.

Current reference points:

- DigitalOcean lists a 4 GiB / 80 GiB basic virtual machine at $24/month with included bandwidth on its Droplets page.
- DigitalOcean also states that each Droplet includes outbound transfer starting from 500 GiB/month.
- Cloudflare Registrar offers at-cost domain registration and renewal, with Free DNS, Free CDN and Free SSL.
- Caddy provides automatic HTTPS, including certificate provisioning, renewal and HTTP-to-HTTPS redirects.
- Hetzner remains worth checking before purchase, but its June 2026 price adjustment means the live calculator should be used instead of relying on old instance-price examples.

## Monthly Cost Envelope

| Item | Low-cost choice | Expected monthly cost |
|---|---|---:|
| VPS | 2 vCPU / 4 GiB RAM / 40-80 GiB disk | about $10-$25, depending on provider and region |
| DNS/CDN | Cloudflare Free | $0 |
| Domain | Cloudflare Registrar at-cost `.com` or similar | annual, varies by TLD |
| TLS | Caddy automatic HTTPS | $0 |
| Backups | Provider snapshots or external object storage | start with provider snapshot, add off-server backups before real users |
| Email | SMTP-capable transactional mail provider | often free or low-cost at small personal/project volume |

For a first public beta, budget for roughly $25-$35/month plus the annual domain. A lower-cost VPS may work for a single-user demo, but 4 GiB RAM is the safer floor because PostgreSQL, Redis, MinIO, the API and the web server are co-located.

## Domain Plan

1. Buy or transfer the domain in Cloudflare Registrar.
2. Create an `A` record for `redteamagent.example.com` pointing to the VPS IPv4 address.
3. Set SSL/TLS mode to Full or Full strict.
4. Keep the app on one origin first: `https://redteamagent.example.com`.
5. Route browser API calls through `/api` so cookies remain same-site.

## VPS Setup

```bash
sudo apt update
sudo apt install -y ca-certificates curl git ufw
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker "$USER"
newgrp docker
git clone https://github.com/ShabalalaWATP/RedTeamAgent.git
cd RedTeamAgent/deploy/cheap-vps
cp .env.production.example .env.production
```

Edit `.env.production`:

- Set `DOMAIN_NAME`.
- Set `ACME_EMAIL`.
- Generate `APP_SECRET_KEY`.
- Replace database and MinIO passwords.
- Set `COOKIE_SECURE=true`.
- Set `CORS_ORIGINS=https://your-domain`.
- Set `PUBLIC_APP_URL=https://your-domain`.
- Set `MAIL_DELIVERY=smtp`.
- Set `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD` and `SMTP_STARTTLS`.

Then deploy:

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker compose -f docker-compose.prod.yml ps
```

## Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Do not expose PostgreSQL, Redis or MinIO publicly. Use SSH tunnels for emergency admin access.

## Backups

Before storing real user data, add:

- nightly `pg_dump` to encrypted off-server storage;
- MinIO bucket backup or migration to a managed object store;
- tested restore command;
- documented retention window.

## Upgrade Path

When the app has more than one real user or stores material confidential data:

1. Move PostgreSQL to a managed Postgres provider or a separate private database host.
2. Move object storage from local MinIO to managed S3-compatible storage.
3. Add uptime monitoring, log redaction, automated backups and restore drills.
4. Move provider secrets into a managed secret store or encrypted volume strategy.
5. Add a dedicated mail domain, SPF, DKIM and DMARC records before higher-volume public use.

## Source Links

- DigitalOcean Droplets: https://www.digitalocean.com/products/droplets
- Cloudflare Registrar: https://www.cloudflare.com/products/registrar/
- Cloudflare Free plan: https://www.cloudflare.com/plans/free/
- Caddy automatic HTTPS: https://caddyserver.com/docs/automatic-https
- Caddy `handle_path`: https://caddyserver.com/docs/caddyfile/directives/handle_path
- Hetzner price adjustment: https://docs.hetzner.com/general/infrastructure-and-availability/price-adjustment/
