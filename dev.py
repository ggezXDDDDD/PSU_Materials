#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PSU Materials Portal - Zero-Config Local Development Server
- Serves static files on port 8000 with disabled caching
- Prints clickable localhost and local Wi-Fi LAN URLs for phone testing
- Automatically opens default browser
"""

import sys
import os
import socket
import webbrowser
from http.server import HTTPServer, SimpleHTTPRequestHandler

PORT = 8000
WORKSPACE = os.path.dirname(os.path.abspath(__file__))

def get_lan_ip():
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except Exception:
        return "127.0.0.1"

class NoCacheHTTPRequestHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        # Prevent browser caching during active development
        self.send_header('Cache-Control', 'no-cache, no-store, must-revalidate')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        self.send_header('Access-Control-Allow-Origin', '*')
        super().end_headers()

    def log_message(self, format, *args):
        # Clean logging
        sys.stderr.write(f"\033[90m[{self.log_date_time_string()}]\033[0m {format % args}\n")

def run():
    os.chdir(WORKSPACE)
    lan_ip = get_lan_ip()
    server_address = ('0.0.0.0', PORT)
    
    try:
        httpd = HTTPServer(server_address, NoCacheHTTPRequestHandler)
    except OSError:
        print(f"⚠️ Port {PORT} is busy, trying port {PORT + 1}...")
        httpd = HTTPServer(('0.0.0.0', PORT + 1), NoCacheHTTPRequestHandler)

    port = httpd.server_port
    local_url = f"http://localhost:{port}"
    network_url = f"http://{lan_ip}:{port}"

    print("\n" + "═" * 60)
    print(" 🚀  [1;36mPSU Materials Portal - Local Dev Server[0m")
    print("═" * 60)
    print(f"  💻 [1mLocal URL:[0m    [4;34m{local_url}[0m")
    print(f"  📱 [1mNetwork URL:[0m  [4;32m{network_url}[0m  (เปิดบนมือถือผ่าน Wi-Fi เดียวกัน)")
    print(f"  📂 [1mRoot:[0m         {WORKSPACE}")
    print("═" * 60)
    print("  💡 กด [1mCtrl + C[0m เพื่อหยุดเซิร์ฟเวอร์\n")

    # Auto-open browser
    try:
        webbrowser.open(local_url)
    except Exception:
        pass

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\033[1;33m🛑 เซิร์ฟเวอร์หยุดการทำงานเรียบร้อยแล้ว\033[0m")
        sys.exit(0)

if __name__ == '__main__':
    run()
