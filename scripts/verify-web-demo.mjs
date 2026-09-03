import { chromium } from "playwright";

const url = process.env.DEMO_URL ?? "http://localhost:1420/?demo=1";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (msg) => {
  if (msg.type() === "error") {
    errors.push(msg.text());
  }
});

try {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.getByRole("button", { name: "追加図.pdf" }).waitFor({ timeout: 20_000 });
  const first = await page.locator("footer").innerText();
  await page.getByRole("button", { name: "追加図.pdf" }).click();
  await page.waitForTimeout(800);
  const after = await page.locator("footer").innerText();
  const selected = await page.getByRole("button", { name: "追加図.pdf" }).getAttribute("class");
  const ok =
    after.includes("図面/追加図.pdf") &&
    selected?.includes("bg-cyan-900") &&
    first.includes("図面/既存図.pdf");
  console.log(
    JSON.stringify(
      {
        ok,
        first,
        after,
        selected,
        errors,
      },
      null,
      2,
    ),
  );
  if (!ok) {
    process.exitCode = 1;
  }
} finally {
  await browser.close();
}
