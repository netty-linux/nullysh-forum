/**
 * Design audit screenshots (before/after).
 * Usage: node scripts/design-audit.mjs [before|after]
 */
import { chromium } from "playwright";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const phase = process.argv[2] === "after" ? "after" : "before";
const outDir = path.join(root, "design-audit", phase);
const BASE = process.env.AUDIT_BASE || "http://localhost:3000";

const pages = [
  { slug: "feed", path: "/app" },
  { slug: "populares", path: "/app/populares" },
  { slug: "saved", path: "/app/saved" },
  { slug: "trails", path: "/app/trails" },
  { slug: "mentorship", path: "/app/mentorship" },
  { slug: "events", path: "/app/events" },
  { slug: "communities", path: "/app/communities" },
  { slug: "videos", path: "/app/videos" },
  { slug: "materials", path: "/app/materials" },
  { slug: "chat", path: "/app/chat" },
  { slug: "profile", path: "/app/profile" },
  { slug: "admin", path: "/app/admin" },
  { slug: "login", path: "/login" },
];

const viewports = {
  desktop: { width: 1440, height: 900 },
  mobile: { width: 390, height: 844 },
};

const seedAuth = {
  state: {
    users: [
      {
        id: "admin",
        name: "Nullysh",
        email: "admin@nullysh.com",
        password: "admin123",
        bio: "Fundador da comunidade Nullysh.",
        avatar: "N",
        avatarUrl: null,
        bannerUrl: null,
        bannerFit: null,
        avatarFrame: "nullysh",
        role: "admin",
        isVip: true,
        isVerified: true,
        interests: ["IA", "Negócios Digitais"],
        goals: [],
        seekingMentorship: false,
        offeringMentorship: true,
        mentorTopics: ["IA"],
        links: [],
        favoriteTracks: [],
        badgesUnlocked: [],
        badgeEquipped: null,
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ],
    currentUserId: "admin",
  },
  version: 0,
};

async function setTheme(page, theme) {
  await page.evaluate((t) => {
    localStorage.setItem("nullysh-theme", t);
    const root = document.documentElement;
    if (t === "dark") {
      root.classList.add("dark");
      root.setAttribute("data-theme", "dark");
      root.style.colorScheme = "dark";
    } else {
      root.classList.remove("dark");
      root.setAttribute("data-theme", "light");
      root.style.colorScheme = "light";
    }
  }, theme);
}

async function ensureAuth(page) {
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.evaluate((auth) => {
    localStorage.setItem("nullysh-auth", JSON.stringify(auth));
  }, seedAuth);
  // Try UI login for local seed mode
  try {
    await page.fill('input[name="email"]', "admin@nullysh.com", { timeout: 3000 });
    await page.fill('input[name="password"]', "admin123");
    await page.click('button[type="submit"]');
    await page.waitForURL("**/app**", { timeout: 8000 }).catch(() => {});
  } catch {
    /* storage injection fallback */
  }
  await page.goto(`${BASE}/app`, { waitUntil: "domcontentloaded", timeout: 30000 });
  await page.waitForTimeout(600);
}

async function main() {
  await mkdir(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];

  for (const [vpName, viewport] of Object.entries(viewports)) {
    for (const theme of ["light", "dark"]) {
      const context = await browser.newContext({
        viewport,
        deviceScaleFactor: vpName === "mobile" ? 2 : 1,
        colorScheme: theme,
      });
      await context.addInitScript((auth) => {
        try {
          localStorage.setItem("nullysh-auth", JSON.stringify(auth));
          localStorage.setItem("nullysh-theme", "light");
        } catch {}
      }, seedAuth);

      const page = await context.newPage();
      page.setDefaultTimeout(25000);

      await ensureAuth(page);
      await setTheme(page, theme);
      await page.reload({ waitUntil: "domcontentloaded" });
      await setTheme(page, theme);
      await page.waitForTimeout(400);

      for (const p of pages) {
        const label = `${p.slug}_${theme}_${vpName}`;
        try {
          await page.goto(`${BASE}${p.path}`, {
            waitUntil: "domcontentloaded",
            timeout: 30000,
          });
          await setTheme(page, theme);
          await page.waitForTimeout(350);
          if (page.url().includes("/login") && p.slug !== "login") {
            await page.evaluate((auth) => {
              localStorage.setItem("nullysh-auth", JSON.stringify(auth));
            }, seedAuth);
            await page.goto(`${BASE}${p.path}`, {
              waitUntil: "domcontentloaded",
              timeout: 30000,
            });
            await setTheme(page, theme);
            await page.waitForTimeout(400);
          }
          const file = path.join(outDir, `${label}.png`);
          await page.screenshot({ path: file, fullPage: false });
          results.push({ label, ok: true, file });
          console.log("OK", label);
        } catch (err) {
          results.push({ label, ok: false, error: String(err?.message || err) });
          console.error("FAIL", label, err?.message || err);
        }
      }

      await context.close();
    }
  }

  await writeFile(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ phase, base: BASE, at: new Date().toISOString(), results }, null, 2)
  );
  await browser.close();
  const fails = results.filter((r) => !r.ok).length;
  console.log(`\nDone ${phase}: ${results.length - fails}/${results.length} ok → ${outDir}`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
