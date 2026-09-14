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
    const items = Array.from(document.querySelectorAll(revealSelector));
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
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0.06 });

    items.forEach((item) => observer.observe(item));
  }

  function setupGlassShine() {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.querySelectorAll(shineSelector).forEach((surface) => {
      surface.addEventListener('pointermove', (event) => {
        const rect = surface.getBoundingClientRect();
        surface.style.setProperty('--glass-x', `${event.clientX - rect.left}px`);
        surface.style.setProperty('--glass-y', `${event.clientY - rect.top}px`);
      }, { passive: true });
    });
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
