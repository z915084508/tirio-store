# TASK 004 — Product detail page

## Result

Based on the latest fetched `shopify-preview` at `5042eb2c8206d97c219836e8c09d8fb003a9d469`. Changes are proposed in `feat/task-004-product-detail`; no connected branch update or Shopify publication is performed.

- Product images have a square contain-fit gallery, native full-size image links (new tab), accessible thumbnail buttons, selected-image state and a no-JavaScript fallback showing all images. The first image loads eagerly; later images/thumbnails load lazily. The custom element also works after editor section reloads.
- Product title, vendor, description, money-formatted price and sellability remain Shopify data. Varying prices show `Desde`. Catalogue mode shows a read-only variants/price/availability list for multi-variant products and no buying form.
- Optional material/dimensions/package-content settings hide empty values. These text settings support Shopify dynamic sources. Existing information blocks and app blocks remain supported; blank information blocks are omitted. New information blocks no longer insert speculative specifications or internal launch instructions.
- Adds breadcrumb navigation, semantic labelled product section, gallery region and responsive product information styling using existing Light/Dark/System tokens. Existing native commerce form is retained behind the current global catalog setting; this task does not enable it.

No changes to `templates/`, `config/`, hero, logo, homepage product section or appearance script. Existing merchant customizations and product records are not rewritten. No dependency is added to the storefront.

## Validation

- Official Shopify Theme Check: 26 Liquid/JSON files inspected, zero offenses.
- `node scripts/check-theme.cjs`: theme JSON/schema/references/translations, catalog default and appearance preference behavior pass.
- `node --check assets/product-gallery.js`, `node --check assets/theme-mode.js`, `git diff --check`: pass.
- `scripts/check-product-detail.cjs` with temporary development-only LiquidJS/JSDOM: dynamic product content/escaping, catalog form suppression, no/one/multiple images, gallery selection via nested thumbnail click, disconnection/reconnection, repeated script loading, no-JS image visibility, missing/confirmed specifications, variant availability/sold-out, optional information blocks and retained commerce markup all pass.

Reproduce from the branch root:

```sh
npm install --prefix /tmp/tirio-validation liquidjs jsdom
NODE_PATH=/tmp/tirio-validation/node_modules node scripts/check-product-detail.cjs
node scripts/check-theme.cjs
node --check assets/product-gallery.js
npx --yes --package @shopify/cli shopify theme check --path .
git diff --check
```

LiquidJS substitutes the Shopify form wrapper and image/money filters; it is not Shopify's own runtime. JSDOM exercises DOM behavior without browser layout. Real browser responsive rendering, image/CDN behavior, keyboard/screen-reader testing and actual TOAM product integration need manual unpublished-theme preview. No browser or Shopify session was used in this task.

## Manual preview after authorized merge

Merging this PR into connected `shopify-preview` automatically updates that Shopify theme. Keep it unpublished. This task leaves the PR unmerged, respecting the instruction against automatic deployments.

1. Save any pending Shopify editor changes first, then check for Shopify commits before merging. Rebase/preserve new editor changes if the branch has advanced.
2. In the connected draft theme, open Customize/Edit theme. From the page picker select Products > Default product and preview the existing TOAM product.
3. Open the `Producto` section. Optionally set **Material** to `Resina de alta definición` if confirmed for the actual product. Leave **Dimensiones** and **Contenido del paquete** empty until confirmed. Do not invent scale, dimensions, accessories, certification, delivery or stock promises.
4. Static section settings apply to EVERY product sharing that template. Prefer connecting product-specific metafields through the dynamic-source button, or use a separate template when the catalogue grows. This change does not create metafields or modify product assignments.
5. Existing product description remains controlled in Shopify Products. Review existing information blocks as well: old template copy is deliberately preserved, including any previously saved generic disclaimer. Remove or revise unconfirmed statements manually instead of treating them as validated facts.
6. Keep global **Catalog mode** enabled. Preview the product at 320, 390, 768 and 1440px in Light/Dark/System. Check no horizontal overflow, complete image visibility, gallery selection, full-size links, readable descriptions and specification wrapping.
7. Check homepage > collection > product navigation; confirm no purchase form appears, real title/price/availability match Shopify, empty specifications are absent outside editor and the original logo/hero/story still appear.

Draft-only proposed Spanish description, if wanted for later manual product editing (not written to the product by this task):

> Una pieza para quienes viven la aviación también en tierra. Esta figura TOAM, realizada en resina de alta definición, rinde homenaje al trabajo de los agentes de operaciones en el área de movimiento de los aeropuertos. Un pequeño guiño al mundo aeroportuario para tu colección.

No radio, supports, dimensions, package contents, availability dates or included accessories are claimed. Product data and store/payment/tax/shipping/inventory settings remain unchanged.
