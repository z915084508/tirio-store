# TASK 004 — Coming Soon product system

## Activation

Add the exact product tag `tirio-coming-soon` in Shopify Admin. The tag is case-sensitive and applies to the parent product, so every variant is treated as Coming Soon regardless of its current inventory or selected variant URL. Remove the tag to restore the existing theme behavior (including the global catalog-mode setting).

The theme does not change product status, publication, sales channels, inventory or storefront password protection. Keep the product Active and available to the Online Store sales channel if it should be visible publicly. Public access also depends on the merchant's store password/publication settings; this task does not change them.

## Storefront behavior

- Product page: yellow `PRÓXIMAMENTE` badge; existing images/gallery, title, description and price retained. Replaces Available/Sold out and purchase controls with the exact development message and design disclaimer. No product form, quantity input, variant-purchase selector or dynamic checkout is rendered for tagged products, even when catalog mode is off and inventory reports available. No release date or notification button is generated.
- Shared product card: badge replaces availability text; image, title, price and native product link remain. The same snippet serves homepage featured collections, collection pages and the new native search-results template. Article/page search links remain available. Existing cards have no quick-add/quick-buy controls, and none are introduced.
- Stale cart lines: a product tagged after it was added retains its remove link, but its editable quantity is replaced by a zero-valued update field and an explanation. Clicking the existing Update cart control removes that line. No cart mutation runs on page load; ordinary cart lines retain their original quantity controls. The theme already has no checkout button and this task does not change checkout configuration.
- Notifications: `snippets/coming-soon-notice.liquid` is the future integration insertion point. Add an operational service and consent/data handling before rendering any signup control. Existing app blocks remain intact; installed third-party apps must be reviewed separately for purchase widgets.
- Badge colors are fixed dark text `#171a1d` on yellow `#f6c544` (approximately 10.8:1 contrast), consistent in light/dark modes. Badges are plain readable text; the original card remains a keyboard-accessible link.

## Required manual Shopify Admin purchase protection

Liquid is a presentation layer, not server-side purchase authorization. Before making Coming Soon products public, the merchant must configure **every variant**:

1. Enable inventory tracking (Track quantity).
2. Set Available inventory to **0** at every location that can supply online orders.
3. Disable **Continue selling when out of stock**.
4. Save and verify every variant, including variants added later. Inventory or fulfillment apps must not overwrite these settings unintentionally.

Official references: [inventory tracking](https://help.shopify.com/en/manual/products/inventory/getting-started-with-inventory/set-up-inventory-tracking), [selling out of stock](https://help.shopify.com/en/manual/inventory-and-locations/setup/selling-when-out-of-stock).

Do not unpublish/archive products just to prevent purchase. No Admin configuration is performed by this code. Direct Ajax API calls, cart permalinks, old cart sessions, third-party app embeds and other sales channels are outside the Liquid controls. Apply the inventory safeguards and verify these paths separately before launch; a theme alone cannot guarantee universal blocking. Shopify POS has its own inventory-sale behavior.

There is no theme AJAX cart-add implementation to intercept: the only theme add-to-cart entry point is the native Liquid product form, omitted entirely for tagged products. Tests flag any future addition of AJAX cart code so a tag-aware implementation must be reviewed. No global fetch/XHR monkey-patching, checkout redirects or authentication changes are introduced.

## Validation

Local validation uses development-only tools under ignored `.validation/`; there are no new theme runtime dependencies.

```powershell
npm install --prefix .validation --no-package-lock --no-save liquidjs jsdom playwright
$env:NODE_PATH = Join-Path (Get-Location) '.validation/node_modules'
node scripts/check-theme.cjs
node scripts/check-product-detail.cjs
$env:TIRIO_VISUAL_FIXTURES = '1'
node scripts/check-coming-soon.cjs
node scripts/check-coming-soon-layout.cjs
npx --yes --package @shopify/cli shopify theme check --path .
git diff --check
```

The layout test uses an installed Chrome in headless mode. LiquidJS emulates Shopify-only form wrappers and pagination; it does not connect to a Shopify store or verify platform checkout.

| Requested case | Local verification |
| --- | --- |
| Coming Soon page | Rendered badge, exact messages, title/description/image/price; no purchasing fields/forms |
| Normal available/sold-out | Rendered output compared to pre-task commit `b672488`, both catalog modes; unchanged |
| Multiple variants | Each variant selected with tag, availability on/off and catalog on/off; no product forms |
| Homepage featured products | Mixed tagged/normal fixtures through actual section and shared card |
| Collection | Mixed fixtures through actual collection section |
| Search | Mixed product and page fixtures through new native search section |
| Mobile/desktop | Headless Chrome 375px and 1440px; no horizontal overflow, badge bounds, keyboard access |
| Light/dark | Eight product/card screenshots, computed badge/body colors; representative screenshots visually inspected |
| Quick-add/dynamic checkout/AJAX | No tagged product form or payment button; no theme AJAX add path; cards remain links |
| Publication | No Admin/API writes; no product visibility filters introduced |
| Existing gallery/theme settings | Existing product-detail and theme preference regression suites |
| Cart after tagging | Tagged line submits quantity zero; normal line quantity/remove behavior retained |

Shopify Theme Check passes with zero offenses. Local behavior/layout suites pass. Full rendering with real Shopify objects, actual search pagination, app-injected controls, checkout enforcement, publication/password settings and inventory settings require a separately authorized store trial. No live-store verification, theme upload, publication or Admin mutation was performed.

## Changed files

- `sections/main-product.liquid`: exact-tag gate before normal commerce/catalog behavior.
- `snippets/product-card.liquid`: shared tagged-product badge and status.
- `snippets/coming-soon-badge.liquid`, `snippets/coming-soon-notice.liquid`: reusable accessible presentation and future notification insertion point.
- `sections/main-cart.liquid`: stale tagged cart-line controls.
- `sections/main-search.liquid`, `templates/search.json`: native search results using shared product cards.
- `assets/theme.css`: responsive badge/notice styles using existing theme colors.
- `locales/es.default.json`, `locales/en.json`: Spanish Coming Soon copy and search UI strings.
- `scripts/check-coming-soon.cjs`, `scripts/check-coming-soon-layout.cjs`: rendered behavior, regression and local layout checks.
- `scripts/check-product-detail.cjs`: resolve shared snippets during local rendering.
- `scripts/check-theme.cjs`: inspect theme directories only, excluding Git and local validation dependencies.
- `.gitignore`, `.shopifyignore`: keep local verification artifacts out of Git/theme upload.
- This document: manual setup, limitations and review instructions.

## Review branch

Feature branch: `feat/task-004-coming-soon`, based on latest inspected `shopify-preview` (`b672488`). The user explicitly approved targeting `shopify-preview` rather than stale default `main`. Do not merge automatically: Shopify's connected branch may synchronize changes to its selected theme. This feature branch does not update that connected branch.
