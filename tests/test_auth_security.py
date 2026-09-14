#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSU Materials Portal - Security Test Suite
Tests Server-Side Session Management, HttpOnly Cookie Verification,
Route Guarding, PoC Session Tamper Prevention, and Server-Side Logout Destruction.
"""

import sys
import os
import time
import json
import urllib.request
import urllib.error
import threading

WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, WORKSPACE)

import server

TEST_PORT = 8998
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

def run_test_server():
    server.PORT = TEST_PORT
    server_address = ("127.0.0.1", TEST_PORT)
    httpd = server.HTTPServer(server_address, server.SecureSessionHTTPRequestHandler)
    httpd.serve_forever()

def http_post(endpoint: str, data: dict, headers: dict = None):
    url = f"{BASE_URL}{endpoint}"
    req_headers = {"Content-Type": "application/json"}
    if headers:
        req_headers.update(headers)
    body = json.dumps(data).encode("utf-8")
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    req = urllib.request.Request(url, data=body, headers=req_headers, method="POST")
    try:
        with opener.open(req) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8")), resp.headers
    except urllib.error.HTTPError as e:
        try:
            return e.code, json.loads(e.read().decode("utf-8")), e.headers
        except Exception:
            return e.code, None, e.headers

def http_get(endpoint: str, headers: dict = None, follow_redirect: bool = False):
    url = f"{BASE_URL}{endpoint}"
    req_headers = {}
    if headers:
        req_headers.update(headers)
        
    class NoRedirect(urllib.request.HTTPRedirectHandler):
        def redirect_request(self, req, fp, code, msg, headers, newurl):
            return None

    handlers = [urllib.request.ProxyHandler({})]
    if not follow_redirect:
        handlers.append(NoRedirect)
    opener = urllib.request.build_opener(*handlers)
    req = urllib.request.Request(url, headers=req_headers, method="GET")
    try:
        with opener.open(req) as resp:
            raw = resp.read().decode("utf-8", errors="ignore")
            try:
                data = json.loads(raw)
            except Exception:
                data = raw
            return resp.status, data, resp.headers
    except urllib.error.HTTPError as e:
        raw = e.read().decode("utf-8", errors="ignore")
        try:
            data = json.loads(raw)
        except Exception:
            data = raw
        return e.code, data, e.headers

def extract_cookie(headers):
    set_cookie = headers.get("Set-Cookie", "")
    if "psu_session=" in set_cookie:
        parts = set_cookie.split("psu_session=")[1].split(";")[0]
        return parts.strip()
    return ""

def main():
    print("═" * 70)
    print(" 🛡️  STARTING SERVER-SIDE SESSION & POC VERIFICATION SUITE")
    print("═" * 70)

    # Start background server
    t = threading.Thread(target=run_test_server, daemon=True)
    t.start()
    time.sleep(1)

    passed_count = 0
    total_tests = 8

    # --------------------------------------------------------------------------
    # Test 1: PoC Attack 1: Client DevTools Storage Tampering
    # Attacker injects fake data in sessionStorage/localStorage and queries /api/auth/session
    # --------------------------------------------------------------------------
    print("\n[Test 1] PoC Attack 1: DevTools sessionStorage / localStorage Tampering...")
    status, body, _ = http_get("/api/auth/session")
    if status == 401 and body.get("authenticated") is False:
        print("  ✅ PASS: Server rejected request without valid HttpOnly session cookie (401).")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Unauthenticated session query was not rejected! (Status: {status})")

    # --------------------------------------------------------------------------
    # Test 2: PoC Attack 2: Cookie Forgery
    # Attacker crafts an arbitrary session ID cookie.
    # --------------------------------------------------------------------------
    print("\n[Test 2] PoC Attack 2: Forged Session ID Cookie...")
    forged_cookie = "psu_session=fake_attacker_session_token_12345"
    status, body, _ = http_get("/api/auth/session", headers={"Cookie": forged_cookie})
    status_page, _, _ = http_get("/index.html", headers={"Cookie": forged_cookie})
    if status == 401 and status_page == 302 and body.get("authenticated") is False:
        print("  ✅ PASS: Forged cookie rejected by server on both API (401) and Protected HTML (302).")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Forged cookie was accepted! (API: {status}, Page: {status_page})")

    # --------------------------------------------------------------------------
    # Test 3: Route Guarding - Direct Protected HTML Access
    # Attacker tries to GET /index.html directly without any session cookie.
    # --------------------------------------------------------------------------
    print("\n[Test 3] Route Guarding: Access Protected Pages Without Cookie...")
    status, _, headers = http_get("/index.html")
    location = headers.get("Location", "")
    if status == 302 and "login.html" in location:
        print(f"  ✅ PASS: Direct access to index.html was blocked (302 Redirect to {location}).")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: index.html leaked without authentication! (Status: {status})")

    # --------------------------------------------------------------------------
    # Test 4: Invalid Password Login
    # --------------------------------------------------------------------------
    print("\n[Test 4] Login with Wrong Credentials...")
    status, body, _ = http_post("/api/auth/login", {"studentId": "6810210432", "password": "wrong_attacker_password"})
    if status == 401 and body.get("success") is False:
        print("  ✅ PASS: Invalid credentials correctly rejected with 401.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Wrong password accepted! (Status: {status})")

    # --------------------------------------------------------------------------
    # Test 5: Valid Login (Issues HttpOnly Cookie)
    # --------------------------------------------------------------------------
    test_password = os.environ.get("AUTH_PASSWORD", "PortalSecurityTestPassword_2026!")
    test_raw = f"{server.SALT}:{server.AUTHORIZED_STUDENT_ID}:{test_password}".encode("utf-8")
    server.AUTHORIZED_PASSWORD_HASH = server.hashlib.sha256(test_raw).hexdigest()

    print("\n[Test 5] Login with Valid Credentials...")
    status, body, headers = http_post("/api/auth/login", {"studentId": server.AUTHORIZED_STUDENT_ID, "password": test_password})
    session_id = extract_cookie(headers)
    set_cookie = headers.get("Set-Cookie", "")
    if status == 200 and body.get("success") is True and session_id and "HttpOnly" in set_cookie and "SameSite=Lax" in set_cookie:
        print("  ✅ PASS: Login succeeded! HttpOnly; SameSite=Lax session cookie issued.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Valid login failed! (Status: {status}, Set-Cookie: {set_cookie})")

    # --------------------------------------------------------------------------
    # Test 6: Server Session Verification & Protected Route Access
    # --------------------------------------------------------------------------
    print("\n[Test 6] Server-Side Session Verification & Protected Route Access...")
    cookie_header = {"Cookie": f"psu_session={session_id}"}
    status, body, _ = http_get("/api/auth/session", headers=cookie_header)
    status_page, _, _ = http_get("/index.html", headers=cookie_header)
    if status == 200 and status_page == 200 and body.get("authenticated") is True and body.get("user", {}).get("studentId") == "6810210432":
        print("  ✅ PASS: Server session confirmed, protected HTML delivered to authenticated client.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Session verification or protected route access failed! (API: {status}, Page: {status_page})")

    # --------------------------------------------------------------------------
    # Test 7: Logout & Server-Side Session Destruction
    # --------------------------------------------------------------------------
    print("\n[Test 7] Logout and Server-Side Session Destruction...")
    status_logout, _, headers_logout = http_post("/api/auth/logout", {}, headers=cookie_header)
    # Attempt to reuse the same session ID
    status_reuse, body_reuse, _ = http_get("/api/auth/session", headers=cookie_header)
    status_page_reuse, _, _ = http_get("/index.html", headers=cookie_header)
    if status_logout == 200 and status_reuse == 401 and status_page_reuse == 302 and body_reuse.get("authenticated") is False:
        print("  ✅ PASS: Session destroyed on server. Re-using old cookie returned 401 on API and 302 on HTML.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Destroyed session was still accepted! (Status: {status_reuse})")

    # --------------------------------------------------------------------------
    # Test 8: Frontend Zero-Secret Inspection
    # --------------------------------------------------------------------------
    print("\n[Test 8] Frontend Zero-Secret Inspection (auth.js & login.html)...")
    with open(os.path.join(WORKSPACE, "assets/js/auth.js"), "r", encoding="utf-8") as f:
        auth_js_content = f.read()
    with open(os.path.join(WORKSPACE, "login.html"), "r", encoding="utf-8") as f:
        login_html_content = f.read()

    forbidden_strings = [
        "AUTH_HASH",
        "ALLOWED_PASS",
        "6f01bf8bb49aeca544df34fc67401dd868d4f4c37da9b013fad4a01ebbcc8b32",
        "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1"
    ]
    leaks = []
    for s in forbidden_strings:
        if s in auth_js_content:
            leaks.append(f"auth.js contains forbidden token: {s}")
        if s in login_html_content:
            leaks.append(f"login.html contains forbidden token: {s}")

    # Also check that auth.js does NOT check sessionStorage for authentication
    if "sessionStorage.getItem(this.STORAGE_KEY)" in auth_js_content or "localStorage.getItem(this.REMEMBER_KEY)" in auth_js_content:
        leaks.append("auth.js still uses client storage to determine authentication!")

    if not leaks:
        print("  ✅ PASS: 100% Zero-Secret & Zero-Client-Trust Frontend verified.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Leaks or client-storage auth detected: {leaks}")

    # --------------------------------------------------------------------------
    # Summary
    # --------------------------------------------------------------------------
    print("\n" + "═" * 70)
    print(f" 🏁  TEST RESULTS: {passed_count}/{total_tests} TESTS PASSED ({passed_count/total_tests*100:.1f}%)")
    print("═" * 70)

    if passed_count == total_tests:
        print(" 🎉 ALL SERVER-SIDE SECURITY CHECKS PASSED PERFECTLY!\n")
        sys.exit(0)
    else:
        print(" ⚠️ SOME TESTS FAILED!\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
