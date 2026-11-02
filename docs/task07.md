# TASK 07 — local environment preparation

Status: configuration prepared; runtime NOT RUN. WSL reports not installed. Docker CLI and standard Docker Desktop paths are absent. No system software was installed and no container/database was created.

Version targets verified against official sources on 2026-11-02:
- wordpress:7.1.4-php8.3-apache (PHP 8.3 series; exact patch/image digest must be recorded after pull)
- wordpress:cli-2.12.0-php8.3
- mariadb:11.4.13
- WooCommerce 11.2.1
These are explicit tags, not immutable digests. Runtime compatibility and image availability require validation with Docker before treating the environment as ready.
Sources: https://raw.githubusercontent.com/docker-library/official-images/master/library/wordpress ; https://raw.githubusercontent.com/docker-library/official-images/master/library/mariadb ; https://developer.woocommerce.com/releases/ ; https://woocommerce.com/document/server-requirements/

## Prerequisites and operations (PowerShell 7)

Install WSL2 and Docker Desktop from their official vendors yourself; restart if requested and start Docker Desktop. No existing environment is reused.

1. ./scripts/prepare-local.ps1 (creates ignored infra/local/.env; refuses overwrite)
2. ./scripts/local.ps1 Check (quiet Compose validation, engine check)
3. ./scripts/local.ps1 Start
4. ./scripts/local.ps1 Initialize
5. Open http://127.0.0.1:8087 (local development only)
6. ./scripts/local.ps1 Stop (preserves volumes)

Keep WP_PORT=8087 for the current initializer. Retrieve local admin password privately from ignored .env; never share it or commit it. The local email suppression MU plugin is mounted read-only. It does not implement Catalog Mode; TASK 08 remains required. No payment provider or real customer/product data is configured. Do not expose this environment on LAN or deploy it.

## Backup and restore plan

Stop WordPress writes first. Export the database inside the DB container using its internal environment credentials and copy the export to ignored backups/. Archive wp_data separately; protect both as sensitive. Restore only into NEW isolated volumes, then verify login, products, media and table counts. Do not use down -v or reset existing volumes. Export/restore commands and an actual restore drill are pending a working Docker runtime.

## Delivery boundaries

prototype/ is preserved byte-for-byte. public/ is a deployment snapshot of its three runtime files; embedded official PNG requires no separate image request. Only public/ is served. Git publication excludes .env, archives, review backups and original local source paths. No VPS, HISPAFLY AOC, V1 Travel or DNS changes.
