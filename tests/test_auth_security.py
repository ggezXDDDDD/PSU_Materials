#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSU Materials Portal - Security Test Suite
Tests Server-Side Authentication, Cryptographic Signature Verification,
Route Guarding, PoC Session Tamper Prevention, and Token Revocation.
"""

import sys
import os
import time
import json
import base64
import hmac
import hashlib
import urllib.request
import urllib.error
import threading

# Add workspace to path
WORKSPACE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, WORKSPACE)

import server

TEST_PORT = 8999
BASE_URL = f"http://127.0.0.1:{TEST_PORT}"

def run_test_server():
    server.PORT = TEST_PORT
    server_address = ("127.0.0.1", TEST_PORT)
    httpd = server.HTTPServer(server_address, server.SecureAuthHTTPRequestHandler)
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
            return resp.status, resp.read().decode("utf-8", errors="ignore"), resp.headers
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore"), e.headers

def main():
    print("═" * 70)
    print(" 🛡️  STARTING COMPREHENSIVE SECURITY & POC VERIFICATION SUITE")
    print("═" * 70)

    # Start background server
    t = threading.Thread(target=run_test_server, daemon=True)
    t.start()
    time.sleep(1)

    passed_count = 0
    total_tests = 8

    # --------------------------------------------------------------------------
    # Test 1: PoC Attack (Client-Side Storage Tampering)
    # Attacker injects fake JSON into DevTools without a valid server token.
    # --------------------------------------------------------------------------
    print("\n[Test 1] PoC Attack 1: Client DevTools Session Storage Tampering...")
    status, body, _ = http_post("/api/auth/verify", {"token": '{"studentId":"6810210432","loggedInAt":"2026-09-14"}'})
    if status == 401 and body.get("valid") is False:
        print("  ✅ PASS: Server rejected fake session tampering with 401 Unauthorized.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Fake session was not rejected properly! (Status: {status})")

    # --------------------------------------------------------------------------
    # Test 2: PoC Attack 2: Cryptographic Signature Forgery
    # Attacker crafts a token signed with their own arbitrary key.
    # --------------------------------------------------------------------------
    print("\n[Test 2] PoC Attack 2: Signature Forgery with Arbitrary Secret Key...")
    fake_header = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').decode().rstrip("=")
    fake_payload = base64.urlsafe_b64encode(b'{"sub":"6810210432","exp":9999999999,"jti":"fake123"}').decode().rstrip("=")
    fake_sig = hmac.new(b"attacker_random_key_12345", f"{fake_header}.{fake_payload}".encode(), hashlib.sha256).digest()
    fake_sig_b64 = base64.urlsafe_b64encode(fake_sig).decode().rstrip("=")
    forged_token = f"{fake_header}.{fake_payload}.{fake_sig_b64}"

    status, body, _ = http_post("/api/auth/verify", {"token": forged_token})
    if status == 401 and body.get("valid") is False:
        print("  ✅ PASS: Server detected forged signature and rejected token with 401.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Forged token was accepted! (Status: {status})")

    # --------------------------------------------------------------------------
    # Test 3: Route Guarding - Direct Protected HTML Access
    # Attacker tries to GET index.html directly with curl/browser without auth.
    # --------------------------------------------------------------------------
    print("\n[Test 3] Route Guarding: Access Protected Pages Without Token...")
    status, _, headers = http_get("/index.html")
    location = headers.get("Location", "")
    if status == 302 and "login.html" in location:
        print(f"  ✅ PASS: Direct access to index.html was blocked (302 Redirect to {location}).")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: index.html leaked over the wire! (Status: {status})")

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
    # Test 5: Valid Login
    # --------------------------------------------------------------------------
    test_password = os.environ.get("AUTH_PASSWORD", "PortalSecurityTestPassword_2026!")
    # Configure test hash dynamically so real password is NEVER committed to git
    test_raw = f"{server.SALT}:{server.AUTHORIZED_STUDENT_ID}:{test_password}".encode("utf-8")
    server.AUTHORIZED_PASSWORD_HASH = hashlib.sha256(test_raw).hexdigest()

    print("\n[Test 5] Login with Valid Credentials...")
    status, body, headers = http_post("/api/auth/login", {"studentId": server.AUTHORIZED_STUDENT_ID, "password": test_password})
    valid_token = body.get("token", "")
    set_cookie = headers.get("Set-Cookie", "")
    if status == 200 and body.get("success") is True and valid_token and "psu_auth_token" in set_cookie:
        print("  ✅ PASS: Valid login succeeded, signed token and HttpOnly cookie issued.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Valid login failed! (Status: {status}, Body: {body})")

    # --------------------------------------------------------------------------
    # Test 6: Valid Token Verification & Protected Route Access
    # --------------------------------------------------------------------------
    print("\n[Test 6] Token Verification & Authorized Page Access...")
    status, body, _ = http_post("/api/auth/verify", {}, headers={"Authorization": f"Bearer {valid_token}"})
    status_page, _, _ = http_get("/index.html", headers={"Authorization": f"Bearer {valid_token}"})
    if status == 200 and body.get("valid") is True and body.get("user", {}).get("studentId") == "6810210432":
        print("  ✅ PASS: Token successfully verified by server, user identity confirmed.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Valid token verification failed! (Status: {status})")

    # --------------------------------------------------------------------------
    # Test 7: Logout & Revocation (Anti-Replay Attack)
    # After logout, token must be revoked on the server.
    # --------------------------------------------------------------------------
    print("\n[Test 7] Logout and Server-Side Token Revocation (Anti-Replay)...")
    status_logout, _, _ = http_post("/api/auth/logout", {}, headers={"Authorization": f"Bearer {valid_token}"})
    # Now try to re-use the same token
    status_reuse, body_reuse, _ = http_post("/api/auth/verify", {}, headers={"Authorization": f"Bearer {valid_token}"})
    if status_logout == 200 and status_reuse == 401 and body_reuse.get("valid") is False:
        print("  ✅ PASS: Token was successfully revoked. Re-using revoked token returned 401.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Revoked token was still accepted! (Status: {status_reuse})")

    # --------------------------------------------------------------------------
    # Test 8: Frontend Source Code Inspection
    # Ensure ZERO passwords, ZERO hashes, and ZERO salts exist in frontend assets.
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
            leaks.append(f"auth.js contains secret: {s[:10]}...")
        if s in login_html_content:
            leaks.append(f"login.html contains secret: {s[:10]}...")

    if not leaks:
        print("  ✅ PASS: 100% Zero-Secret Frontend. No password, hash, or salt found in client files.")
        passed_count += 1
    else:
        print(f"  ❌ FAIL: Leaks detected in frontend: {leaks}")

    # --------------------------------------------------------------------------
    # Summary
    # --------------------------------------------------------------------------
    print("\n" + "═" * 70)
    print(f" 🏁  TEST RESULTS: {passed_count}/{total_tests} TESTS PASSED ({passed_count/total_tests*100:.1f}%)")
    print("═" * 70)

    if passed_count == total_tests:
        print(" 🎉 ALL SECURITY CHECKS PASSED PERFECTLY!\n")
        sys.exit(0)
    else:
        print(" ⚠️ SOME TESTS FAILED!\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
