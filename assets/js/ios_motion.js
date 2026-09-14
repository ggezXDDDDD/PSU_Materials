/**
 * PSU Materials Portal — shared iOS-style interaction layer.
 * Uses IntersectionObserver and transform-only feedback to stay smooth on
 * mobile devices. The page remains fully usable when JS is unavailable.
 */
(function () {
  'use strict';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const revealSelector = [
    '.card-glass', '.glass-panel', '.assignment-card', '.file-item-card',
    '.summary-card', '.stat-card-glass', '.card', '.hero', '.concept-card',
    '.course-task-section', '.quiz-card', '.file-hub-section'
  ].join(',');
  const shineSelector = [
    '.card-glass', '.assignment-card', '.file-item-card', '.card',
    '.concept-card', '.quiz-card'
  ].join(',');

  function setupReveal() {
    const items = Array.from(document.querySelectorAll(revealSelector))
      .filter(item => !item.parentElement.closest(revealSelector));
    if (!items.length) return;

    document.documentElement.classList.add('ios-motion-ready');
    items.forEach((item, index) => {
      item.classList.add('ios-reveal');
      item.style.setProperty('--reveal-delay', `${Math.min(index % 5, 4) * 55}ms`);
    });

    if (reduceMotion.matches || !('IntersectionObserver' in window)) {
      items.forEach((item) => item.classList.add('ios-reveal-visible'));
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('ios-reveal-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -24px 0px', threshold: 0 });

    items.forEach((item) => observer.observe(item));
  }

  function setupGlassShine() {
    if (reduceMotion.matches || !window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll(shineSelector).forEach((surface) => {
      surface.addEventListener('pointermove', (event) => {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
        surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
      }, { passive: true });
    });
  }

  function setupPortalNavigation() {
    const sidebar = document.querySelector('.sidebar');
    const toolbar = document.querySelector('.main-top-bar');
    if (!sidebar || !toolbar) return;
    sidebar.id = sidebar.id || 'portal-sidebar';
    const toggle = document.createElement('button');
    toggle.className = 'portal-menu-button';
    toggle.type = 'button';
    toggle.textContent = '☰';
    toggle.setAttribute('aria-label', 'เปิดเมนูรายวิชา');
    toggle.setAttribute('aria-controls', sidebar.id);
    toggle.setAttribute('aria-expanded', 'false');
    toolbar.prepend(toggle);
    const backdrop = document.createElement('button');
    backdrop.className = 'portal-menu-backdrop';
    backdrop.type = 'button';
    backdrop.hidden = true;
    backdrop.tabIndex = -1;
    backdrop.setAttribute('aria-label', 'ปิดเมนูรายวิชา');
    document.body.append(backdrop);
    const close = () => {
      sidebar.classList.remove('portal-menu-open');
      sidebar.inert = matchMedia('(max-width: 900px)').matches;
      backdrop.hidden = true;
      toggle.setAttribute('aria-expanded', 'false');
    };
    toggle.addEventListener('click', () => {
      const open = !sidebar.classList.contains('portal-menu-open');
      sidebar.inert = !open;
      sidebar.classList.toggle('portal-menu-open', open);
      backdrop.hidden = !open;
      toggle.setAttribute('aria-expanded', String(open));
      if (open) requestAnimationFrame(() => sidebar.querySelector('a')?.focus());
    });
    backdrop.addEventListener('click', () => { close(); toggle.focus(); });
    document.addEventListener('keydown', event => {
      if (!sidebar.classList.contains('portal-menu-open')) return;
      if (event.key === 'Escape') { close(); toggle.focus(); }
      if (event.key === 'Tab') {
        const links = [...sidebar.querySelectorAll('a,button')].filter(el => el.getClientRects().length);
        const first = links[0], last = links[links.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    });
    matchMedia('(max-width: 900px)').addEventListener('change', close);
    close();
    const nav = sidebar.querySelector('.sidebar-nav');
    if (nav && !nav.querySelector('[data-workspace-link]')) {
      const link = document.createElement('a');
      link.href = new URL(location.pathname.includes('/pages/') ? '../liquid-glass.html' : './liquid-glass.html', location.href).href;
      link.className = 'side-item';
      link.dataset.workspaceLink = '';
      link.textContent = '✦ Liquid Workspace';
      nav.prepend(link);
    }
  }

  function setupPressFeedback() {
    const selector = 'a, button, .filter-pill, [role="button"]';
    document.addEventListener('pointerdown', (event) => {
      const control = event.target.closest(selector);
      if (control) control.classList.add('ios-pressed');
    }, { passive: true });

    const release = () => {
      document.querySelectorAll('.ios-pressed').forEach((control) => {
        control.classList.remove('ios-pressed');
      });
    };
    document.addEventListener('pointerup', release, { passive: true });
    document.addEventListener('pointercancel', release, { passive: true });
  }

  function setupScrollChrome() {
    const chrome = document.querySelectorAll('.main-top-bar, .top-nav, nav');
    if (!chrome.length) return;
    let scheduled = false;
    const update = () => {
      chrome.forEach((element) => element.classList.toggle('is-scrolled', window.scrollY > 12));
      scheduled = false;
    };
    window.addEventListener('scroll', () => {
      if (scheduled) return;
      scheduled = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  function init() {
    setupPortalNavigation();
    setupReveal();
    setupGlassShine();
    setupPressFeedback();
    setupScrollChrome();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true });
  } else {
    init();
  }
})();
