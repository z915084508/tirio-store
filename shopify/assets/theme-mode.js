(() => {
  const key = 'tirio-theme';
  const valid = value => ['light', 'dark', 'system'].includes(value);
  let mode = 'system';
  try { const saved = localStorage.getItem(key); if (valid(saved)) mode = saved; } catch {}
  const apply = value => { document.documentElement.dataset.theme = value; document.querySelectorAll('[data-theme-select]').forEach(select => { select.value = value; }); };
  apply(mode);
  document.addEventListener('DOMContentLoaded', () => apply(mode));
  document.addEventListener('shopify:section:load', () => apply(mode));
  document.addEventListener('change', event => {
    if (!event.target.matches('[data-theme-select]') || !valid(event.target.value)) return;
    mode = event.target.value; apply(mode);
    try { localStorage.setItem(key, mode); } catch {}
  });
  window.addEventListener('storage', event => { if (event.key === key || event.key === null) { mode = valid(event.newValue) ? event.newValue : 'system'; apply(mode); } });
})();
