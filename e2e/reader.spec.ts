import { expect, test } from "@playwright/test";
import { strToU8, zipSync, type Zippable } from "fflate";

const COVER_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZVZsAAAAASUVORK5CYII=",
    "base64",
  ),
);

function createTestEpub(): Buffer {
  const paragraphs = Array.from(
    { length: 80 },
    (_, index) =>
      `<p>第 ${index + 1} 段：柿子阅读器正在验证分页、目录、资源和断点续读。</p>`,
  ).join("");
  const entries: Zippable = {
    mimetype: [strToU8("application/epub+zip"), { level: 0 }],
    "META-INF/container.xml": strToU8(`<?xml version="1.0"?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles>
          <rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/>
        </rootfiles>
      </container>`),
    "EPUB/package.opf": strToU8(`<?xml version="1.0"?>
      <package xmlns="http://www.idpf.org/2007/opf" version="3.0">
        <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
          <dc:identifier>urn:persimmon:e2e</dc:identifier>
          <dc:title>E2E 柿子书</dc:title>
          <dc:creator>Persimmon Tests</dc:creator>
          <dc:language>zh-CN</dc:language>
        </metadata>
        <manifest>
          <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
          <item id="cover" href="cover.png" media-type="image/png" properties="cover-image"/>
          <item id="style" href="book.css" media-type="text/css"/>
          <item id="one" href="one.xhtml" media-type="application/xhtml+xml"/>
          <item id="two" href="two.xhtml" media-type="application/xhtml+xml"/>
        </manifest>
        <spine>
          <itemref idref="one"/>
          <itemref idref="two"/>
        </spine>
      </package>`),
    "EPUB/nav.xhtml": strToU8(`<?xml version="1.0"?>
      <html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
        <body><nav epub:type="toc"><ol>
          <li><a href="one.xhtml#opening">第一章</a></li>
          <li><a href="two.xhtml#second">第二章</a></li>
        </ol></nav></body>
      </html>`),
    "EPUB/book.css": strToU8(`
      h1 { text-align: center; margin-bottom: 2em; }
      p { text-align: justify; }
      .hidden { display: none; }
    `),
    "EPUB/one.xhtml": strToU8(`<?xml version="1.0"?>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head><link rel="stylesheet" href="book.css"/></head>
        <body>
          <h1 id="opening">第一章</h1>
          <p class="hidden">这段内容必须被安全样式层过滤。</p>
          <img src="cover.png" alt="测试插图"/>
          ${paragraphs}
        </body>
      </html>`),
    "EPUB/two.xhtml": strToU8(`<?xml version="1.0"?>
      <html xmlns="http://www.w3.org/1999/xhtml">
        <head><link rel="stylesheet" href="book.css"/></head>
        <body><h1 id="second">第二章</h1><p>目录跳转成功。</p></body>
      </html>`),
    "EPUB/cover.png": COVER_PNG,
  };
  return Buffer.from(zipSync(entries));
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    localStorage.clear();
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase("persimmon-library");
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
      request.onblocked = () => resolve();
    });
  });
  await page.reload();
});

test("imports, reads, navigates, resumes, and deletes a local EPUB", async ({
  page,
}) => {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入 EPUB" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "persimmon-e2e.epub",
    mimeType: "application/epub+zip",
    buffer: createTestEpub(),
  });

  await expect(page.getByRole("button", { name: "下一页" })).toBeVisible();
  await expect(page.getByLabel(/本章第 1 页/)).toBeVisible();

  await page.getByRole("button", { name: "下一页" }).click();
  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByLabel(/本章第 3 页/)).toBeVisible({
    timeout: 10_000,
  });

  const pageStatus = page.locator('[aria-label^="本章第 "]');
  await page.getByRole("button", { name: "上一页" }).click();
  await expect(page.getByLabel(/本章第 2 页/)).toBeVisible({
    timeout: 10_000,
  });

  const statusBeforeDrag = await pageStatus.getAttribute("aria-label");
  const nextPageButton = page.getByRole("button", { name: "下一页" });
  const nextPageBounds = await nextPageButton.boundingBox();
  expect(nextPageBounds).not.toBeNull();
  if (!nextPageBounds) {
    throw new Error("Next-page hit target has no layout bounds.");
  }
  const dragStartX = nextPageBounds.x + nextPageBounds.width * 0.8;
  const dragY = nextPageBounds.y + nextPageBounds.height * 0.55;
  await page.mouse.move(dragStartX, dragY);
  await page.mouse.down();
  await page.mouse.move(12, dragY - 48, {
    steps: 24,
  });
  await page.mouse.up();
  await expect
    .poll(() => pageStatus.getAttribute("aria-label"), { timeout: 10_000 })
    .not.toBe(statusBeforeDrag);

  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await page.getByRole("button", { name: "打开目录" }).click();
  await page.getByRole("button", { name: "跳转到 第二章" }).click();
  await expect(page.getByLabel(/全书 100%/)).toBeVisible({
    timeout: 10_000,
  });

  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "返回书架" }).click();
  await expect(
    page.getByRole("button", { name: "打开 E2E 柿子书" }),
  ).toBeVisible();
  await expect(page.getByLabel("E2E 柿子书 封面")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "打开 E2E 柿子书" }).click();
  await expect(page.getByLabel(/全书 100%/)).toBeVisible({
    timeout: 10_000,
  });

  await page.getByRole("button", { name: "返回书架" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "删除 E2E 柿子书" }).click();
  await expect(
    page.getByRole("button", { name: "打开 E2E 柿子书" }),
  ).toHaveCount(0);
});

test("persists a two-page layout and hides floating controls while turning", async ({
  page,
}) => {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入 EPUB" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "persimmon-spread-e2e.epub",
    mimeType: "application/epub+zip",
    buffer: createTestEpub(),
  });

  await page.getByRole("button", { name: "切换到双页布局" }).click();
  await expect(
    page.getByRole("button", { name: "切换到单页布局" }),
  ).toBeVisible();

  await page.getByRole("button", { name: "下一页" }).click();
  await expect(page.getByRole("button", { name: "返回书架" })).toHaveCount(0);
  await expect(page.getByLabel(/本章第 3–4 页/)).toBeVisible({
    // Headless Chromium's software CanvasKit backend can need several slow
    // rAFs after the preceding WebGL-heavy test; the turn still follows wall
    // clock time and completes as soon as those frames are delivered.
    timeout: 30_000,
  });
  await expect(page.getByRole("button", { name: "返回书架" })).toHaveCount(0);
  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await expect(page.getByRole("button", { name: "返回书架" })).toBeVisible();

  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.getByRole("button", { name: "打开 E2E 柿子书" }).click();
  await expect(
    page.getByRole("button", { name: "切换到单页布局" }),
  ).toBeVisible();
});
