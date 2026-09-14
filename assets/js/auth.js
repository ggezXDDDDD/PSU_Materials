/**
 * PSU Materials Portal - Client Authentication Guard
 * 
 * SECURITY ARCHITECTURE (Zero-Trust Client):
 * - NO credentials, NO salts, and NO password hashes exist in frontend code.
 * - Client-side storage (sessionStorage/localStorage) is NEVER trusted as proof of authentication.
 * - Access is strictly validated by the Backend via HMAC-SHA256 Cryptographic Tokens.
 * - Any session tampering in browser DevTools is immediately rejected by the Server with 401.
 */

const PSU_AUTH = {
  TOKEN_KEY: 'psu_auth_token',
  USER_KEY: 'psu_auth_user',
  REMEMBER_KEY: 'psu_auth_remember',

  // Resolve Backend API URL
  getApiBase() {
    // 1. Explicit global override
    if (window.PSU_AUTH_API_URL) {
      return window.PSU_AUTH_API_URL.replace(/\/$/, '');
    }

    // 2. Config object
    if (window.PSU_AUTH_CONFIG && window.PSU_AUTH_CONFIG.API_URL) {
      return window.PSU_AUTH_CONFIG.API_URL.replace(/\/$/, '');
    }

    // 3. Same-origin backend (Local server, Docker, VPS, Reverse Proxy)
    if (window.location.origin && window.location.origin.startsWith('http')) {
      return `${window.location.origin}/api/auth`;
    }

    // 4. Default fallback for local testing
    return 'http://localhost:8000/api/auth';
  },

  // Retrieve token from storage (unverified until backend check)
  getStoredToken() {
    try {
      return sessionStorage.getItem(this.TOKEN_KEY) || localStorage.getItem(this.TOKEN_KEY) || '';
    } catch (e) {
      return '';
    }
  },

  // Clear all local session tokens
  clearSession() {
    try {
      sessionStorage.removeItem(this.TOKEN_KEY);
      sessionStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.TOKEN_KEY);
      localStorage.removeItem(this.USER_KEY);
      localStorage.removeItem(this.REMEMBER_KEY);
      // Clean legacy keys if any
      sessionStorage.removeItem('psu_portal_session');
      localStorage.removeItem('psu_portal_session');
      localStorage.removeItem('psu_portal_remember');
    } catch (e) {}
  },

  // Anti-Blink Content Shield: Locks protected DOM before server verification
  applyShield() {
    if (document.getElementById('psu-auth-shield')) return;
    const style = document.createElement('style');
    style.id = 'psu-auth-shield';
    style.innerHTML = `
      body {
        opacity: 0 !important;
        visibility: hidden !important;
        pointer-events: none !important;
        transition: opacity 0.25s ease-in !important;
      }
    `;
    document.head.appendChild(style);
  },

  // Remove shield once server verification confirms valid session
  removeShield() {
    const shield = document.getElementById('psu-auth-shield');
    if (shield) {
      shield.remove();
    }
    if (document.body) {
      document.body.style.opacity = '1';
      document.body.style.visibility = 'visible';
      document.body.style.pointerEvents = 'auto';
    }
  },

  // SERVER-SIDE VERIFICATION: Query backend to validate cryptographic token
  async verifySessionWithServer(token) {
    if (!token) return { valid: false, message: 'No token' };

    const apiBase = this.getApiBase();
    try {
      const response = await fetch(`${apiBase}/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ token }),
        cache: 'no-store'
      });

      if (!response.ok) {
        return { valid: false, status: response.status };
      }

      const data = await response.json();
      if (data && data.success && data.valid) {
        return { valid: true, user: data.user };
      }
      return { valid: false, message: data.message || 'Invalid token' };
    } catch (err) {
      console.warn('Auth backend verification error:', err);
      // If network/server unreachable, fail safe: DO NOT allow unauthorized access
      return { valid: false, error: err };
    }
  },

  // Login via Server-Side Authentication
  async login(studentId, password, rememberMe = false) {
    const cleanId = (studentId || '').trim();
    const cleanPw = (password || '').trim();

    if (!cleanId || !cleanPw) {
      return { success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' };
    }

    const apiBase = this.getApiBase();
    try {
      const response = await fetch(`${apiBase}/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: cleanId,
          password: cleanPw
        }),
        cache: 'no-store'
      });

      const data = await response.json();

      if (response.ok && data.success && data.token) {
        // Save signed token
        sessionStorage.setItem(this.TOKEN_KEY, data.token);
        if (data.user) {
          sessionStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
        }

        if (rememberMe) {
          localStorage.setItem(this.TOKEN_KEY, data.token);
          if (data.user) {
            localStorage.setItem(this.USER_KEY, JSON.stringify(data.user));
          }
          localStorage.setItem(this.REMEMBER_KEY, 'true');
        } else {
          localStorage.removeItem(this.TOKEN_KEY);
          localStorage.removeItem(this.USER_KEY);
          localStorage.removeItem(this.REMEMBER_KEY);
        }

        return { success: true, user: data.user, token: data.token };
      }

      this.clearSession();
      return {
        success: false,
        message: data.message || 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง'
      };
    } catch (err) {
      console.error('Login network error:', err);
      return {
        success: false,
        message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ตรวจสอบสิทธิ์ได้ กรุณาตรวจสอบการเชื่อมต่อ'
      };
    }
  },

  // Logout & Revoke Session on Server
  async logout() {
    const token = this.getStoredToken();
    const apiBase = this.getApiBase();

    if (token) {
      try {
        await fetch(`${apiBase}/logout`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ token }),
          cache: 'no-store'
        });
      } catch (e) {}
    }

    this.clearSession();

    const isPagesDir = window.location.pathname.includes('/pages/');
    const loginUrl = isPagesDir ? '../login.html' : './login.html';
    window.location.href = loginUrl;
  },

  // Get active user data (if verified)
  getUser() {
    try {
      const raw = sessionStorage.getItem(this.USER_KEY) || localStorage.getItem(this.USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },

  // Gatekeeper: Executes immediately on page load
  async guard() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html');

    if (!isLoginPage) {
      // 1. Immediately apply anti-blink shield to protect page contents
      this.applyShield();

      const token = this.getStoredToken();
      if (!token) {
        // No token present -> redirect to login immediately
        this.redirectToLogin();
        return;
      }

      // 2. Validate token signature and revocation with Server
      const result = await this.verifySessionWithServer(token);
      if (result.valid) {
        // Authenticated by Server -> Remove shield & unlock DOM
        this.removeShield();
        if (result.user) {
          sessionStorage.setItem(this.USER_KEY, JSON.stringify(result.user));
          this.updateBadges(result.user);
        }
      } else {
        // Tampered token (PoC test) or expired -> Purge and kick out to login
        console.warn('Unauthorized session detected by server. Purging local storage.');
        this.clearSession();
        this.redirectToLogin();
      }
    } else {
      // On login.html: If already have a valid session on server, redirect to index
      const token = this.getStoredToken();
      if (token) {
        const result = await this.verifySessionWithServer(token);
        if (result.valid) {
          const params = new URLSearchParams(window.location.search);
          const target = params.get('redirect') ? decodeURIComponent(params.get('redirect')) : './index.html';
          window.location.replace(target);
        } else {
          this.clearSession();
        }
      }
    }
  },

  // Helper: Redirect to login with current target preserved
  redirectToLogin() {
    const currentTarget = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
    const isPagesDir = window.location.pathname.includes('/pages/');
    const loginUrl = isPagesDir ? `../login.html?redirect=${currentTarget}` : `./login.html?redirect=${currentTarget}`;
    window.location.replace(loginUrl);
  },

  // Helper: Update Top Bar badges
  updateBadges(user) {
    if (!user) return;
    document.querySelectorAll('.auth-user-badge').forEach(badge => {
      badge.innerHTML = `👤 <strong>${user.studentId}</strong> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-left:4px;" title="ออนไลน์ (ยืนยันผ่าน Server)"></span>`;
    });
  },

  // Inject UI Event Listeners
  initUI() {
    document.addEventListener('DOMContentLoaded', () => {
      const user = this.getUser();
      if (user) {
        this.updateBadges(user);
      }

      // Wire up logout buttons
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
