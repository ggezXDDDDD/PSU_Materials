/**
 * PSU Materials Portal - Client Authentication Guard
 *
 * PURE SERVER-SIDE SESSION ARCHITECTURE:
 * - NO password hashes, NO salts, and NO credentials in frontend code.
 * - sessionStorage and localStorage are NEVER used to determine authentication.
 * - Authentication is strictly maintained by the Backend via HttpOnly; SameSite Cookies.
 * - Modifying sessionStorage or localStorage in DevTools has ZERO effect on access.
 * - Protected pages verify session state directly with the Backend on page load.
 */

const PSU_AUTH = {
  // Resolve Backend API URL
  getApiBase() {
    if (window.PSU_AUTH_API_URL) {
      return window.PSU_AUTH_API_URL.replace(/\/$/, '');
    }
    if (window.PSU_AUTH_CONFIG && window.PSU_AUTH_CONFIG.API_URL) {
      return window.PSU_AUTH_CONFIG.API_URL.replace(/\/$/, '');
    }
    if (window.location.origin && window.location.origin.startsWith('http')) {
      return `${window.location.origin}/api/auth`;
    }
    return 'http://localhost:8000/api/auth';
  },

  // Active user data in memory (populated ONLY after server confirms session)
  _currentUser: null,

  // Anti-Blink Content Shield: Conceals protected DOM until server confirms session
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

  // Clean any old or legacy client-side storage keys
  purgeClientStorage() {
    try {
      sessionStorage.clear();
      localStorage.removeItem('psu_portal_session');
      localStorage.removeItem('psu_portal_remember');
      localStorage.removeItem('psu_auth_token');
      localStorage.removeItem('psu_auth_user');
      localStorage.removeItem('psu_auth_remember');
    } catch (e) {}
  },

  // SERVER-SIDE VERIFICATION: Query backend to check active server session
  async checkServerSession() {
    const apiBase = this.getApiBase();
    try {
      const response = await fetch(`${apiBase}/session`, {
        method: 'GET',
        credentials: 'include', // Transmits HttpOnly cookie automatically
        cache: 'no-store'
      });

      if (!response.ok) {
        this._currentUser = null;
        return { authenticated: false };
      }

      const data = await response.json();
      if (data && data.authenticated && data.user) {
        this._currentUser = data.user;
        return { authenticated: true, user: data.user };
      }

      this._currentUser = null;
      return { authenticated: false };
    } catch (err) {
      console.warn('Backend session verification unreachable:', err);
      this._currentUser = null;
      return { authenticated: false, error: err };
    }
  },

  // Login via Server-Side Authentication
  async login(studentId, password) {
    const cleanId = (studentId || '').trim();
    const cleanPw = (password || '').trim();

    if (!cleanId || !cleanPw) {
      return { success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' };
    }

    const apiBase = this.getApiBase();
    try {
      const response = await fetch(`${apiBase}/login`, {
        method: 'POST',
        credentials: 'include', // Receives HttpOnly cookie
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

      if (response.ok && data.success) {
        this._currentUser = data.user;
        this.purgeClientStorage();
        return { success: true, user: data.user };
      }

      this._currentUser = null;
      return {
        success: false,
        message: data.message || 'รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง'
      };
    } catch (err) {
      console.error('Login network error:', err);
      return {
        success: false,
        message: 'ไม่สามารถเชื่อมต่อเซิร์ฟเวอร์ตรวจสอบสิทธิ์ได้ กรุณาตรวจสอบว่าเซิร์ฟเวอร์เปิดใช้งานอยู่'
      };
    }
  },

  // Logout & Invalidate Server-Side Session
  async logout() {
    const apiBase = this.getApiBase();
    try {
      await fetch(`${apiBase}/logout`, {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store'
      });
    } catch (e) {}

    this._currentUser = null;
    this.purgeClientStorage();

    const isPagesDir = window.location.pathname.includes('/pages/');
    const loginUrl = isPagesDir ? '../login.html' : './login.html';
    window.location.href = loginUrl;
  },

  // Get active student info (retrieved strictly from verified server session)
  getUser() {
    return this._currentUser;
  },

  // Gatekeeper: Executes immediately on page load
  async guard() {
    // Purge any deceptive client-side storage keys immediately
    this.purgeClientStorage();

    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html');

    if (!isLoginPage) {
      // 1. Immediately shield page contents
      this.applyShield();

      // 2. Query Server for active session (via HttpOnly cookie)
      const session = await this.checkServerSession();

      if (session.authenticated) {
        // Authenticated by Server -> Remove shield & unlock DOM
        this.removeShield();
        this.updateBadges(session.user);
      } else {
        // Unauthenticated or tampered -> Redirect to login immediately
        this.redirectToLogin();
      }
    } else {
      // On login.html: If already have an active server session, redirect to index
      const session = await this.checkServerSession();
      if (session.authenticated) {
        const params = new URLSearchParams(window.location.search);
        const target = params.get('redirect') ? decodeURIComponent(params.get('redirect')) : './index.html';
        window.location.replace(target);
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
      badge.innerHTML = `👤 <strong>${user.studentId}</strong> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-left:4px;" title="ออนไลน์ (เซสชันได้รับการยืนยันจากเซิร์ฟเวอร์)"></span>`;
    });
  },

  // Inject UI Event Listeners
  initUI() {
    document.addEventListener('DOMContentLoaded', () => {
      if (this._currentUser) {
        this.updateBadges(this._currentUser);
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
