// PWA Service Worker Registration & Install Banner
(function() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      // Determine correct sw.js path depending on page depth
      const isPagesDir = window.location.pathname.includes('/pages/');
      const swPath = isPagesDir ? '../sw.js' : './sw.js';
      
      navigator.serviceWorker.register(swPath)
        .then((reg) => {
          console.log('✅ PSU Materials PWA ServiceWorker registered with scope:', reg.scope);
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
    
    // Show subtle install button if container exists
    const installBtn = document.getElementById('pwa-install-btn');
    if (installBtn) {
      installBtn.style.display = 'inline-flex';
      installBtn.addEventListener('click', () => {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            installBtn.style.display = 'none';
          }
          deferredPrompt = null;
        });
      });
    }
  });
})();
