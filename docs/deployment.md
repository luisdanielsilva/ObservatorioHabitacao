# Deployment

OlhoVivo runs on the existing Hetzner VPS without Docker (WBS 3.2.3, 3.4): the Next.js app
as a systemd service behind Nginx, with data imports and backups as systemd timers. All
files are in [`deploy/`](../deploy). The steps marked **(sudo)** must be run by an
administrator.

## First-time setup

1. **Environment** (sudo):

   ```bash
   sudo cp deploy/olhovivo.env.example /etc/olhovivo.env
   sudo chown root:deploy /etc/olhovivo.env && sudo chmod 640 /etc/olhovivo.env
   sudo nano /etc/olhovivo.env   # set the domain and, once decided, the link-reader allow-list
   ```

2. **Database and build** (as `deploy`):

   ```bash
   npm ci
   npm run db:migrate
   npm run import:all    # real INE / CAOP / Euribor data (or db:reset for demo data)
   npm run build -w @olhovivo/web
   ```

3. **Services** (sudo):

   ```bash
   sudo cp deploy/olhovivo-*.service deploy/olhovivo-*.timer /etc/systemd/system/
   sudo systemctl daemon-reload
   sudo systemctl enable --now olhovivo-web olhovivo-backup.timer olhovivo-imports.timer
   ```

4. **Nginx and HTTPS** (sudo; needs a DNS record pointing to the VPS):

   ```bash
   sudo cp deploy/nginx-olhovivo.conf /etc/nginx/sites-available/olhovivo
   sudo ln -s /etc/nginx/sites-available/olhovivo /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   sudo certbot --nginx -d olhovivo.pt -d www.olhovivo.pt
   ```

5. **Deploy permission** (sudo), so `deploy/deploy.sh` can restart the app:

   ```bash
   echo 'deploy ALL=(root) NOPASSWD: /usr/bin/systemctl restart olhovivo-web' | sudo tee /etc/sudoers.d/olhovivo
   ```

## Updating

```bash
./deploy/deploy.sh   # pull, npm ci, backup, migrate, build, restart
```

## Backups

`olhovivo-backup.timer` runs `npm run db:backup` nightly at 02:30. It writes a consistent,
self-contained copy (`data/backups/olhovivo-YYYY-MM-DD.db`), checks its integrity and keeps
the newest 14. The Hetzner VPS backup then includes these files. Adjust the time so it
finishes before the VPS backup window.

Property photos of saved scenarios are files in `data/photos/<scenario id>/` (or `PHOTOS_DIR`),
not in the database: the VPS backup must include that folder too. At most 5 MB per scenario.

**Restore test** (do this periodically, WBS 3.4.2):

```bash
cp data/backups/olhovivo-YYYY-MM-DD.db /tmp/restore-test.db
DATABASE_PATH=/tmp/restore-test.db npm run db:migrate   # must report no errors
```

## Ports and resources

- The app listens on `localhost:3200` (3000, 3123, 3191, 3194 and 4002 are used by other
  apps on this server). Only Nginx is public. Use `localhost`, not `127.0.0.1`, both for
  `next start` and in Nginx: Next.js treats its own rewrites (the language routing) as another
  server when the addresses differ, and pages fail.
- The VPS has 3.7 GB RAM and 2 vCPU. Builds and imports run with lower priority (`nice`);
  avoid running a build during an import.
- The development server runs separately (`next dev` on the Tailscale address, port 3100).

## Preview at www.singleuseapps.com/olhovivo

Until olhovivo.pt is set up, a production build runs under a path of another site, without a
password (only essential cookies; sign-in links go to the app log while no email provider is
set).

- **Settings:** `apps/web/.env.production.local` (not in git) sets `NEXT_PUBLIC_BASE_PATH=/olhovivo`
  and `NEXT_PUBLIC_SITE_URL=https://www.singleuseapps.com/olhovivo`; `.env.local` is read too
  (`AUTH_SECRET`, link reader domains). The base path is fixed at build time.
- **Process:** PM2 (user `deploy`, already started at boot), name `olhovivo`, restarted above
  700 MB:

  ```bash
  cd apps/web && npx next build && pm2 restart olhovivo     # after each update
  pm2 logs olhovivo                                         # sign-in links, errors
  ```

- **Nginx:** `deploy/nginx-singleuseapps-olhovivo.conf`, copied to
  `/etc/nginx/snippets/olhovivo.conf` and included in the `www.singleuseapps.com` server block.
- **Database:** the same `data/olhovivo.db` and `data/photos/` as the development server, so
  e2e runs add test users and scenarios to what the preview shows.
- **Base path in code:** `next/link`, the router and redirects add it themselves; plain links,
  `fetch` calls and Auth.js use `withBasePath` (`src/lib/basePath.ts`).
