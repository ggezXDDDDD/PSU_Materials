#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSU Materials Portal - Cryptographic Server-Side Authentication & Route Guard
- Zero-dependency: Built entirely on Python 3 Standard Library
- Server-Side Session Management: State stored on server, verified via HttpOnly Cookie
- HttpOnly + SameSite Cookie: Inaccessible to JavaScript and DevTools
- Zero Client Trust: Modifying sessionStorage/localStorage has ZERO effect on authentication
- Server-Side Route Guard: Protected HTML is NEVER served without a valid server session
- Server-Side Logout Invalidation: Destroys session on the server immediately
"""

import sys
import os
import time
import json
import hmac
import hashlib
import secrets
import socket
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ==============================================================================
# Server Configuration & Storage
# ==============================================================================
WORKSPACE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", 8000))

# Authorized Credentials (Evaluated strictly on Server-Side)
AUTHORIZED_STUDENT_ID = os.environ.get("AUTH_STUDENT_ID", "6810210432")
SALT = os.environ.get("AUTH_SALT", "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1")
# Salted SHA-256 target hash for authorized student account
AUTHORIZED_PASSWORD_HASH = os.environ.get(
    "AUTH_PASSWORD_HASH",
    "6f01bf8bb49aeca544df34fc67401dd868d4f4c37da9b013fad4a01ebbcc8b32"
)

# Session Lifetime: 7 days
SESSION_EXPIRY_SECONDS = 7 * 24 * 3600
COOKIE_NAME = "psu_session"

# Server-Side Active Session Store (session_id -> session_data)
SERVER_SESSIONS = {}
SESSIONS_FILE = os.path.join(WORKSPACE, ".sessions.json")

def load_sessions():
    global SERVER_SESSIONS
    if os.path.exists(SESSIONS_FILE):
        try:
            with open(SESSIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                now = time.time()
                SERVER_SESSIONS = {
                    k: v for k, v in data.items()
                    if v.get("expiresAt", 0) > now
                }
        except Exception:
            SERVER_SESSIONS = {}

def save_sessions():
    try:
        with open(SESSIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(SERVER_SESSIONS, f)
    except Exception:
        pass

# Initialize session store
load_sessions()

# ==============================================================================
# Authentication & Verification Helpers
# ==============================================================================
def verify_credentials(student_id: str, password: str) -> bool:
    clean_id = (student_id or "").strip().lower().replace("@psu.ac.th", "").replace("@email.psu.ac.th", "")
    if clean_id.startswith("s"):
        clean_id = clean_id[1:]
    clean_pw = (password or "").strip()

    if clean_id != AUTHORIZED_STUDENT_ID or not clean_pw:
        return False

    raw_message = f"{SALT}:{clean_id}:{clean_pw}".encode("utf-8")
    computed_hash = hashlib.sha256(raw_message).hexdigest()
    return hmac.compare_digest(computed_hash, AUTHORIZED_PASSWORD_HASH)

def create_server_session(student_id: str, student_name: str = "Kongpop") -> str:
    session_id = secrets.token_hex(32)
    now = time.time()
    SERVER_SESSIONS[session_id] = {
        "studentId": student_id,
        "studentName": student_name,
        "createdAt": now,
        "expiresAt": now + SESSION_EXPIRY_SECONDS
    }
    save_sessions()
    return session_id

def validate_server_session(session_id: str):
    if not session_id or session_id not in SERVER_SESSIONS:
        return None
    session_data = SERVER_SESSIONS[session_id]
    if session_data.get("expiresAt", 0) < time.time():
        del SERVER_SESSIONS[session_id]
        save_sessions()
        return None
    return session_data

def invalidate_server_session(session_id: str):
    if session_id in SERVER_SESSIONS:
        del SERVER_SESSIONS[session_id]
        save_sessions()

# ==============================================================================
# HTTP Request Handler with Server-Side Route Guard
# ==============================================================================
class SecureSessionHTTPRequestHandler(SimpleHTTPRequestHandler):
    def get_session_id_from_request(self) -> str:
        cookie_header = self.headers.get("Cookie")
        if cookie_header:
            cookies = urllib.parse.parse_qs(cookie_header.replace("; ", "&"))
            if COOKIE_NAME in cookies and cookies[COOKIE_NAME]:
                return cookies[COOKIE_NAME][0].strip()
        return ""

    def send_json_response(self, status_code: int, data: dict, set_session_id: str = None, clear_session: bool = False):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        
        # Build HttpOnly cookie
        cookie_flags = "HttpOnly; SameSite=Lax; Path=/"
        if self.headers.get("X-Forwarded-Proto") == "https":
            cookie_flags += "; Secure"

        if set_session_id:
            self.send_header("Set-Cookie", f"{COOKIE_NAME}={set_session_id}; Max-Age={SESSION_EXPIRY_SECONDS}; {cookie_flags}")
        elif clear_session:
            self.send_header("Set-Cookie", f"{COOKIE_NAME}=; Max-Age=0; {cookie_flags}")
            
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # Handle CORS pre-flight
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_POST(self):
        parsed_path = urllib.parse.urlparse(self.path).path

        # Read JSON body
        content_len = int(self.headers.get("Content-Length", 0))
        body_bytes = self.rfile.read(content_len) if content_len > 0 else b"{}"
        try:
            body = json.loads(body_bytes.decode("utf-8")) if body_bytes else {}
        except Exception:
            body = {}

        # ----------------------------------------------------------------------
        # API 1: /api/auth/login
        # ----------------------------------------------------------------------
        if parsed_path == "/api/auth/login":
            student_id = body.get("studentId", "")
            password = body.get("password", "")

            if not student_id or not password:
                self.send_json_response(400, {
                    "success": False,
                    "message": "กรุณากรอกรหัสนักศึกษาและรหัสผ่าน"
                })
                return

            if verify_credentials(student_id, password):
                session_id = create_server_session(AUTHORIZED_STUDENT_ID, "Kongpop")
                self.send_json_response(200, {
                    "success": True,
                    "user": {
                        "studentId": AUTHORIZED_STUDENT_ID,
                        "studentName": "Kongpop"
                    }
                }, set_session_id=session_id)
            else:
                self.send_json_response(401, {
                    "success": False,
                    "message": "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง"
                })
            return

        # ----------------------------------------------------------------------
        # API 2: /api/auth/session (Server Session Verification)
        # ----------------------------------------------------------------------
        if parsed_path in ("/api/auth/session", "/api/auth/verify"):
            session_id = self.get_session_id_from_request()
            session_data = validate_server_session(session_id)

            if session_data:
                self.send_json_response(200, {
                    "success": True,
                    "authenticated": True,
                    "user": {
                        "studentId": session_data.get("studentId"),
                        "studentName": session_data.get("studentName", "Kongpop")
                    }
                })
            else:
                self.send_json_response(401, {
                    "success": False,
                    "authenticated": False,
                    "message": "ไม่มี Session บนเซิร์ฟเวอร์ หรือ Session หมดอายุ"
                }, clear_session=True)
            return

        # ----------------------------------------------------------------------
        # API 3: /api/auth/logout (Server Session Destruction)
        # ----------------------------------------------------------------------
        if parsed_path == "/api/auth/logout":
            session_id = self.get_session_id_from_request()
            invalidate_server_session(session_id)
            self.send_json_response(200, {
                "success": True,
                "message": "ออกจากระบบและทำลาย Session บนเซิร์ฟเวอร์เรียบร้อยแล้ว"
            }, clear_session=True)
            return

        self.send_error(404, "Endpoint not found")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Handle API GET /api/auth/session
        if path == "/api/auth/session" or path == "/api/auth/verify":
            session_id = self.get_session_id_from_request()
            session_data = validate_server_session(session_id)
            if session_data:
                self.send_json_response(200, {
                    "success": True,
                    "authenticated": True,
                    "user": {
                        "studentId": session_data.get("studentId"),
                        "studentName": session_data.get("studentName", "Kongpop")
                    }
                })
            else:
                self.send_json_response(401, {
                    "success": False,
                    "authenticated": False,
                    "message": "ไม่มี Session บนเซิร์ฟเวอร์ หรือ Session หมดอายุ"
                }, clear_session=True)
            return

        # Unpack root to index.html
        if path == "/" or path == "":
            path = "/index.html"

        # Public resources (do not require session)
        is_public = (
            path == "/login.html" or
            path.startswith("/assets/") or
            path == "/manifest.json" or
            path == "/sw.js" or
            path == "/favicon.ico" or
            path.startswith("/api/")
        )

        # ----------------------------------------------------------------------
        # SERVER-SIDE ROUTE GUARD FOR PROTECTED HTML FILES
        # (index.html, tasks.html, calendar.html, pages/*.html)
        # ----------------------------------------------------------------------
        if not is_public and path.endswith(".html"):
            session_id = self.get_session_id_from_request()
            session_data = validate_server_session(session_id)

            if not session_data:
                # Intercept! Do NOT serve HTML to unauthenticated clients
                target = urllib.parse.quote(self.path)
                redirect_url = f"/login.html?redirect={target}"
                self.send_response(302)
                self.send_header("Location", redirect_url)
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
                self.send_header("Set-Cookie", f"{COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax")
                self.end_headers()
                return

        # If already logged in and visiting login.html, redirect to index.html
        if path == "/login.html":
            session_id = self.get_session_id_from_request()
            if validate_server_session(session_id):
                params = urllib.parse.parse_qs(parsed.query)
                target = params.get("redirect", ["/index.html"])[0]
                self.send_response(302)
                self.send_header("Location", target)
                self.end_headers()
                return

        # Disable cache for development & live auth updates
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        self.send_header("Pragma", "no-cache")
        self.send_header("Expires", "0")
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin", "*"))
        self.send_header("Access-Control-Allow-Credentials", "true")
        super().end_headers()

    def log_message(self, format, *args):
        msg = format % args
        if "/api/" in msg or " 302 " in msg or " 401 " in msg:
            sys.stderr.write(f"\033[90m[{self.log_date_time_string()}]\033[0m {msg}\n")

# Backwards-compatible alias for test scripts
SecureAuthHTTPRequestHandler = SecureSessionHTTPRequestHandler

# ==============================================================================
# Server Runner
# ==============================================================================
def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

def run():
    os.chdir(WORKSPACE)
    lan_ip = get_lan_ip()
    server_address = ("0.0.0.0", PORT)

    try:
        httpd = HTTPServer(server_address, SecureSessionHTTPRequestHandler)
    except OSError:
        httpd = HTTPServer(("0.0.0.0", PORT + 1), SecureSessionHTTPRequestHandler)

    actual_port = httpd.server_port
    local_url = f"http://localhost:{actual_port}"
    network_url = f"http://{lan_ip}:{actual_port}"

    print("\n" + "═" * 65)
    print(" 🛡️   \033[1;36mPSU Materials Portal - Server-Side Session Auth Gatekeeper\033[0m")
    print("═" * 65)
    print(f"  💻  \033[1mLocal URL:      \033[0m \033[4;34m{local_url}\033[0m")
    print(f"  📱  \033[1mNetwork URL:    \033[0m \033[4;32m{network_url}\033[0m")
    print(f"  🔒  \033[1mSession Mode:   \033[0m Server-Side Storage + HttpOnly Cookie")
    print(f"  🛡️  \033[1mRoute Guard:    \033[0m Protected HTML Interception Active")
    print(f"  🚫  \033[1mClient Trust:   \033[0m ZERO (sessionStorage/localStorage ignored)")
    print(f"  📂  \033[1mRoot Directory: \033[0m {WORKSPACE}")
    print("═" * 65)
    print("  💡 กด \033[1mCtrl + C\033[0m เพื่อหยุดเซิร์ฟเวอร์\n")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\033[1;33m🛑 เซิร์ฟเวอร์หยุดการทำงานเรียบร้อยแล้ว\033[0m")
        sys.exit(0)

if __name__ == "__main__":
    run()
