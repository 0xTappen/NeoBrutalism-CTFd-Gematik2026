/* Progressive enhancements: no additional API calls or credential persistence. */
(() => {
  'use strict';
  const config = window.init || {};
  const make = (tag, cls, text) => { const el = document.createElement(tag); el.className = cls; if (text) el.textContent = text; return el; };
  document.querySelectorAll('input[type="password"]').forEach((input, index) => {
    if (input.parentElement.querySelector('.ux-password-toggle')) return;
    if (!input.id) input.id = `ux-password-${index}`;
    const button = make('button', 'ux-password-toggle', 'Show password');
    button.id = `ux-password-toggle-${index}`;
    button.type = 'button'; button.setAttribute('aria-controls', input.id); button.setAttribute('aria-pressed', 'false');
    button.addEventListener('click', () => {
      const show = input.type === 'password'; input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Hide password' : 'Show password'; button.setAttribute('aria-pressed', String(show));
    });
    input.insertAdjacentElement('afterend', button);
  });
  const board = document.getElementById('challenges-board');
  if (board) {
    const panel = make('section', 'ux-progress'); panel.id = 'ux-challenge-progress'; panel.hidden = true;
    const text = make('strong', '', ''); const meter = document.createElement('progress');
    meter.id = 'ux-solve-meter'; meter.setAttribute('aria-label', 'Challenge completion');
    panel.append(text, meter); board.before(panel);
    const update = () => {
      const cards = [...board.querySelectorAll('.challenge-card-wrapper[data-solved]')];
      panel.hidden = !cards.length;
      const solved = cards.filter(card => card.dataset.solved === 'true').length;
      text.textContent = `${solved} / ${cards.length} challenges solved`;
      meter.max = cards.length || 1; meter.value = solved;
    };
    new MutationObserver(update).observe(board, {childList:true, subtree:true, attributes:true, attributeFilter:['data-solved']}); update();
  }
  const matrix = document.getElementById('challenge-matrix');
  if (matrix) {
    const toolbar = make('div', 'ux-ranking-tools');
    const label = make('label', '', 'Search top 50'); label.htmlFor = 'ux-ranking-search';
    const search = make('input', 'neo-input'); search.id = 'ux-ranking-search'; search.type = 'search'; search.placeholder = 'Team or player name';
    const mine = make('button', 'neo-button neo-button-secondary', 'Find my position'); mine.id = 'ux-ranking-mine'; mine.type = 'button';
    const status = make('p', 'ux-ranking-status'); status.id = 'ux-ranking-status'; status.setAttribute('role', 'status');
    const id = config.userMode === 'teams' ? config.teamId : config.userId;
    mine.hidden = !id;
    toolbar.append(label, search, mine); matrix.before(toolbar, status);
    const rows = () => [...matrix.querySelectorAll('tbody tr')];
    const isMine = row => {
      const link = row.querySelector('.matrix-account a');
      if (!link || !id) return false;
      const suffix = `/${config.userMode === 'teams' ? 'teams' : 'users'}/${id}`;
      return new URL(link.href, location.href).pathname.replace(/\/$/, '').endsWith(suffix);
    };
    const update = () => {
      let count = 0; const all = rows();
      all.forEach(row => {
        row.hidden = !(row.querySelector('.matrix-account')?.textContent || '').toLowerCase().includes(search.value.trim().toLowerCase());
        if (!row.hidden) count++;
        row.classList.toggle('ux-own-row', isMine(row));
      });
      status.textContent = all.length ? `${count} of ${all.length} displayed competitors` : '';
    };
    search.addEventListener('input', update);
    mine.addEventListener('click', () => {
      search.value = ''; update(); const row = rows().find(isMine);
      if (row) { row.scrollIntoView({block:'center', behavior:matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'}); const link = row.querySelector('a'); if (link) link.focus({preventScroll:true}); }
      else status.textContent = 'Your account is not in the displayed top 50. Rankings may also be hidden or not loaded yet.';
    });
    new MutationObserver(update).observe(matrix, {childList:true, subtree:true}); update();
  }
  const team = document.getElementById('team-id');
  if (team) {
    const button = make('button', 'neo-button neo-button-secondary ux-copy-team', 'Copy team name'); button.id = 'ux-copy-team'; button.type = 'button';
    const status = make('span', 'ux-copy-status'); status.setAttribute('role', 'status');
    button.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(team.textContent.trim()); status.textContent = 'Team name copied.'; }
      catch (_) { status.textContent = 'Clipboard unavailable. Select and copy the team name above.'; }
    }); team.after(button, status);
  }
})();
