/* Navigation feedback without intercepting links or delaying navigation. */
(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const reset = () => document.documentElement.classList.remove('neo-navigating');
  window.addEventListener('pageshow', reset);
  document.addEventListener('click', event => {
    const link = event.target.closest('a[href]');
    if (!link || event.defaultPrevented || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download') || link.dataset.toggle || reduced.matches) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || !/^https?:$/.test(url.protocol) || (url.pathname === location.pathname && url.search === location.search)) return;
    document.documentElement.classList.add('neo-navigating');
    setTimeout(reset, 4000);
  });
})();
