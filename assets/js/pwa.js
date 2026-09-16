// PWA service-worker registration and Chromium install prompt.
(function () {
  const getInstallButton = () => {
    let button = document.getElementById('pwa-install-btn');
    if (button) return button;
    const controls = document.querySelector('.shell-controls');
    if (!controls) return null;
    button = document.createElement('button');
    button.id = 'pwa-install-btn';
    button.className = 'shell-icon';
    button.type = 'button';
    button.hidden = true;
    button.textContent = '↓';
    button.title = 'ติดตั้ง PSU Materials';
    button.setAttribute('aria-label', 'ติดตั้ง PSU Materials ลงในอุปกรณ์');
    controls.prepend(button);
    return button;
  };

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Determine correct sw.js path depending on page depth
      const isPagesDir = window.location.pathname.includes('/pages/');
      const swPath = isPagesDir ? '../sw.js' : './sw.js';
      
      navigator.serviceWorker.register(swPath)
        .then((reg) => {
          console.log('✅ PSU Materials PWA ServiceWorker registered with scope:', reg.scope);
          reg.update();
        })
        .catch((err) => {
          console.log('ℹ️ PWA registration skipped:', err.message);
        });
    });
  }

  // Optional Install Prompt for Android / Desktop Chrome
  let deferredPrompt;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    const installBtn = getInstallButton();
    if (!installBtn) return;
    installBtn.hidden = false;
    installBtn.onclick = async () => {
      if (!deferredPrompt) return;
      await deferredPrompt.prompt();
      deferredPrompt = null;
      installBtn.hidden = true;
    };
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) installBtn.hidden = true;
  });
})();
