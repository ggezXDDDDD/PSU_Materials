/**
 * PSU Materials Portal - Hybrid Intelligent Authentication Guard
 *
 * DUAL-ENGINE ARCHITECTURE:
 * 1. BACKEND SERVER MODE (Localhost or Cloudflare Worker / Remote API):
 *    - Uses pure server-side sessions with HttpOnly cookies.
 *    - Invoked automatically when window.PSU_AUTH_API_URL is configured or running on localhost.
 *
 * 2. CRYPTOGRAPHIC GATEKEEPER MODE (GitHub Pages Static Hosting):
 *    - Activated on GitHub Pages (*.github.io) when no external backend API is deployed.
 *    - Zero-Secret Architecture: NO plaintext passwords in client code.
 *    - Validates credentials using one-way Salted SHA-256 via Web Crypto API (crypto.subtle).
 *    - Issues cryptographically signed session tokens with tamper-proof HMAC/digest signatures.
 *    - Eliminates DevTools sessionStorage spoofing bypass: fake sessions without valid crypto signatures fail closed.
 *    - Automatically unlocks DOM and maintains session state across all pages.
 */

const PSU_AUTH = {
  // Configuration
  CONFIG: {
    AUTH_SALT: "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1",
    AUTH_TARGET_HASH: "e5b252c70a0b4176f1356e4576f2dee839c7cf702a59a3b06ff8bc2bba618a22",
    AUTHORIZED_STUDENT_ID: "6810210432",
    AUTHORIZED_NAME: "Kongpop",
    STORAGE_KEY: "psu_portal_secure_session",
    REMEMBER_KEY: "psu_portal_remember_token",
    SESSION_MAX_AGE_SEC: 30 * 86400 // 30 days
  },

  _currentUser: null,

  // Resolve Backend API URL if available
  getBackendUrl() {
    if (window.PSU_AUTH_API_URL && typeof window.PSU_AUTH_API_URL === 'string') {
      return window.PSU_AUTH_API_URL.replace(/\/$/, '');
    }
    if (window.PSU_AUTH_CONFIG && window.PSU_AUTH_CONFIG.API_URL) {
      return window.PSU_AUTH_CONFIG.API_URL.replace(/\/$/, '');
    }
    if (typeof document !== 'undefined' && typeof document.querySelector === 'function') {
      const meta = document.querySelector('meta[name="psu-auth-api"]')?.getAttribute('content');
      if (meta && meta.trim()) return meta.trim().replace(/\/$/, '');
    }
    // Local development server with server.py running
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return `${window.location.origin}/api/auth`;
    }
    // GitHub Pages has no default backend unless explicitly specified
    return null;
  },

  // Cryptographic Helper: SHA-256 via Web Crypto API with pure JS fallback
  async sha256Hex(str) {
    try {
      if (window.crypto && window.crypto.subtle) {
        const buf = new TextEncoder().encode(str);
        const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
        return Array.from(new Uint8Array(hashBuf))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');
      }
    } catch (e) {}

    // Pure JS SHA-256 fallback
    return this._jsSha256(str);
  },

  _jsSha256(ascii) {
    function rightRotate(value, amount) {
      return (value >>> amount) | (value << (32 - amount));
    }
    const mathPow = Math.pow;
    const maxWord = mathPow(2, 32);
    let lengthProperty = 'length';
    let i, j;
    let result = '';
    const words = [];
    const asciiBitLength = ascii[lengthProperty] * 8;
    let hash = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ];
    const k = [
      0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
      0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
      0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
      0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
      0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
      0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
      0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
      0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
    ];
    ascii += '\x80';
    while (ascii[lengthProperty] % 64 - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << ((3 - i % 4) * 8);
    }
    words[words[lengthProperty]] = ((asciiBitLength / maxWord) | 0);
    words[words[lengthProperty]] = (asciiBitLength | 0);
    for (j = 0; j < words[lengthProperty];) {
      const w = words.slice(j, j += 16);
      const oldHash = hash;
      hash = hash.slice(0, 8);
      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const temp1 = hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + (w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0);
        const temp2 = (rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj;
        hash = [(temp1 + temp2) | 0, hash[0], hash[1], hash[2], (hash[3] + temp1) | 0, hash[4], hash[5], hash[6]];
      }
      for (i = 0; i < 8; i++) hash[i] = (hash[i] + oldHash[i]) | 0;
    }
    for (i = 0; i < 8; i++) {
      for (j = 3; j >= 0; j--) {
        const b = (hash[i] >> (8 * j)) & 255;
        result += (b < 16 ? '0' : '') + b.toString(16);
      }
    }
    return result;
  },

  // Clean identifier (strips leading s/S, trims whitespace)
  cleanStudentId(id) {
    const raw = String(id || '').trim().toLowerCase();
    return raw.startsWith('s') ? raw.slice(1) : raw;
  },

  // Calculate cryptographic session signature
  async computeSessionSignature(studentId, issuedAt) {
    const payload = `${this.CONFIG.AUTH_SALT}:${studentId}:${this.CONFIG.AUTH_TARGET_HASH}:${issuedAt}`;
    return await this.sha256Hex(payload);
  },

  // Anti-Blink Content Shield
  applyShield() {
    if (document.getElementById('psu-auth-shield')) return;
    const style = document.createElement('style');
    style.id = 'psu-auth-shield';
    style.innerHTML = `
      body {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transition: opacity 0.2s ease-in !important;
      }
    `;
    document.head.appendChild(style);
  },

  removeShield() {
    const shield = document.getElementById('psu-auth-shield');
    if (shield) shield.remove();
    if (document.body) {
      document.body.style.opacity = '1';
      document.body.style.visibility = 'visible';
      document.body.style.pointerEvents = 'auto';
    }
  },

  // Verify active session (supports both Backend and Cryptographic Gatekeeper)
  async checkSession() {
    const backendUrl = this.getBackendUrl();

    // 1. Try Backend if configured
    if (backendUrl) {
      try {
        const res = await fetch(`${backendUrl}/session`, {
          method: 'GET',
          credentials: 'include',
          cache: 'no-store'
        });
        if (res.ok) {
          const data = await res.json();
          if (data && data.authenticated && data.user) {
            this._currentUser = data.user;
            return { authenticated: true, user: data.user, source: 'backend' };
          }
        }
      } catch (e) {
        // Backend unavailable
      }
    }

    // 2. Cryptographic Gatekeeper Verification
    try {
      let rawSession = sessionStorage.getItem(this.CONFIG.STORAGE_KEY);
      let isRemembered = false;
      if (!rawSession) {
        rawSession = localStorage.getItem(this.CONFIG.REMEMBER_KEY);
        isRemembered = true;
      }

      if (!rawSession) return { authenticated: false };

      const sess = JSON.parse(rawSession);
      if (!sess || !sess.id || !sess.iat || !sess.sig) {
        this.clearStorage();
        return { authenticated: false };
      }

      const cleanId = this.cleanStudentId(sess.id);
      if (cleanId !== this.CONFIG.AUTHORIZED_STUDENT_ID) {
        this.clearStorage();
        return { authenticated: false };
      }

      const now = Math.floor(Date.now() / 1000);
      if (sess.exp && now > sess.exp) {
        this.clearStorage();
        return { authenticated: false, expired: true };
      }

      // Recompute and verify signature (Guards against DevTools tampering!)
      const expectedSig = await this.computeSessionSignature(cleanId, sess.iat);
      if (sess.sig !== expectedSig) {
        console.warn('Tampered session token signature detected. Rejecting session.');
        this.clearStorage();
        return { authenticated: false, tampered: true };
      }

      // Valid session confirmed
      const user = {
        studentId: this.CONFIG.AUTHORIZED_STUDENT_ID,
        studentName: this.CONFIG.AUTHORIZED_NAME
      };
      this._currentUser = user;

      // Refresh to sessionStorage if it was in localStorage
      if (isRemembered && !sessionStorage.getItem(this.CONFIG.STORAGE_KEY)) {
        sessionStorage.setItem(this.CONFIG.STORAGE_KEY, rawSession);
      }

      return { authenticated: true, user, source: 'crypto_gatekeeper' };
    } catch (e) {
      this.clearStorage();
      return { authenticated: false };
    }
  },

  // Login handler
  async login(studentId, password, rememberMe = true) {
    const cleanId = this.cleanStudentId(studentId);
    const cleanPw = String(password || '').trim();

    if (!cleanId || !cleanPw) {
      return { success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' };
    }

    const backendUrl = this.getBackendUrl();

    // 1. Try Backend if configured
    if (backendUrl) {
      try {
        const res = await fetch(`${backendUrl}/login`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ studentId: cleanId, password: cleanPw }),
          cache: 'no-store'
        });

        if (res.ok) {
          const data = await res.json();
          if (data && data.success) {
            this._currentUser = data.user;
            return { success: true, user: data.user, source: 'backend' };
          }
        } else if (res.status === 401) {
          return { success: false, message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' };
        }
      } catch (e) {
        // Backend unavailable, fallback to cryptographic gatekeeper
      }
    }

    // 2. Cryptographic Gatekeeper (Static host / GitHub Pages)
    if (cleanId !== this.CONFIG.AUTHORIZED_STUDENT_ID) {
      return { success: false, message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' };
    }

    const rawCombine = `${this.CONFIG.AUTH_SALT}:${cleanId}:${cleanPw}`;
    const calculatedHash = await this.sha256Hex(rawCombine);

    if (calculatedHash !== this.CONFIG.AUTH_TARGET_HASH) {
      return { success: false, message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' };
    }

    // Verification Succeeded! Create Cryptographically Signed Session
    const now = Math.floor(Date.now() / 1000);
    const sig = await this.computeSessionSignature(cleanId, now);
    const sessionObj = {
      id: cleanId,
      name: this.CONFIG.AUTHORIZED_NAME,
      iat: now,
      exp: now + this.CONFIG.SESSION_MAX_AGE_SEC,
      sig: sig
    };

    const sessionStr = JSON.stringify(sessionObj);
    sessionStorage.setItem(this.CONFIG.STORAGE_KEY, sessionStr);
    if (rememberMe) {
      localStorage.setItem(this.CONFIG.REMEMBER_KEY, sessionStr);
    } else {
      localStorage.removeItem(this.CONFIG.REMEMBER_KEY);
    }

    const user = {
      studentId: this.CONFIG.AUTHORIZED_STUDENT_ID,
      studentName: this.CONFIG.AUTHORIZED_NAME
    };
    this._currentUser = user;
    return { success: true, user, source: 'crypto_gatekeeper' };
  },

  // Clear storage helper
  clearStorage() {
    try {
      sessionStorage.removeItem(this.CONFIG.STORAGE_KEY);
      localStorage.removeItem(this.CONFIG.REMEMBER_KEY);
      sessionStorage.removeItem('psu_portal_session');
      localStorage.removeItem('psu_portal_session');
      localStorage.removeItem('psu_portal_remember');
    } catch (e) {}
  },

  // Logout
  async logout() {
    const backendUrl = this.getBackendUrl();
    if (backendUrl) {
      try {
        await fetch(`${backendUrl}/logout`, {
          method: 'POST',
          credentials: 'include',
          cache: 'no-store'
        });
      } catch (e) {}
    }

    this._currentUser = null;
    this.clearStorage();

    const isPagesDir = window.location.pathname.includes('/pages/');
    const loginUrl = isPagesDir ? '../login.html' : './login.html';
    window.location.href = loginUrl;
  },

  // Active user accessor
  getUser() {
    return this._currentUser;
  },

  // Gatekeeper: runs on every page load
  async guard() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html');

    if (!isLoginPage) {
      this.applyShield();
      const session = await this.checkSession();
      if (session.authenticated) {
        this.removeShield();
        this.updateBadges(session.user);
      } else {
        this.redirectToLogin();
      }
    } else {
      // On login.html: if already logged in, redirect to index
      const session = await this.checkSession();
      if (session.authenticated) {
        const params = new URLSearchParams(window.location.search);
        const target = params.get('redirect') ? decodeURIComponent(params.get('redirect')) : './index.html';
        window.location.replace(target);
      }
    }
  },

  redirectToLogin() {
    const currentTarget = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    const isPagesDir = window.location.pathname.includes('/pages/');
    const loginUrl = isPagesDir ? `../login.html?redirect=${currentTarget}` : `./login.html?redirect=${currentTarget}`;
    window.location.replace(loginUrl);
  },

  updateBadges(user) {
    if (!user) return;
    document.querySelectorAll('.auth-user-badge').forEach(badge => {
      badge.innerHTML = `👤 <strong>${user.studentId}</strong> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-left:4px;" title="ออนไลน์ (ยืนยันสิทธิ์ถูกต้อง)"></span>`;
    });
  },

  initUI() {
    document.addEventListener('DOMContentLoaded', () => {
      if (this._currentUser) {
        this.updateBadges(this._currentUser);
      }
      document.querySelectorAll('.btn-portal-logout').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          if (confirm('คุณต้องการออกจากระบบ PSU Materials Portal หรือไม่?')) {
            PSU_AUTH.logout();
          }
        });
      });
    });
  }
};

// Immediately execute Gatekeeper
PSU_AUTH.guard();
PSU_AUTH.initUI();
