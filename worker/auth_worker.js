/**
 * PSU Materials Portal - Cloudflare Worker Serverless Authentication Backend
 * Deployable to Cloudflare Workers for 100% free serverless backend when using GitHub Pages
 *
 * Endpoints:
 * - POST /api/auth/login
 * - POST /api/auth/verify
 * - POST /api/auth/logout
 *
 * Environment Secrets required in Cloudflare Worker:
 * - PORTAL_SECRET_KEY: A long random secret string (e.g. 64 hex characters)
 * - AUTH_STUDENT_ID: "6810210432"
 * - AUTH_SALT: "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1"
 * - AUTH_PASSWORD_HASH: "6f01bf8bb49aeca544df34fc67401dd868d4f4c37da9b013fad4a01ebbcc8b32"
 */

const DEFAULT_SECRET = "PSU_PORTAL_FALLBACK_KEY_CHANGE_IN_CF_ENV_V1";
const DEFAULT_STUDENT_ID = "6810210432";
const DEFAULT_SALT = "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1";
const DEFAULT_PASSWORD_HASH = "6f01bf8bb49aeca544df34fc67401dd868d4f4c37da9b013fad4a01ebbcc8b32";

// In-memory revocation set (or use Cloudflare KV for persistent revocation)
const REVOKED_JTIS = new Set();

function b64urlEncode(buf) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getHmacKey(secret) {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

async function createToken(studentId, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: studentId,
    name: "Kongpop",
    iat: now,
    exp: now + 7 * 86400,
    jti: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2)
  };

  const enc = new TextEncoder();
  const hStr = b64urlEncode(enc.encode(JSON.stringify(header)));
  const pStr = b64urlEncode(enc.encode(JSON.stringify(payload)));
  const data = enc.encode(`${hStr}.${pStr}`);

  const key = await getHmacKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const sigStr = b64urlEncode(sig);

  return `${hStr}.${pStr}.${sigStr}`;
}

async function verifyToken(token, secret, studentId) {
  if (!token || typeof token !== "string") return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  try {
    const enc = new TextEncoder();
    const data = enc.encode(`${parts[0]}.${parts[1]}`);
    const key = await getHmacKey(secret);
    const sig = b64urlDecode(parts[2]);

    const isValidSig = await crypto.subtle.verify("HMAC", key, sig, data);
    if (!isValidSig) return null;

    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) return null;
    if (REVOKED_JTIS.has(payload.jti)) return null;

    const cleanSub = String(payload.sub || "").trim().toLowerCase().replace(/^s/, "");
    if (cleanSub !== studentId) return null;

    return payload;
  } catch (e) {
    return null;
  }
}

async function checkPassword(user, pass, salt, expectedHash) {
  const cleanUser = String(user || "").trim().toLowerCase().replace(/@.*$/, "").replace(/^s/, "");
  const cleanPass = String(pass || "").trim();
  const raw = `${salt}:${cleanUser}:${cleanPass}`;
  const enc = new TextEncoder();
  const hashBuf = await crypto.subtle.digest("SHA-256", enc.encode(raw));
  const hex = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  return hex === expectedHash;
}

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Cache-Control": "no-store, no-cache, must-revalidate"
    }
  });
}

export default {
  async fetch(request, env) {
    const secret = env.PORTAL_SECRET_KEY || DEFAULT_SECRET;
    const studentId = env.AUTH_STUDENT_ID || DEFAULT_STUDENT_ID;
    const salt = env.AUTH_SALT || DEFAULT_SALT;
    const expectedHash = env.AUTH_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;

    const url = new URL(request.url);

    // Handle CORS pre-flight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    if (request.method === "POST") {
      let body = {};
      try {
        body = await request.json();
      } catch (e) {}

      // 1. POST /api/auth/login
      if (url.pathname === "/api/auth/login") {
        const u = body.studentId;
        const p = body.password;
        const isOk = await checkPassword(u, p, salt, expectedHash);
        if (isOk) {
          const token = await createToken(studentId, secret);
          return jsonResponse({
            success: true,
            token,
            user: { studentId, studentName: "Kongpop" }
          });
        }
        return jsonResponse({ success: false, message: "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง" }, 401);
      }

      // 2. POST /api/auth/verify
      if (url.pathname === "/api/auth/verify") {
        let token = "";
        const authH = request.headers.get("Authorization");
        if (authH && authH.startsWith("Bearer ")) {
          token = authH.substring(7).trim();
        } else if (body.token) {
          token = body.token;
        }

        const payload = await verifyToken(token, secret, studentId);
        if (payload) {
          return jsonResponse({
            success: true,
            valid: true,
            user: { studentId: payload.sub, studentName: payload.name }
          });
        }
        return jsonResponse({ success: false, valid: false, message: "Session ไม่ถูกต้องหรือหมดอายุ" }, 401);
      }

      // 3. POST /api/auth/logout
      if (url.pathname === "/api/auth/logout") {
        let token = "";
        const authH = request.headers.get("Authorization");
        if (authH && authH.startsWith("Bearer ")) token = authH.substring(7).trim();
        else if (body.token) token = body.token;

        if (token) {
          try {
            const parts = token.split(".");
            if (parts.length === 3) {
              const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
              if (payload.jti) REVOKED_JTIS.add(payload.jti);
            }
          } catch (e) {}
        }
        return jsonResponse({ success: true, message: "ออกจากระบบเรียบร้อยแล้ว" });
      }
    }

    return jsonResponse({ error: "Not Found" }, 404);
  }
};
