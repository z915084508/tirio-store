# TIRIO Shopify preview theme

This branch is prepared for Shopify's native GitHub integration. Theme directories are at repository root, copied without code changes from TASK 003 commit fd9284dd9856319cc4d59fe011862918a52b6ac3 (its shopify/ subtree).

## Connect manually

In Shopify: Online Store > Themes > Theme library > Add theme > Connect from GitHub. Authorize only z915084508/tirio-store and select branch shopify-preview. Keep the newly connected theme unpublished. Choose the existing TOAM collection in the homepage Colección destacada section and save the draft.

## Development on this branch

- The root theme is the source for this preview. Changes to main, feat/shopify-theme-v1 or feat/task-003-homepage-products do not automatically reach this branch.
- Always fetch and inspect the latest shopify-preview first: Shopify writes Theme Editor and code-editor changes back to this branch, including templates and config/settings_data.json. Preserve those merchant customizations; do not force-push or regenerate the branch from an older snapshot.
- Make future theme changes in a feature branch based on the latest shopify-preview, validate with Shopify Theme Check, and open a PR targeting shopify-preview. Updating the connected branch synchronizes its Shopify theme, so obtain the merchant's authorization before merging or pushing updates to that connected branch.
- Keep changes limited to Shopify Liquid/JSON/CSS/JS. No WordPress, VPS, Next.js or hosting integrations belong in this branch.
- Do not modify real products, inventory, payments, tax, shipping or store settings. Do not publish the theme without explicit approval.
- Never commit credentials or store/customer data.

This branch preparation does not connect a store, upload a theme or publish anything. Once connected, commits update the selected Shopify theme automatically; publishing that theme later would make future commits affect the live storefront.
