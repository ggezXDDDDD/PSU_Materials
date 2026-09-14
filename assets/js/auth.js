/**
 * PSU Materials Portal - Cryptographic Zero-Knowledge Client Authentication Guard
 * Uses Salted SHA-256 (Web Crypto API with pure JS fallback).
 * Plaintext credentials are NEVER stored anywhere in the codebase.
 */

const PSU_AUTH = {
  STORAGE_KEY: 'psu_portal_session',
  REMEMBER_KEY: 'psu_portal_remember',

  // Cryptographic Salt and Target Hash for authorized account
  SALT: 'PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1',
  AUTH_HASH: '1a92847f425cb99bc9144ee58e6b0c6f70aa22ac4f2297233e131d0af00f63d1',
  STUDENT_ID: '6810210432',

  // SHA-256 computation using Web Crypto API with portable fallback
  async hashCredential(studentId, password) {
    const cleanUser = (studentId || '').trim().toLowerCase().replace(/^s/, '');
    const cleanPass = (password || '').trim();
    const message = `${this.SALT}:${cleanUser}:${cleanPass}`;

    if (window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Pure JavaScript SHA-256 Fallback
    return this._sha256Fallback(message);
  },

  // Fallback SHA-256 implementation
  _sha256Fallback(ascii) {
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
    let hash = [];
    const k = [];
    let primeCounter = 0;

    const isPrime = (candidate) => {
      for (let factor = 2, max = Math.sqrt(candidate); factor <= max; factor++) {
        if (candidate % factor === 0) return false;
      }
      return true;
    };

    for (let candidate = 2; primeCounter < 64; candidate++) {
      if (isPrime(candidate)) {
        if (primeCounter < 8) {
          hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
        }
        k[primeCounter] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
        primeCounter++;
      }
    }

    ascii += '\x80';
    while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
    for (i = 0; i < ascii[lengthProperty]; i++) {
      j = ascii.charCodeAt(i);
      words[i >> 2] |= j << (((3 - i) % 4) * 8);
    }
    words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
    words[words[lengthProperty]] = asciiBitLength;

    for (j = 0; j < words[lengthProperty]; ) {
      const w = words.slice(j, (j += 16));
      const oldHash = hash;
      hash = hash.slice(0, 8);

      for (i = 0; i < 64; i++) {
        const w15 = w[i - 15], w2 = w[i - 2];
        const s0 = rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3);
        const s1 = rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10);
        w[i] = (i < 16) ? w[i] : (w[i - 16] + s0 + w[i - 7] + s1) | 0;

        const ch = (hash[4] & hash[5]) ^ (~hash[4] & hash[6]);
        const maj = (hash[0] & hash[1]) ^ (hash[0] & hash[2]) ^ (hash[1] & hash[2]);
        const temp1 = (hash[7] + (rightRotate(hash[4], 6) ^ rightRotate(hash[4], 11) ^ rightRotate(hash[4], 25)) + ch + k[i] + w[i]) | 0;
        const temp2 = ((rightRotate(hash[0], 2) ^ rightRotate(hash[0], 13) ^ rightRotate(hash[0], 22)) + maj) | 0;

        hash = [(temp1 + temp2) | 0].concat(hash);
        hash[4] = (hash[4] + temp1) | 0;
        hash.pop();
      }

      for (i = 0; i < 8; i++) {
        hash[i] = (hash[i] + oldHash[i]) | 0;
      }
    }

    for (i = 0; i < 8; i++) {
      for (let b = 3; b >= 0; b--) {
        const byte = (hash[i] >> (b * 8)) & 255;
        result += (byte < 16 ? '0' : '') + byte.toString(16);
      }
    }
    return result;
  },

  // Clear all invalid or old sessions
  clearSession() {
    try {
      sessionStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.REMEMBER_KEY);
      sessionStorage.clear();
      localStorage.removeItem('psu_portal_remember');
      localStorage.removeItem('psu_portal_session');
    } catch (e) {}
  },

  // Check if current user is logged in with valid cryptographic token
  isAuthenticated() {
    const session = sessionStorage.getItem(this.STORAGE_KEY) || localStorage.getItem(this.REMEMBER_KEY);
    if (!session) return false;
    try {
      const data = JSON.parse(session);
      const isAllowedId = data && (data.studentId === this.STUDENT_ID);
      const isTokenValid = data && (data.token === this.AUTH_HASH);
      if (isAllowedId && isTokenValid && data.loggedInAt) {
        return true;
      }
      this.clearSession();
      return false;
    } catch (e) {
      this.clearSession();
      return false;
    }
  },

  // Get logged-in student info
  getUser() {
    if (!this.isAuthenticated()) return null;
    try {
      const session = sessionStorage.getItem(this.STORAGE_KEY) || localStorage.getItem(this.REMEMBER_KEY);
      return JSON.parse(session);
    } catch (e) {
      return null;
    }
  },

  // Attempt login via Salted SHA-256 verification
  async login(studentId, password, rememberMe = false) {
    const cleanId = (studentId || '').trim().toLowerCase().replace(/^s/, '');
    const cleanPw = (password || '').trim();

    if (!cleanId || !cleanPw) {
      return { success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' };
    }

    try {
      const hash = await this.hashCredential(cleanId, cleanPw);
      if (hash === this.AUTH_HASH && cleanId === this.STUDENT_ID) {
        const sessionData = {
          studentId: this.STUDENT_ID,
          studentName: 'Kongpop',
          token: this.AUTH_HASH,
          loggedInAt: new Date().toISOString(),
          rememberMe: Boolean(rememberMe)
        };

        const serialized = JSON.stringify(sessionData);
        sessionStorage.setItem(this.STORAGE_KEY, serialized);

        if (rememberMe) {
          localStorage.setItem(this.REMEMBER_KEY, serialized);
        } else {
          localStorage.removeItem(this.REMEMBER_KEY);
        }

        return { success: true, user: sessionData };
      }
    } catch (err) {
      console.error('Login verification error:', err);
    }

    this.clearSession();
    return { 
      success: false, 
      message: 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง' 
    };
  },

  // Log out
  logout() {
    this.clearSession();
    const isPagesDir = window.location.pathname.includes('/pages/');
    const loginUrl = isPagesDir ? '../login.html' : './login.html';
    window.location.href = loginUrl;
  },

  // Gatekeeper redirect logic
  guard() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html');
    const authed = this.isAuthenticated();

    if (!authed && !isLoginPage) {
      const currentTarget = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      const isPagesDir = path.includes('/pages/');
      const loginUrl = isPagesDir ? `../login.html?redirect=${currentTarget}` : `./login.html?redirect=${currentTarget}`;
      window.location.replace(loginUrl);
    } else if (authed && isLoginPage) {
      const params = new URLSearchParams(window.location.search);
      const target = params.get('redirect') ? decodeURIComponent(params.get('redirect')) : './index.html';
      window.location.replace(target);
    }
  },

  // Inject UI elements
  initUI() {
    document.addEventListener('DOMContentLoaded', () => {
      const user = this.getUser();
      if (!user) return;

      const userBadges = document.querySelectorAll('.auth-user-badge');
      userBadges.forEach(badge => {
        badge.innerHTML = `👤 <strong>${user.studentId}</strong> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-left:4px;" title="ออนไลน์"></span>`;
      });

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

// Immediately guard execution
PSU_AUTH.guard();
PSU_AUTH.initUI();
