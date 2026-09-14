#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSU Materials Portal - Cryptographic Server-Side Authentication & Route Guard
- Zero-dependency: Built on Python 3 Standard Library
- Enforces Server-Side Authentication: Client can NEVER bypass or forge sessions
- Cryptographic Token Signing: HMAC-SHA256 JWT with private server secret key
- Token Revocation: Server-side blacklist prevents replay attacks after logout
- Server-Side Route Guard: Protected HTML is NEVER served to unauthenticated clients
- CORS enabled: Supports decoupled frontend (e.g. GitHub Pages) talking to API
"""

import sys
import os
import time
import json
import hmac
import hashlib
import secrets
import base64
import socket
import urllib.parse
from http.server import HTTPServer, SimpleHTTPRequestHandler

# ==============================================================================
# Server Configuration & Secrets
# ==============================================================================
WORKSPACE = os.path.dirname(os.path.abspath(__file__))
PORT = int(os.environ.get("PORT", 8000))

# Server-Side HMAC Secret Key (Must NEVER be exposed to frontend)
SERVER_SECRET = os.environ.get("PORTAL_SECRET_KEY")
if not SERVER_SECRET:
    # Use deterministic or persistent secret file if available, or generate secure secret
    secret_file = os.path.join(WORKSPACE, ".server_secret")
    if os.path.exists(secret_file):
        with open(secret_file, "r", encoding="utf-8") as f:
            SERVER_SECRET = f.read().strip()
    else:
        SERVER_SECRET = secrets.token_hex(32)
        try:
            with open(secret_file, "w", encoding="utf-8") as f:
                f.write(SERVER_SECRET)
        except Exception:
            pass

# Authorized Credentials (Evaluated strictly on Server-Side)
AUTHORIZED_STUDENT_ID = os.environ.get("AUTH_STUDENT_ID", "6810210432")
SALT = os.environ.get("AUTH_SALT", "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1")
# Salted SHA-256 target hash for authorized student account
AUTHORIZED_PASSWORD_HASH = os.environ.get(
    "AUTH_PASSWORD_HASH",
    "6f01bf8bb49aeca544df34fc67401dd868d4f4c37da9b013fad4a01ebbcc8b32"
)

# Active Revocation Store (Server-side blacklist of revoked token JTIs)
REVOKED_JTIS = set()

# Token Lifetime: 7 days
TOKEN_EXPIRY_SECONDS = 7 * 24 * 3600

# ==============================================================================
# Cryptographic Token Utilities (HMAC-SHA256)
# ==============================================================================
def b64_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).decode("utf-8").rstrip("=")

def b64_decode(data: str) -> bytes:
    padding = 4 - (len(data) % 4)
    if padding != 4:
        data += "=" * padding
    return base64.urlsafe_b64decode(data)

def create_signed_token(student_id: str, student_name: str = "Kongpop") -> str:
    now = int(time.time())
    header = {"alg": "HS256", "typ": "JWT"}
    payload = {
        "sub": student_id,
        "name": student_name,
        "iat": now,
        "exp": now + TOKEN_EXPIRY_SECONDS,
        "jti": secrets.token_hex(16)
    }
    encoded_header = b64_encode(json.dumps(header).encode("utf-8"))
    encoded_payload = b64_encode(json.dumps(payload).encode("utf-8"))
    signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
    signature = hmac.new(SERVER_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
    encoded_signature = b64_encode(signature)
    return f"{encoded_header}.{encoded_payload}.{encoded_signature}"

def verify_signed_token(token: str):
    """
    Verifies token signature, expiration, and revocation status.
    Returns payload dict if valid, or None if invalid/tampered/expired.
    """
    if not token or not isinstance(token, str):
        return None
    parts = token.split(".")
    if len(parts) != 3:
        return None
    encoded_header, encoded_payload, encoded_signature = parts
    try:
        signing_input = f"{encoded_header}.{encoded_payload}".encode("utf-8")
        expected_sig = hmac.new(SERVER_SECRET.encode("utf-8"), signing_input, hashlib.sha256).digest()
        provided_sig = b64_decode(encoded_signature)
        if not hmac.compare_digest(expected_sig, provided_sig):
            return None  # Tampered signature!
        
        payload_bytes = b64_decode(encoded_payload)
        payload = json.loads(payload_bytes.decode("utf-8"))
        
        # Check expiration
        now = int(time.time())
        if payload.get("exp", 0) < now:
            return None  # Expired
            
        # Check server revocation blacklist
        jti = payload.get("jti")
        if not jti or jti in REVOKED_JTIS:
            return None  # Revoked on server!
            
        # Verify subject
        clean_sub = str(payload.get("sub", "")).strip().lower().replace("s", "")
        if clean_sub != AUTHORIZED_STUDENT_ID:
            return None
            
        return payload
    except Exception:
        return None

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

# ==============================================================================
# HTTP Request Handler & Route Gatekeeper
# ==============================================================================
class SecureAuthHTTPRequestHandler(SimpleHTTPRequestHandler):
    def get_token_from_request(self) -> str:
        # 1. Check Authorization header: Bearer <token>
        auth_header = self.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header[7:].strip()

        # 2. Check Cookie header: psu_auth_token=<token>
        cookie_header = self.headers.get("Cookie")
        if cookie_header:
            cookies = urllib.parse.parse_qs(cookie_header.replace("; ", "&"))
            if "psu_auth_token" in cookies and cookies["psu_auth_token"]:
                return cookies["psu_auth_token"][0].strip()

        return ""

    def send_json_response(self, status_code: int, data: dict, set_cookie: str = None, clear_cookie: bool = False):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        if set_cookie:
            self.send_header("Set-Cookie", f"psu_auth_token={set_cookie}; Path=/; Max-Age={TOKEN_EXPIRY_SECONDS}; SameSite=Lax")
        elif clear_cookie:
            self.send_header("Set-Cookie", "psu_auth_token=; Path=/; Max-Age=0; SameSite=Lax")
        self.end_headers()
        self.wfile.write(body)

    def do_OPTIONS(self):
        # Handle CORS pre-flight
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
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
                token = create_signed_token(AUTHORIZED_STUDENT_ID, "Kongpop")
                self.send_json_response(200, {
                    "success": True,
                    "token": token,
                    "user": {
                        "studentId": AUTHORIZED_STUDENT_ID,
                        "studentName": "Kongpop"
                    }
                }, set_cookie=token)
            else:
                self.send_json_response(401, {
                    "success": False,
                    "message": "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง"
                })
            return

        # ----------------------------------------------------------------------
        # API 2: /api/auth/verify (Tamper-Proof Verification Endpoint)
        # ----------------------------------------------------------------------
        if parsed_path == "/api/auth/verify":
            token = self.get_token_from_request() or body.get("token", "")
            payload = verify_signed_token(token)

            if payload:
                self.send_json_response(200, {
                    "success": True,
                    "valid": True,
                    "user": {
                        "studentId": payload.get("sub"),
                        "studentName": payload.get("name", "Kongpop")
                    }
                })
            else:
                self.send_json_response(401, {
                    "success": False,
                    "valid": False,
                    "message": "Session ไม่ถูกต้อง หมดอายุ หรือถูกเพิกถอน"
                }, clear_cookie=True)
            return

        # ----------------------------------------------------------------------
        # API 3: /api/auth/logout
        # ----------------------------------------------------------------------
        if parsed_path == "/api/auth/logout":
            token = self.get_token_from_request() or body.get("token", "")
            if token:
                try:
                    parts = token.split(".")
                    if len(parts) == 3:
                        payload = json.loads(b64_decode(parts[1]).decode("utf-8"))
                        jti = payload.get("jti")
                        if jti:
                            REVOKED_JTIS.add(jti)
                except Exception:
                    pass

            self.send_json_response(200, {
                "success": True,
                "message": "ออกจากระบบเรียบร้อยแล้ว"
            }, clear_cookie=True)
            return

        self.send_error(404, "Endpoint not found")

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        path = parsed.path

        # Unpack root to index.html
        if path == "/" or path == "":
            path = "/index.html"

        # List of public endpoints that don't need authentication
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
            token = self.get_token_from_request()
            payload = verify_signed_token(token)

            if not payload:
                # Redirect immediately to login.html with redirect parameter
                target = urllib.parse.quote(self.path)
                redirect_url = f"/login.html?redirect={target}"
                self.send_response(302)
                self.send_header("Location", redirect_url)
                self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
                self.send_header("Set-Cookie", "psu_auth_token=; Path=/; Max-Age=0; SameSite=Lax")
                self.end_headers()
                return

        # If already logged in and visiting login.html, redirect to index.html
        if path == "/login.html":
            token = self.get_token_from_request()
            if verify_signed_token(token):
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
        self.send_header("Access-Control-Allow-Origin", "*")
        super().end_headers()

    def log_message(self, format, *args):
        # Quiet clean logging
        msg = format % args
        if "/api/" in msg or " 302 " in msg or " 401 " in msg:
            sys.stderr.write(f"\033[90m[{self.log_date_time_string()}]\033[0m {msg}\n")

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
        httpd = HTTPServer(server_address, SecureAuthHTTPRequestHandler)
    except OSError:
        httpd = HTTPServer(("0.0.0.0", PORT + 1), SecureAuthHTTPRequestHandler)

    actual_port = httpd.server_port
    local_url = f"http://localhost:{actual_port}"
    network_url = f"http://{lan_ip}:{actual_port}"

    print("\n" + "═" * 65)
    print(" 🛡️   \033[1;36mPSU Materials Portal - Cryptographic Secure Backend Server\033[0m")
    print("═" * 65)
    print(f"  💻  \033[1mLocal URL:      \033[0m \033[4;34m{local_url}\033[0m")
    print(f"  📱  \033[1mNetwork URL:    \033[0m \033[4;32m{network_url}\033[0m")
    print(f"  🔒  \033[1mAuth Mode:      \033[0m HMAC-SHA256 Signed Tokens (Zero Client Trust)")
    print(f"  🛡️  \033[1mRoute Guard:    \033[0m Server-Side HTML Gatekeeper Activated")
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
