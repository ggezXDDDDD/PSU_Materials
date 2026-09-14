/**
 * PSU Materials Portal - Client-Side Authentication Guard
 * Protects pages from unauthorized access & manages student session
 */

const PSU_AUTH = {
  STORAGE_KEY: 'psu_portal_session',
  REMEMBER_KEY: 'psu_portal_remember',

  // Valid passwords (case-insensitive for convenience)
  VALID_PASSWORDS: [
    'psu2026',
    'materials67',
    'materials2026',
    'psulms',
    'materials',
    'admin1234'
  ],

  // Check if current user is logged in
  isAuthenticated() {
    const session = sessionStorage.getItem(this.STORAGE_KEY) || localStorage.getItem(this.REMEMBER_KEY);
    if (!session) return false;
    try {
      const data = JSON.parse(session);
      return Boolean(data && data.studentId && data.loggedInAt);
    } catch (e) {
      return false;
    }
  },

  // Get logged-in student info
  getUser() {
    const session = sessionStorage.getItem(this.STORAGE_KEY) || localStorage.getItem(this.REMEMBER_KEY);
    if (!session) return null;
    try {
      return JSON.parse(session);
    } catch (e) {
      return null;
    }
  },

  // Attempt login
  login(studentId, password, rememberMe = false) {
    const cleanId = studentId.trim();
    const cleanPw = password.trim();

    if (!cleanId || !cleanPw) {
      return { success: false, message: 'กรุณากรอกรหัสนักศึกษาและรหัสผ่าน' };
    }

    // Validate student ID format (e.g. 10 digits or s + digits)
    const idPattern = /^(s|S)?[0-9]{8,10}$/;
    if (!idPattern.test(cleanId)) {
      return { success: false, message: 'รูปแบบรหัสนักศึกษาไม่ถูกต้อง (เช่น 6710xxxxxx หรือ s67xxxxx)' };
    }

    // Validate password (cohort passwords OR student ID itself OR last 4 digits)
    const pwLower = cleanPw.toLowerCase();
    const idDigits = cleanId.replace(/[^0-9]/g, '');
    const last4 = idDigits.slice(-4);

    const isMatch = this.VALID_PASSWORDS.includes(pwLower) || 
                    cleanPw === cleanId || 
                    cleanPw === idDigits ||
                    (last4.length === 4 && cleanPw === last4);

    if (isMatch) {
      const sessionData = {
        studentId: cleanId,
        studentName: 'นักศึกษาภาควิชาวัสดุศาสตร์',
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

    return { 
      success: false, 
      message: 'รหัสผ่านไม่ถูกต้อง (หากใช้รหัสผ่านสาขา: psu2026 หรือ materials67)' 
    };
  },

  // Log out
  logout() {
    sessionStorage.removeItem(this.STORAGE_KEY);
    localStorage.removeItem(this.REMEMBER_KEY);
    
    // Redirect to login page
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
      // Save original target page for redirect after login
      const currentTarget = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
      const isPagesDir = path.includes('/pages/');
      const loginUrl = isPagesDir ? `../login.html?redirect=${currentTarget}` : `./login.html?redirect=${currentTarget}`;
      window.location.replace(loginUrl);
    } else if (authed && isLoginPage) {
      // Already logged in, redirect to index
      const params = new URLSearchParams(window.location.search);
      const target = params.get('redirect') ? decodeURIComponent(params.get('redirect')) : './index.html';
      window.location.replace(target);
    }
  },

  // Inject UI elements (user badge, logout buttons) when DOM ready
  initUI() {
    document.addEventListener('DOMContentLoaded', () => {
      const user = this.getUser();
      if (!user) return;

      // Update student ID in top bar if placeholder exists
      const userBadges = document.querySelectorAll('.auth-user-badge');
      userBadges.forEach(badge => {
        badge.innerHTML = `👤 <strong>${user.studentId}</strong> <span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981; margin-left:4px;" title="ออนไลน์"></span>`;
      });

      // Update or attach logout buttons
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
