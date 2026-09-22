/**
 * PSU Materials Portal - Cloudflare Worker Serverless Authentication Backend
 * Deployable to Cloudflare Workers for 100% free serverless backend with HttpOnly cookies
 *
 * Endpoints:
 * - POST /api/auth/login   -> Sets HttpOnly; SameSite=Lax; Secure cookie
 * - GET  /api/auth/session -> Validates session cookie
 * - POST /api/auth/logout  -> Invalidates session cookie
 *
 * Environment Secrets required in Cloudflare Worker:
 * - PORTAL_SECRET_KEY: A long random secret string (e.g. 64 hex characters)
 * - AUTH_STUDENT_ID: "6810210432"
 * - AUTH_SALT: "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1"
 * - AUTH_PASSWORD_HASH: "e5b252c70a0b4176f1356e4576f2dee839c7cf702a59a3b06ff8bc2bba618a22"
 */

const DEFAULT_SECRET = "PSU_PORTAL_FALLBACK_KEY_CHANGE_IN_CF_ENV_V1";
const DEFAULT_STUDENT_ID = "6810210432";
const DEFAULT_SALT = "PSU_MATERIALS_PORTAL_SALT_2026_SECURE_V1";
const DEFAULT_PASSWORD_HASH = "e5b252c70a0b4176f1356e4576f2dee839c7cf702a59a3b06ff8bc2bba618a22";
const COOKIE_NAME = "psu_session";
const SESSION_TTL = 7 * 86400; // 7 days

// In-memory revocation set (or Cloudflare KV)
const REVOKED_SESSIONS = new Set();

function b64urlEncode(buf) {
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.byteLength; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function b64urlDecode(str) {
  str = str.replace(/-/g, "+").replace(/_/g, "/");
  while (str.length % 4) str += "=";
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
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

async function createSessionId(studentId, secret) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    sub: studentId,
    name: "Kongpop",
    iat: now,
    exp: now + SESSION_TTL,
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

async function verifySessionId(sessionId, secret, expectedStudentId) {
  if (!sessionId || typeof sessionId !== "string") return null;
  const parts = sessionId.split(".");
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
    if (REVOKED_SESSIONS.has(payload.jti)) return null;

    const cleanSub = String(payload.sub || "").trim().toLowerCase().replace(/^s/, "");
    if (cleanSub !== expectedStudentId) return null;

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

function parseCookies(cookieHeader) {
  const list = {};
  if (!cookieHeader) return list;
  cookieHeader.split(";").forEach((cookie) => {
    let [name, ...rest] = cookie.split("=");
    name = name?.trim();
    if (!name) return;
    const value = rest.join("=").trim();
    list[name] = decodeURIComponent(value);
  });
  return list;
}

function jsonResponse(data, status = 200, origin = "*", setCookie = null, clearCookie = false) {
  const headers = new Headers({
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Cache-Control": "no-store, no-cache, must-revalidate"
  });

  if (setCookie) {
    headers.append("Set-Cookie", `${COOKIE_NAME}=${setCookie}; Max-Age=${SESSION_TTL}; Path=/; HttpOnly; SameSite=Lax; Secure`);
  } else if (clearCookie) {
    headers.append("Set-Cookie", `${COOKIE_NAME}=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax; Secure`);
  }

  return new Response(JSON.stringify(data), { status, headers });
}

export default {
  async fetch(request, env) {
    const secret = env.PORTAL_SECRET_KEY || DEFAULT_SECRET;
    const studentId = env.AUTH_STUDENT_ID || DEFAULT_STUDENT_ID;
    const salt = env.AUTH_SALT || DEFAULT_SALT;
    const expectedHash = env.AUTH_PASSWORD_HASH || DEFAULT_PASSWORD_HASH;

    const origin = request.headers.get("Origin") || "*";
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400"
        }
      });
    }

    const cookies = parseCookies(request.headers.get("Cookie"));
    const currentSessionId = cookies[COOKIE_NAME];

    // 1. POST /api/auth/login
    if (request.method === "POST" && url.pathname === "/api/auth/login") {
      let body = {};
      try { body = await request.json(); } catch (e) {}

      const isOk = await checkPassword(body.studentId, body.password, salt, expectedHash);
      if (isOk) {
        const sid = await createSessionId(studentId, secret);
        return jsonResponse({
          success: true,
          user: { studentId, studentName: "Kongpop" }
        }, 200, origin, sid);
      }
      return jsonResponse({ success: false, message: "รหัสนักศึกษาหรือรหัสผ่านไม่ถูกต้อง" }, 401, origin);
    }

    // 2. GET /api/auth/session
    if ((request.method === "GET" || request.method === "POST") && (url.pathname === "/api/auth/session" || url.pathname === "/api/auth/verify")) {
      const payload = await verifySessionId(currentSessionId, secret, studentId);
      if (payload) {
        return jsonResponse({
          success: true,
          authenticated: true,
          user: { studentId: payload.sub, studentName: payload.name }
        }, 200, origin);
      }
      return jsonResponse({ success: false, authenticated: false, message: "Session ไม่ถูกต้องหรือหมดอายุ" }, 401, origin, null, true);
    }

    // 3. POST /api/auth/logout
    if (request.method === "POST" && url.pathname === "/api/auth/logout") {
      if (currentSessionId) {
        try {
          const parts = currentSessionId.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
            if (payload.jti) REVOKED_SESSIONS.add(payload.jti);
          }
        } catch (e) {}
      }
      return jsonResponse({ success: true, message: "ออกจากระบบเรียบร้อยแล้ว" }, 200, origin, null, true);
    }

    return jsonResponse({ error: "Not Found" }, 404, origin);
  }
};
