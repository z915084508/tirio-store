# TASK 003 — Homepage product integration

## Result and audit

The current Shopify theme lives in `shopify/` on `feat/shopify-theme-v1` at `29cbd060b7d3ac9d51f2c8ceb190dd0d9de38772`. V1 PR #1 is still open, while `main` contains the older static prototype. Task branch `feat/task-003-homepage-products` and its PR therefore target V1, keeping this review focused. No other project files or infrastructure are modified.

`templates/index.json` already orders `hero`, `featured-collection`, then `rich-text`. Its featured section loop previously substituted four named concept cards and Shopify product placeholder SVGs whenever the collection was missing or empty. The same `snippets/product-card.liquid` is used on the collection page. This implementation updates those existing components, retaining section IDs/settings (`heading`, `collection`, `limit`) and the homepage template. Hero, story, official logo and appearance scripts are unchanged. Separate category cards were not necessary.

The featured section uses its native collection picker and `collection.products`, with no hardcoded product names, images, prices, inventory or product handles. It renders up to 4–12 real products, each with its image (or neutral missing-image text), escaped title, Shopify money formatting, product URL and `Disponible`/`Agotado` from `product.available`. Variant-dependent prices show `Desde`. Availability follows Shopify sellability, including any merchant-configured overselling policy; it does not assert physical stock counts.

No collection: guidance appears only in Theme Editor; the storefront hides the unconfigured section. Empty collection: an honest translated empty state, without fake cards. View All visibility/text are configurable and its URL always comes from the chosen collection.

The existing 4-column desktop and 2-column tablet grid are preserved. Homepage cards use 2 columns at 380–900px and 1 below 380px, square contain-fit media, consistent gaps and wrapping for long titles. The product list is semantic HTML; availability is text, not color alone. Existing focus indicators and Light/Dark/System variables remain in use.

## Validation — 5 November 2026

- Official Shopify CLI Theme Check: **26 files inspected, zero offenses** after implementation.
- `node scripts/check-shopify.cjs`: passes all theme JSON, section schema, section/snippet references, translation and existing appearance persistence tests (including blocked localStorage).
- `node --check shopify/assets/theme-mode.js` and `git diff --check`: pass.
- `scripts/check-featured-collection.cjs` with LiquidJS: passes missing selection in/out of editor, empty collection, 4/7/12 limits, real data binding with synthetic fixtures, escaped titles, available/sold-out, varying prices, absent images, absent product and View All toggle. Shopify image/money/translation filters are represented locally; this is not the Shopify rendering engine.
- CSS breakpoint review: 4 desktop / 2 tablet / 2 mobile / 1 narrow mobile, square images and no fixed card widths. Browser visual QA could not run: this environment has no browser binary and the Chromium download returned invalid archives. No claim of screenshot or real-store visual verification is made.
- Official `shopify theme package --path shopify`: succeeded. ZIP contains theme directories at archive root, no repository/legacy files, and was checked against current theme source bytes.

To reproduce rendering tests without adding storefront dependencies:

```sh
npm install --prefix /tmp/tirio-validation liquidjs
NODE_PATH=/tmp/tirio-validation/node_modules node scripts/check-featured-collection.cjs
node scripts/check-shopify.cjs
node --check shopify/assets/theme-mode.js
npx --yes --package @shopify/cli shopify theme check --path shopify
git diff --check
```

LiquidJS is a local development check only. There are no paid apps, runtime packages or external data calls added to the theme.

## Manual upload and configuration (Spanish Shopify admin)

1. Download `TIRIO-Shopify-TASK-003.zip`; do not unzip it. Keep the existing theme as a reference. A new ZIP upload does not carry customizations previously saved only in another theme's editor; reapply those in the new draft as needed.
2. Go to **Tienda online → Temas → Biblioteca de temas → Añadir tema / Importar tema → Subir archivo ZIP** (wording can vary). Upload this ZIP as a new unpublished theme. Do not click **Publicar**.
3. On that new theme, choose **Personalizar**, then **Página de inicio**.
4. Open **Colección destacada** (the section titled **Listos para tu colección**). If removed, use **Añadir sección → Colección destacada**.
5. In **Colección**, select the existing Shopify collection containing the TOAM figure. Set **Título**, **Máximo de productos** (4–12), **Mostrar botón Ver todo**, and **Texto del botón** as desired.
6. Click **Guardar** in the unpublished theme editor, then use that theme's **Vista previa**. Saving the draft settings does not publish it.
7. Confirm the actual TOAM image, title, formatted price, availability and product link. With one product, only one card should appear; no filler cards should be added.

If the product is absent, inspect whether the chosen collection contains it and whether it is available to the Online Store/current market. This task does not modify product/channel/inventory settings.

## Store acceptance checklist (not performed here)

- Preview the unpublished theme at 320, 375, 390, 768, 1024 and 1440px; check square images, long titles, card spacing and no horizontal overflow.
- Verify the actual TOAM data, price/currency, product navigation and selected collection URL; toggle View All and edit its text.
- Test no selected collection (editor guidance, no section in preview), an empty collection, and populated collections. Check sold-out/missing-image products only if such records already exist; do not change inventory just for this test.
- Check Light/Dark/System, preference persistence after reload, keyboard navigation and visible focus. Verify hero, official logo and story.
- Confirm custom content from the prior uploaded theme has been reapplied to this new draft where needed.

No store access or credentials were used. Actual Shopify Liquid/CDN/Theme Editor behavior, market visibility, browser visual QA and assistive technology verification remain store-side checks. No product, inventory, payment, tax, shipping or store settings were changed; no upload, publish, merge or deployment was initiated.
