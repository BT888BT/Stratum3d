#!/usr/bin/env node

/**
 * Stratum3D — Pre-Launch API Test Suite
 *
 * Tests every API endpoint against your live deployment.
 * Zero dependencies — runs with plain Node.js (v18+).
 *
 * Usage:
 *   SITE_URL=https://stratum3d.vercel.app ADMIN_PASSWORD=yourpass node tests/api-tests.mjs
 *
 * Optional:
 *   TEST_EMAIL=you@email.com   (for order creation)
 */

const SITE = process.env.SITE_URL?.replace(/\/$/, "");
const ADMIN_PASS = process.env.ADMIN_PASSWORD;
const TEST_EMAIL = process.env.TEST_EMAIL || "test@example.com";

if (!SITE) {
  console.error("Set SITE_URL environment variable. Example:");
  console.error("  SITE_URL=https://stratum3d.vercel.app ADMIN_PASSWORD=yourpass node tests/api-tests.mjs");
  process.exit(1);
}

let passed = 0;
let failed = 0;
let skipped = 0;
const failures = [];

function log(icon, msg) {
  console.log(`  ${icon} ${msg}`);
}

async function test(name, fn) {
  try {
    await fn();
    passed++;
    log("✅", name);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    log("❌", `${name} — ${msg}`);
    failures.push({ name, error: msg });
  }
}

function skip(name, reason) {
  skipped++;
  log("⏭️ ", `${name} — skipped: ${reason}`);
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg);
}

async function fetchJson(path, options = {}) {
  const url = `${SITE}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  let body;
  try {
    body = await res.json();
  } catch {
    body = null;
  }
  return { status: res.status, body, headers: res.headers, res };
}

/**
 * Generate a minimal valid binary STL (a single triangle tetrahedron).
 * ~184 bytes, produces a small but non-zero volume.
 */
function makeTestSTL() {
  const buf = Buffer.alloc(84 + 50 * 4); // 4 triangles
  // 80-byte header
  buf.write("Stratum3D test STL", 0);
  // Triangle count
  buf.writeUInt32LE(4, 80);

  const triangles = [
    // Simple tetrahedron — 4 faces
    [[0, 0, 0], [10, 0, 0], [0, 10, 0]],
    [[0, 0, 0], [10, 0, 0], [0, 0, 10]],
    [[0, 0, 0], [0, 10, 0], [0, 0, 10]],
    [[10, 0, 0], [0, 10, 0], [0, 0, 10]],
  ];

  let offset = 84;
  for (const tri of triangles) {
    // Normal (0,0,0 — parser doesn't care)
    buf.writeFloatLE(0, offset); buf.writeFloatLE(0, offset + 4); buf.writeFloatLE(0, offset + 8);
    offset += 12;
    for (const vert of tri) {
      buf.writeFloatLE(vert[0], offset);
      buf.writeFloatLE(vert[1], offset + 4);
      buf.writeFloatLE(vert[2], offset + 8);
      offset += 12;
    }
    buf.writeUInt16LE(0, offset); // attribute byte count
    offset += 2;
  }
  return buf.subarray(0, offset);
}

// ═══════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════

console.log(`\n🧪 Stratum3D API Tests — ${SITE}\n`);

// ─── 1. Pages load ─────────────────────────────────────────────────────────
console.log("─── Pages ───");

await test("Homepage returns 200", async () => {
  const res = await fetch(SITE);
  assert(res.status === 200, `Got ${res.status}`);
});

await test("Quote page returns 200", async () => {
  const res = await fetch(`${SITE}/quote`);
  assert(res.status === 200, `Got ${res.status}`);
});

await test("Login page returns 200", async () => {
  const res = await fetch(`${SITE}/login`);
  assert(res.status === 200, `Got ${res.status}`);
});

await test("Checkout success page returns 200", async () => {
  const res = await fetch(`${SITE}/checkout/success`);
  assert(res.status === 200, `Got ${res.status}`);
});

await test("Checkout cancelled page returns 200", async () => {
  const res = await fetch(`${SITE}/checkout/cancelled`);
  assert(res.status === 200, `Got ${res.status}`);
});

// ─── 2. Security headers (#8) ──────────────────────────────────────────────
console.log("\n─── Security Headers ───");

await test("X-Frame-Options is DENY", async () => {
  const res = await fetch(SITE);
  const val = res.headers.get("x-frame-options");
  assert(val === "DENY", `Got "${val}"`);
});

await test("X-Content-Type-Options is nosniff", async () => {
  const res = await fetch(SITE);
  const val = res.headers.get("x-content-type-options");
  assert(val === "nosniff", `Got "${val}"`);
});

await test("Content-Security-Policy is set", async () => {
  const res = await fetch(SITE);
  const val = res.headers.get("content-security-policy");
  assert(val && val.includes("default-src"), `Missing or invalid CSP: "${val?.slice(0, 50)}"`);
});

await test("Referrer-Policy is set", async () => {
  const res = await fetch(SITE);
  const val = res.headers.get("referrer-policy");
  assert(val && val.length > 0, `Missing Referrer-Policy`);
});

// ─── 3. Public API ─────────────────────────────────────────────────────────
console.log("\n─── Public API ───");

await test("GET /api/colours returns colour array", async () => {
  const { status, body } = await fetchJson("/api/colours");
  assert(status === 200, `Got ${status}`);
  assert(Array.isArray(body), "Response is not an array");
  assert(body.length > 0, "No colours returned");
  assert(body[0].name && body[0].hex, "Missing name/hex fields");
});

// ─── 4. Upload flow ────────────────────────────────────────────────────────
console.log("\n─── Upload Flow ───");

await test("POST /api/upload-url rejects non-STL files (#3)", async () => {
  const { status, body } = await fetchJson("/api/upload-url", {
    method: "POST",
    body: JSON.stringify({ files: [{ name: "virus.exe", size: 1000 }] }),
  });
  assert(status === 400, `Expected 400, got ${status}`);
  assert(body.error.includes(".stl"), `Error doesn't mention STL: "${body.error}"`);
});

await test("POST /api/upload-url rejects empty request", async () => {
  const { status } = await fetchJson("/api/upload-url", {
    method: "POST",
    body: JSON.stringify({ files: [] }),
  });
  assert(status === 400, `Expected 400, got ${status}`);
});

await test("POST /api/upload-url rejects oversized files", async () => {
  const { status } = await fetchJson("/api/upload-url", {
    method: "POST",
    body: JSON.stringify({ files: [{ name: "big.stl", size: 60 * 1024 * 1024 }] }),
  });
  assert(status === 400, `Expected 400, got ${status}`);
});

await test("POST /api/upload-url rejects >10 files", async () => {
  const files = Array.from({ length: 11 }, (_, i) => ({ name: `f${i}.stl`, size: 100 }));
  const { status } = await fetchJson("/api/upload-url", {
    method: "POST",
    body: JSON.stringify({ files }),
  });
  assert(status === 400, `Expected 400, got ${status}`);
});

let testBatchId = null;
let testStoragePath = null;
let testSignedUrl = null;

await test("POST /api/upload-url returns signed URL for valid STL", async () => {
  const { status, body } = await fetchJson("/api/upload-url", {
    method: "POST",
    body: JSON.stringify({ files: [{ name: "test-cube.stl", size: 284 }] }),
  });
  assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
  assert(body.batchId, "Missing batchId");
  assert(body.uploads?.length === 1, "Expected 1 upload entry");
  assert(body.uploads[0].signedUrl, "Missing signedUrl");
  assert(body.uploads[0].storagePath, "Missing storagePath");
  testBatchId = body.batchId;
  testStoragePath = body.uploads[0].storagePath;
  testSignedUrl = body.uploads[0].signedUrl;
});

// ─── 5. Upload actual file + quote ─────────────────────────────────────────
console.log("\n─── Full Quote Flow ───");

let testCheckoutToken = null;
let testOrderId = null;

if (testSignedUrl) {
  await test("Upload STL to signed URL succeeds", async () => {
    const stlData = makeTestSTL();
    const res = await fetch(testSignedUrl, {
      method: "PUT",
      headers: { "Content-Type": "application/octet-stream" },
      body: stlData,
    });
    assert(res.status >= 200 && res.status < 300, `Upload failed with ${res.status}`);
  });

  await test("POST /api/quote with valid batch creates order with checkout token", async () => {
    const { status, body } = await fetchJson("/api/quote", {
      method: "POST",
      body: JSON.stringify({
        customerName: "Test User",
        email: TEST_EMAIL,
        shippingAddressLine1: "123 Test Street",
        shippingAddressLine2: "",
        shippingCity: "Perth",
        shippingState: "WA",
        shippingPostcode: "6000",
        shippingCountry: "AU",
        batchId: testBatchId,
        items: [{
          originalFilename: "test-cube.stl",
          storagePath: testStoragePath,
          material: "PLA",
          colour: "Black",
          quantity: 1,
          layerHeightMm: 0.2,
          infillPercent: 20,
        }],
      }),
    });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert(body.orderId, `Missing orderId: ${JSON.stringify(body)}`);
    assert(body.checkoutToken, `Missing checkoutToken (#6): ${JSON.stringify(body)}`);
    assert(body.totalCents > 0, `Total should be > 0, got ${body.totalCents}`);
    assert(body.subtotalCents > 0, "subtotalCents should be > 0");
    assert(body.gstCents > 0, "gstCents should be > 0");
    assert(body.shippingCents > 0, "shippingCents should be > 0");
    testCheckoutToken = body.checkoutToken;
    testOrderId = body.orderId;
  });

  // ── #2: Batch consumed — can't reuse ──
  await test("POST /api/quote rejects reused batch (#2)", async () => {
    const { status, body } = await fetchJson("/api/quote", {
      method: "POST",
      body: JSON.stringify({
        customerName: "Hacker",
        email: "hacker@test.com",
        shippingAddressLine1: "1 Fake St",
        shippingAddressLine2: "",
        shippingCity: "Perth",
        shippingState: "WA",
        shippingPostcode: "6000",
        shippingCountry: "AU",
        batchId: testBatchId,
        items: [{
          originalFilename: "test-cube.stl",
          storagePath: testStoragePath,
          material: "PLA",
          colour: "Black",
          quantity: 1,
          layerHeightMm: 0.2,
          infillPercent: 20,
        }],
      }),
    });
    assert(status === 400, `Expected 400 for reused batch, got ${status}: ${JSON.stringify(body)}`);
  });

  // ── #1: Tampered volume ignored (server recalculates) ──
  // We can't directly test volume accuracy here, but we verified the quote
  // returns pricing without us sending a volumeMm3 field — server derives it.

  // ── #6: Checkout requires token ──
  await test("POST /api/checkout rejects missing token (#6)", async () => {
    const { status } = await fetchJson("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId: testOrderId }),
    });
    assert(status === 400, `Expected 400 without token, got ${status}`);
  });

  await test("POST /api/checkout rejects wrong token (#6)", async () => {
    const { status } = await fetchJson("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId: testOrderId, checkoutToken: "wrong" }),
    });
    assert(status === 404, `Expected 404 for wrong token, got ${status}`);
  });

  await test("POST /api/checkout accepts correct token (#6)", async () => {
    const { status, body } = await fetchJson("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId: testOrderId, checkoutToken: testCheckoutToken }),
    });
    assert(status === 200, `Expected 200, got ${status}: ${JSON.stringify(body)}`);
    assert(body.url && body.url.includes("stripe.com"), `Expected Stripe URL, got "${body.url}"`);
  });

  await test("POST /api/checkout rejects reused token (one-time use #6)", async () => {
    const { status } = await fetchJson("/api/checkout", {
      method: "POST",
      body: JSON.stringify({ orderId: testOrderId, checkoutToken: testCheckoutToken }),
    });
    assert(status === 400 || status === 404, `Expected 400/404 for reused token, got ${status}`);
  });
} else {
  skip("Full quote flow", "Upload URL generation failed");
}

// ─── 6. Quote validation ───────────────────────────────────────────────────
console.log("\n─── Quote Validation ───");

await test("POST /api/quote rejects fake batchId (#2)", async () => {
  const { status } = await fetchJson("/api/quote", {
    method: "POST",
    body: JSON.stringify({
      customerName: "Test",
      email: "test@test.com",
      shippingAddressLine1: "1 St",
      shippingCity: "Perth",
      shippingState: "WA",
      shippingPostcode: "6000",
      shippingCountry: "AU",
      batchId: "00000000-0000-0000-0000-000000000000",
      items: [{ originalFilename: "fake.stl", storagePath: "pending/fake/fake.stl", material: "PLA", colour: "Black", quantity: 1, layerHeightMm: 0.2, infillPercent: 20 }],
    }),
  });
  assert(status === 400, `Expected 400 for fake batch, got ${status}`);
});

await test("POST /api/quote rejects invalid postcode", async () => {
  const { status } = await fetchJson("/api/quote", {
    method: "POST",
    body: JSON.stringify({
      customerName: "Test",
      email: "t@t.com",
      shippingAddressLine1: "1 St",
      shippingCity: "Perth",
      shippingState: "WA",
      shippingPostcode: "999",
      shippingCountry: "AU",
      batchId: "x",
      items: [],
    }),
  });
  assert(status === 400, `Expected 400 for bad postcode, got ${status}`);
});

await test("POST /api/quote rejects empty items", async () => {
  const { status } = await fetchJson("/api/quote", {
    method: "POST",
    body: JSON.stringify({
      customerName: "Test",
      email: "t@t.com",
      shippingAddressLine1: "1 Street",
      shippingCity: "Perth",
      shippingState: "WA",
      shippingPostcode: "6000",
      shippingCountry: "AU",
      batchId: "x",
      items: [],
    }),
  });
  assert(status === 400, `Expected 400, got ${status}`);
});

// ─── 7. Admin auth ─────────────────────────────────────────────────────────
console.log("\n─── Admin Auth ───");

await test("Admin pages redirect without cookie", async () => {
  const res = await fetch(`${SITE}/admin/orders`, { redirect: "manual" });
  assert(res.status === 307 || res.status === 302, `Expected redirect, got ${res.status}`);
});

await test("Admin API returns 401 without cookie", async () => {
  const { status } = await fetchJson("/api/admin/colours", {
    method: "POST",
    body: JSON.stringify({ name: "Hacked", hex: "#000" }),
  });
  assert(status === 401, `Expected 401, got ${status}`);
});

await test("POST /api/admin/login rejects wrong password", async () => {
  const { status } = await fetchJson("/api/admin/login", {
    method: "POST",
    body: JSON.stringify({ password: "wrong-password-123" }),
  });
  assert(status === 401, `Expected 401, got ${status}`);
});

let adminCookie = null;

if (ADMIN_PASS) {
  await test("POST /api/admin/login accepts correct password (#4)", async () => {
    const res = await fetch(`${SITE}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: ADMIN_PASS }),
    });
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    const setCookie = res.headers.get("set-cookie");
    assert(setCookie && setCookie.includes("stratum3d_admin="), "No session cookie set");
    // Extract cookie value
    const match = setCookie.match(/stratum3d_admin=([a-f0-9]{64})/);
    assert(match, `Cookie not a 64-char hex token (#4): ${setCookie.slice(0, 80)}`);
    adminCookie = `stratum3d_admin=${match[1]}`;
  });

  if (adminCookie) {
    await test("Admin API works with valid session cookie", async () => {
      const { status, body } = await fetchJson("/api/admin/colours", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: `Test-${Date.now()}`, hex: "#ff0000" }),
      });
      // Might get 200 or fail for duplicate name — both prove auth worked
      assert(status === 200 || status === 500, `Expected 200/500 (auth passed), got ${status}: ${JSON.stringify(body)}`);
    });

    await test("Admin orders page loads with session", async () => {
      const res = await fetch(`${SITE}/admin/orders`, {
        headers: { Cookie: adminCookie },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);
    });

    await test("POST /api/admin/logout revokes session (#4)", async () => {
      const res = await fetch(`${SITE}/api/admin/logout`, {
        method: "POST",
        headers: { Cookie: adminCookie },
      });
      assert(res.status === 200, `Expected 200, got ${res.status}`);

      // Verify cookie no longer works
      const { status } = await fetchJson("/api/admin/colours", {
        method: "POST",
        headers: { Cookie: adminCookie },
        body: JSON.stringify({ name: "ShouldFail", hex: "#000" }),
      });
      assert(status === 401, `Session still valid after logout — got ${status} instead of 401`);
    });
  }
} else {
  skip("Admin login flow", "Set ADMIN_PASSWORD env var to test");
}

// ─── 8. CSRF protection (#7) ───────────────────────────────────────────────
console.log("\n─── CSRF Protection ───");

if (ADMIN_PASS) {
  // Get a fresh session for CSRF tests
  const loginRes = await fetch(`${SITE}/api/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: ADMIN_PASS }),
  });
  const csrfCookie = loginRes.headers.get("set-cookie")?.match(/stratum3d_admin=[a-f0-9]{64}/)?.[0];

  if (csrfCookie) {
    await test("Admin API rejects requests from wrong origin (#7)", async () => {
      const res = await fetch(`${SITE}/api/admin/colours`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Cookie: csrfCookie,
          Origin: "https://evil-site.com",
        },
        body: JSON.stringify({ name: "CSRF", hex: "#000" }),
      });
      assert(res.status === 403, `Expected 403 for wrong origin, got ${res.status}`);
    });

    // Clean up session
    await fetch(`${SITE}/api/admin/logout`, {
      method: "POST",
      headers: { Cookie: csrfCookie },
    });
  }
} else {
  skip("CSRF tests", "Set ADMIN_PASSWORD env var to test");
}

// ─── Results ───────────────────────────────────────────────────────────────
console.log("\n═══════════════════════════════════════════");
console.log(`  ✅ Passed: ${passed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  ⏭️  Skipped: ${skipped}`);
console.log("═══════════════════════════════════════════");

if (failures.length) {
  console.log("\nFailures:");
  for (const f of failures) {
    console.log(`  • ${f.name}`);
    console.log(`    ${f.error}\n`);
  }
}

process.exit(failed > 0 ? 1 : 0);
