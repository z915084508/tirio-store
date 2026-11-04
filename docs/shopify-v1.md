# TIRIO Shopify Theme V1

## Scope and inspection

The starting point is `main` at `c327fb9`: a static Spanish catalog under `public/` plus earlier local WordPress preparation. There was no Liquid theme, package manifest, or repository AGENTS.md. Existing files are retained as historical work. The active new development target is `shopify/`, a standalone Shopify Online Store 2.0 theme; no framework build is required.

The official 1637 × 391 PNG logo was extracted byte-for-byte from the existing `officialLogoSrc` data URI in `public/app.js`. It retains the black/yellow/red mark and is displayed on a white backing in both color modes. No logo redesign or external stock imagery is included. The aircraft is a decorative original SVG illustration, explicitly labelled as not a product photograph.

## Theme editor

- Header/footer section groups: announcement, navigation menus and footer copy.
- Homepage JSON template: reorderable aviation hero, featured collection and brand story. Choose a hero image, link, copy and collection in the editor.
- Collection: 12 products per page, native sort options, pagination and empty state.
- Product: native Shopify images, description, variant prices, availability, optional native add-to-cart form, information blocks and app blocks.
- Global settings: custom logo and **Catalog mode**, enabled by default. The theme hides purchase controls and cart items in this mode. This is a visual presentation setting, not an enforcement mechanism for checkout, product access or other sales channels. No checkout button or payment integration is included.
- Spanish default and English UI translations. Merchant-authored copy remains editable; translate it separately through Shopify localization tools.
- Appearance uses a labelled native select (System / Light / Dark), keyboard operation, local storage, cross-tab synchronization and editor section reload support. System follows the OS through CSS, including live OS changes. Storage failure safely falls back to System; JavaScript-free rendering also follows the OS. Early local initialization minimizes color flashing.

Placeholder cards are non-purchasable concepts, not real product records, prices or inventory. Assign a real collection to replace them. No shipping, authenticity, licensing or stock claims are fabricated.

## Local validation (no store connection)

From the repository root:

```sh
node scripts/check-shopify.cjs
node --check shopify/assets/theme-mode.js
npx --yes --package @shopify/cli shopify theme check --path shopify
git diff --check
```

Package for manual review with `shopify theme package --path shopify`; upload only with separate authorization. Do not run theme dev, push, share or publish against an online store during this task: those commands can upload files. No store credentials are required for the checks above.

## Review before any later store trial

Runtime visual verification requires a separately authorized Shopify development store; this task does not connect to one. Check at 375, 768 and 1440 pixels: homepage, populated/empty collection, pagination, product variants/sold-out state, long titles, missing images and editor section reordering. Tab through navigation, appearance control and product form, confirm visible focus and skip link. Verify all three color modes on each page, reload persistence, OS preference changes, blocked storage and JavaScript disabled. Check app blocks with the actual installed app.

Only enable commerce following separate approval and verification of actual products, availability, cart, store policies and checkout configuration. Catalog mode does not configure or secure Shopify checkout.

No deployment workflow, production environment, DNS, payment setup, Shopify online store, legacy prototype or other project is changed by the theme implementation.
