/* Reusable glass surface, window manager, dock and overlay interactions. */
(() => {
  'use strict';
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const mobile = matchMedia('(max-width: 760px)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const ease = 'cubic-bezier(.22,1,.36,1)';
  const storage = { get(key) { try { return localStorage.getItem(key); } catch { return null; } }, set(key, value) { try { localStorage.setItem(key, value); return true; } catch { return false; } } };
  const animate = (el, frames, duration = 450) => el.animate(frames, { duration: reduced.matches ? 1 : duration, easing: ease });
  let layer = 10;
  let toastTimeout;
  function notify(message) {
    const el = $('#toast'); el.textContent = message; el.hidden = false;
    animate(el, [{ opacity: 0, translate: '0 -12px' }, { opacity: 1, translate: '0 0' }], 250);
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => { el.hidden = true; }, 3000);
  }
  function theme(dark) {
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    $('#dark-toggle').checked = dark; storage.set('psu_theme', dark ? 'dark' : 'light');
  }
  theme(storage.get('psu_theme') === 'dark');
  $('#theme').onclick = () => theme(document.documentElement.dataset.theme !== 'dark');
  $('#dark-toggle').onchange = e => theme(e.target.checked);
  $('#motion-toggle').onchange = e => document.body.classList.toggle('motion-off', !e.target.checked);
  if ((navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || navigator.connection?.saveData) document.body.classList.add('low-effects');

  class GlassWindow {
    constructor(el) {
      this.el = el; this.busy = false;
      this.dock = $(`[data-app="${el.id}"]`);
      this.home = { x: el.style.getPropertyValue('--wx'), y: el.style.getPropertyValue('--wy') };
      el.addEventListener('pointerdown', () => this.raise());
      const handle = $('.window-handle', el);
      handle.tabIndex = 0;
      handle.setAttribute('aria-label', `${el.getAttribute('aria-label')} — ใช้ปุ่มลูกศรเพื่อย้ายหน้าต่าง`);
      handle.addEventListener('keydown', e => {
        if (mobile.matches || this.el.dataset.maximized === 'true' || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
        e.preventDefault(); this.raise();
        const style = getComputedStyle(el);
        const dx = e.key === 'ArrowLeft' ? -16 : e.key === 'ArrowRight' ? 16 : 0;
        const dy = e.key === 'ArrowUp' ? -16 : e.key === 'ArrowDown' ? 16 : 0;
        el.style.setProperty('--wx', `${Math.max(0, (parseFloat(style.getPropertyValue('--wx')) || 0) + dx)}px`);
        el.style.setProperty('--wy', `${Math.max(0, (parseFloat(style.getPropertyValue('--wy')) || 0) + dy)}px`);
      });
      $('.window-handle', el).addEventListener('pointerdown', e => this.drag(e));
      $$('[data-action]', el).forEach(button => button.onclick = () => this[button.dataset.action]());
      this.dock.onclick = () => this.open();
    }
    raise() { this.el.style.zIndex = ++layer; }
    async open() {
      if (this.busy) return;
      this.raise();
      if (!this.el.hidden && !mobile.matches) { this.el.focus(); return; }
      this.el.hidden = false; this.dock.classList.add('running');
      if (mobile.matches) this.el.classList.add('mobile-sheet');
      this.busy = true;
      await animate(this.el, [{ opacity: 0, scale: '.92', translate: '0 18px', filter: 'blur(3px)' }, { opacity: 1, scale: '1.012', translate: '0 -1px', filter: 'blur(0)' }, { opacity: 1, scale: '1', translate: '0 0', filter: 'blur(0)' }], 500).finished;
      this.busy = false; this.el.focus();
    }
    async close() {
      if (this.busy) return; this.busy = true;
      await animate(this.el, [{ opacity: 1, scale: '1' }, { opacity: 0, scale: '.94', translate: '0 15px', filter: 'blur(3px)' }], 300).finished;
      this.el.hidden = true; this.el.classList.remove('mobile-sheet'); this.dock.classList.remove('running'); this.busy = false; this.dock.focus();
    }
    async minimize() {
      if (this.busy) return; this.busy = true;
      const box = this.el.getBoundingClientRect(), target = this.dock.getBoundingClientRect();
      const x = target.x + target.width / 2 - box.x - box.width / 2;
      const y = target.y + target.height / 2 - box.y - box.height / 2;
      await animate(this.el, [{ opacity: 1, scale: '1', translate: '0 0', clipPath: 'inset(0 round 28px)' }, { opacity: .7, scale: '.6 .85', translate: `${x * .35}px ${y * .35}px`, clipPath: 'inset(0 12% round 40px)', offset: .4 }, { opacity: 0, scale: '.08 .06', translate: `${x}px ${y}px`, clipPath: 'inset(0 25% round 50px)' }], 520).finished;
      this.el.hidden = true; this.el.classList.remove('mobile-sheet'); this.busy = false;
      animate(this.dock, [{ translate: '0 0' }, { translate: '0 -7px' }, { translate: '0 0' }], 300); this.dock.focus();
    }
    async maximize() {
      if (this.busy) return; this.busy = true; this.raise();
      const before = this.el.getBoundingClientRect();
      this.el.dataset.maximized = this.el.dataset.maximized !== 'true';
      const after = this.el.getBoundingClientRect();
      await animate(this.el, [{ transformOrigin: 'top left', translate: `${before.x - after.x}px ${before.y - after.y}px`, scale: `${before.width / after.width} ${before.height / after.height}`, borderRadius: '28px' }, { transformOrigin: 'top left', translate: '0 0', scale: '1', borderRadius: this.el.dataset.maximized === 'true' ? '20px' : '28px' }], 500).finished;
      this.busy = false;
    }
    drag(event) {
      if (event.target.closest('button') || this.busy || event.button !== 0) return;
      const handle = event.currentTarget;
      if (mobile.matches && !this.el.classList.contains('mobile-sheet')) return;
      if (!mobile.matches && this.el.dataset.maximized === 'true') return;
      const initial = this.el.getBoundingClientRect(); const parent = this.el.offsetParent.getBoundingClientRect();
      const startX = event.clientX, startY = event.clientY;
      let x = initial.x - parent.x, y = initial.y - parent.y, dy = 0, raf;
      this.raise(); handle.setPointerCapture(event.pointerId);
      this.el.style.scale = '1.015';
      const move = e => {
        dy = e.clientY - startY;
        x = Math.max(-parent.x + 8, Math.min(innerWidth - parent.x - initial.width - 8, initial.x - parent.x + e.clientX - startX));
        y = Math.max(8 - parent.y, initial.y - parent.y + dy);
        if (raf) return;
        raf = requestAnimationFrame(() => {
          raf = null;
          if (mobile.matches) this.el.style.translate = `0 ${Math.max(0, dy)}px`;
          else { this.el.style.setProperty('--wx', `${x}px`); this.el.style.setProperty('--wy', `${y}px`); }
        });
      };
      const stop = () => {
        cancelAnimationFrame(raf); handle.removeEventListener('pointermove', move); handle.removeEventListener('pointerup', stop); handle.removeEventListener('pointercancel', stop);
        this.el.style.scale = ''; this.el.style.translate = '';
        if (mobile.matches) { if (dy > 100) this.close(); return; }
        const snapX = Math.round(x / 24) * 24, snapY = Math.round(y / 24) * 24;
        this.el.style.setProperty('--wx', `${snapX}px`); this.el.style.setProperty('--wy', `${snapY}px`);
        animate(this.el, [{ translate: `${x - snapX}px ${y - snapY}px`, scale: '1.015' }, { translate: '0 0', scale: '1' }], 350);
      };
      handle.addEventListener('pointermove', move); handle.addEventListener('pointerup', stop); handle.addEventListener('pointercancel', stop);
    }
  }
  const windows = $$('.glass-window').map(el => new GlassWindow(el));
  function arrange() { windows.forEach(w => { w.el.dataset.maximized = 'false'; w.el.classList.remove('mobile-sheet'); w.el.style.setProperty('--wx', w.home.x); w.el.style.setProperty('--wy', w.home.y); w.el.hidden = false; w.dock.classList.add('running'); }); }
  $('#arrange').onclick = () => { arrange(); $('.desktop').scrollIntoView({ behavior: reduced.matches ? 'instant' : 'smooth', block: 'start' }); };
  $('#reset-layout').onclick = () => { arrange(); notify('คืนค่าพื้นที่ทำงานแล้ว'); };
  mobile.addEventListener('change', arrange);

  class GlassOverlay {
    constructor(el) { this.el = el; $('[data-dismiss]', el).onclick = () => this.close(); }
    async open(source) { this.source = source; this.el.hidden = false; await animate(this.el, [{ opacity: 0, scale: '.92', translate: '0 -10px', transformOrigin: 'top right' }, { opacity: 1, scale: '1', translate: '0 0' }], 350).finished; $('button', this.el).focus(); }
    async close() { if (this.el.hidden) return; await animate(this.el, [{ opacity: 1 }, { opacity: 0, scale: '.97', translate: '0 -6px' }], 180).finished; this.el.hidden = true; this.source?.focus(); }
  }
  const overlays = new Map($$('.floating-panel').map(el => [el.id, new GlassOverlay(el)]));
  $$('[data-panel]').forEach(button => button.onclick = () => { const panel = overlays.get(button.dataset.panel); const visible = !panel.el.hidden; overlays.forEach(other => { if (other !== panel) other.close(); }); visible ? panel.close() : panel.open(button); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { overlays.forEach(p => p.close()); const sheet = windows.find(w => w.el.classList.contains('mobile-sheet') && !w.el.hidden); if (sheet) sheet.close(); } });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('.floating-panel,[data-panel]')) overlays.forEach(p => p.close()); });
  const dialog = $('#about-modal');
  $('#about').onclick = () => { dialog.showModal(); animate(dialog, [{ opacity: 0, scale: '.92', translate: '0 18px' }, { opacity: 1, scale: '1', translate: '0 0' }], 450); };
  async function closeDialog(e) { e.preventDefault(); await animate(dialog, [{ opacity: 1 }, { opacity: 0, scale: '.95', translate: '0 12px' }], 250).finished; dialog.close(); }
  dialog.addEventListener('cancel', closeDialog); $$('form', dialog).forEach(form => form.addEventListener('submit', closeDialog));
  let swipeY; dialog.addEventListener('pointerdown', e => { if (mobile.matches && !e.target.closest('button')) swipeY = e.clientY; }); dialog.addEventListener('pointerup', e => { if (swipeY !== undefined && e.clientY - swipeY > 100) closeDialog(e); swipeY = undefined; });

  const note = $('#note'); note.value = storage.get('psu_workspace_note') || '';
  note.addEventListener('input', () => { $('#save-state').textContent = storage.set('psu_workspace_note', note.value) ? 'บันทึกบนอุปกรณ์แล้ว ✓' : 'ไม่สามารถบันทึกได้ในเบราว์เซอร์นี้'; });
  let remaining = 25 * 60, end = 0, ticker;
  function renderTimer() { $('#timer').textContent = `${Math.floor(remaining / 60).toString().padStart(2, '0')}:${(remaining % 60).toString().padStart(2, '0')}`; }
  $('#start-timer').onclick = () => {
    if (ticker) { clearInterval(ticker); ticker = null; $('#start-timer').textContent = 'โฟกัสต่อ ▷'; return; }
    if (!remaining) remaining = 1500;
    end = Date.now() + remaining * 1000; $('#start-timer').textContent = 'พักชั่วคราว Ⅱ';
    ticker = setInterval(() => { remaining = Math.max(0, Math.ceil((end - Date.now()) / 1000)); renderTimer(); if (!remaining) { clearInterval(ticker); ticker = null; $('#start-timer').textContent = 'เริ่มอีกครั้ง ▷'; notify('ครบช่วงโฟกัสแล้ว พักสายตาสักครู่นะ'); } }, 250);
  };
  $('#reset-timer').onclick = () => { clearInterval(ticker); ticker = null; remaining = 1500; renderTimer(); $('#start-timer').textContent = 'เริ่มโฟกัส ▷'; };

  const tabs = $$('[data-view]');
  function indicator(button) { const el = $('.nav-indicator'); el.style.width = `${button.offsetWidth}px`; el.style.transform = `translateX(${button.offsetLeft - 4}px)`; }
  tabs.forEach(button => button.onclick = () => { tabs.forEach(t => t.classList.toggle('selected', t === button)); indicator(button); if (button.dataset.view === 'focus') { windows.find(w => w.el.id === 'focus').open(); $('#focus').scrollIntoView({ block: 'center', behavior: reduced.matches ? 'instant' : 'smooth' }); } else arrange(); });
  indicator(tabs[0]); window.addEventListener('resize', () => indicator($('.glass-navbar .selected')));
  let scrollFrame, lastY = scrollY;
  window.addEventListener('scroll', () => { if (scrollFrame) return; scrollFrame = requestAnimationFrame(() => { $('.glass-navbar').classList.toggle('scrolled', scrollY > 30); if (!reduced.matches) $('.glass-navbar').style.translate = `0 ${Math.max(-2, Math.min(2, (lastY - scrollY) * .06))}px`; lastY = scrollY; scrollFrame = null; }); }, { passive: true });
  if (fine.matches && !reduced.matches) {
    let reflectionFrame;
    document.addEventListener('pointermove', e => { if (reflectionFrame) return; reflectionFrame = requestAnimationFrame(() => { const surface = e.target.closest('.glass-window,.glass-button'); if (surface) { const rect = surface.getBoundingClientRect(); surface.style.setProperty('--rx', `${e.clientX - rect.x}px`); surface.style.setProperty('--ry', `${e.clientY - rect.y}px`); } reflectionFrame = null; }); }, { passive: true });
    const dock = $('.glass-dock'), items = $$('.dock-item', dock); let dockFrame;
    dock.addEventListener('pointermove', e => { if (dockFrame) return; dockFrame = requestAnimationFrame(() => { const sizes = items.map(item => item.getBoundingClientRect()); items.forEach((item, i) => { const distance = Math.abs(e.clientX - sizes[i].x - sizes[i].width / 2); item.style.transform = `translateY(${-Math.max(0, 1 - distance / 100) * 6}px) scale(${1 + Math.max(0, 1 - distance / 100) * .16})`; }); dockFrame = null; }); });
    dock.addEventListener('pointerleave', () => { cancelAnimationFrame(dockFrame); dockFrame = null; items.forEach(item => item.style.transform = ''); });
  }
})();
