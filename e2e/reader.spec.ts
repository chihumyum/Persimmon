import { expect, test, type Page } from "@playwright/test";
import { strToU8, zipSync, type Zippable } from "fflate";

const COVER_PNG = Uint8Array.from(
  Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9ZVZsAAAAASUVORK5CYII=",
    "base64",
  ),
);
const IS_CI = Boolean(process.env.CI);

function createTestEpub(): Buffer {
  const paragraphs = Array.from(
    { length: 64 },
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
          <li>
            <a href="one.xhtml#opening">第一部：这是一个用于验证工具栏长目录轮换效果的非常非常长的章节标题</a>
            <ol><li><a href="one.xhtml#opening">第一章</a></li></ol>
          </li>
          <li><a href="two.xhtml#second">第二章</a></li>
        </ol></nav></body>
      </html>`),
    "EPUB/book.css": strToU8(`
      h1 { text-align: center; margin-bottom: 2em; }
      p { text-align: justify; }
      .hidden { display: none; }
    `),
    "EPUB/one.xhtml": strToU8(`<?xml version="1.0"?>
      <html
        xmlns="http://www.w3.org/1999/xhtml"
        xmlns:epub="http://www.idpf.org/2007/ops"
      >
        <head><link rel="stylesheet" href="book.css"/></head>
        <body>
          <h1 id="opening">第一章</h1>
          <p>
            这里有一条脚注<a id="note-reference" href="two.xhtml#note-one" epub:type="noteref">1</a>。
          </p>
          <p class="hidden">这段内容必须被安全样式层过滤。</p>
          <img src="cover.png" alt="测试插图"/>
          ${paragraphs}
        </body>
      </html>`),
    "EPUB/two.xhtml": strToU8(`<?xml version="1.0"?>
      <html
        xmlns="http://www.w3.org/1999/xhtml"
        xmlns:epub="http://www.idpf.org/2007/ops"
      >
        <head><link rel="stylesheet" href="book.css"/></head>
        <body>
          <h1 id="second">第二章</h1>
          <p>目录跳转成功。</p>
          <aside id="note-one" epub:type="footnote">
            <p><a href="one.xhtml#note-reference" role="doc-backlink">1</a> 这是脚注正文。</p>
          </aside>
        </body>
      </html>`),
    "EPUB/cover.png": COVER_PNG,
  };
  return Buffer.from(zipSync(entries));
}

function readerPageStatus(page: Page) {
  return page.locator('[aria-label^="全书第 "]');
}

function readerProgressStatus(page: Page) {
  return page.locator('[aria-label^="全书第 "], [aria-label^="全书 "]').first();
}

async function waitForReaderReady(page: Page): Promise<void> {
  await expect(page.getByRole("button", { name: "下一页" })).toBeVisible({
    timeout: 60_000,
  });
  await expect(readerProgressStatus(page)).toBeVisible({ timeout: 60_000 });
}

async function clickPageTurnButton(
  page: Page,
  direction: "上一页" | "下一页",
): Promise<void> {
  const errorOverlay = page.locator("#error-overlay");
  if ((await errorOverlay.count()) > 0) {
    expect((await errorOverlay.textContent())?.trim() ?? "").toBe("");
  }
  await page.getByRole("button", { name: direction }).click({ force: IS_CI });
}

async function turnPageAndWait(
  page: Page,
  direction: "上一页" | "下一页",
): Promise<void> {
  const status = readerPageStatus(page);
  if ((await status.count()) === 0) {
    await page.getByRole("button", { name: "切换阅读工具" }).click();
    await expect(status).toBeVisible({ timeout: 60_000 });
  }
  const before = await status.getAttribute("aria-label");
  await clickPageTurnButton(page, direction);
  await expect
    .poll(() => status.getAttribute("aria-label"), { timeout: 60_000 })
    .not.toBe(before);
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

test("ships footnote and endnote fixtures in the built-in demo book", async ({
  page,
}) => {
  await page.getByRole("button", { name: "打开 柿子熟了" }).click();
  await waitForReaderReady(page);

  await expect(page.getByRole("link", { name: "打开脚注 1" })).toBeVisible();
  await expect(page.getByRole("link", { name: "打开脚注 2" })).toBeVisible();
  await expect(page.getByRole("link", { name: "打开尾注 3" })).toBeVisible();

  await page.getByRole("link", { name: "打开脚注 2" }).click();
  await expect(
    page.getByRole("button", { name: "返回脚注引用位置 2" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "返回正文 2" })).toHaveCount(0);

  await page
    .getByRole("button", { name: "关闭返回脚注引用位置的按钮" })
    .click();
  await expect(
    page.getByRole("button", { name: "返回脚注引用位置 2" }),
  ).toHaveCount(0);
});

test("imports, reads, navigates, resumes, and deletes a local EPUB", async ({
  page,
}) => {
  // Chromium's software CanvasKit path can spend tens of seconds delivering
  // the drag's animation frames even though every reader state transition
  // completes correctly. Keep the full lifecycle assertion above that jitter.
  test.setTimeout(240_000);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入 EPUB" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "persimmon-e2e.epub",
    mimeType: "application/epub+zip",
    buffer: createTestEpub(),
  });

  await waitForReaderReady(page);
  await expect(page.getByLabel(/^全书 \d+%$/)).toBeVisible();
  await expect(readerPageStatus(page)).toHaveCount(0);

  await turnPageAndWait(page, "下一页");
  await turnPageAndWait(page, "下一页");
  await expect(page.getByLabel(/全书第 3 页/)).toBeVisible({
    timeout: 60_000,
  });

  const pageStatus = readerPageStatus(page);
  await turnPageAndWait(page, "上一页");
  await expect(page.getByLabel(/全书第 2 页/)).toBeVisible({
    timeout: 60_000,
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
  await page.mouse.move(12, dragY - 48, { steps: IS_CI ? 8 : 24 });
  await page.mouse.up();
  await expect
    .poll(() => pageStatus.getAttribute("aria-label"), { timeout: 60_000 })
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
  test.setTimeout(180_000);

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入 EPUB" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "persimmon-spread-e2e.epub",
    mimeType: "application/epub+zip",
    buffer: createTestEpub(),
  });

  await waitForReaderReady(page);
  await page.getByRole("button", { name: "打开阅读布局" }).click();
  await page.getByRole("radio", { name: "双栏，每屏并排显示两页" }).click();
  await expect(
    page.getByRole("radio", { name: "双栏，每屏并排显示两页" }),
  ).toBeChecked();
  await page.getByRole("button", { name: "关闭阅读布局" }).click();

  await turnPageAndWait(page, "下一页");
  const pageStatus = readerPageStatus(page);
  const beforeSecondTurn = await pageStatus.getAttribute("aria-label");
  await clickPageTurnButton(page, "下一页");
  await expect(page.getByRole("button", { name: "返回书架" })).toHaveCount(0);
  await expect
    .poll(() => pageStatus.getAttribute("aria-label"), { timeout: 60_000 })
    .not.toBe(beforeSecondTurn);
  await expect(page.getByLabel(/全书第 5–6 页/)).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByRole("button", { name: "返回书架" })).toHaveCount(0);
  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await expect(page.getByRole("button", { name: "返回书架" })).toBeVisible();

  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.getByRole("button", { name: "打开 E2E 柿子书" }).click();
  await page.getByRole("button", { name: "打开阅读布局" }).click();
  await expect(
    page.getByRole("radio", { name: "双栏，每屏并排显示两页" }),
  ).toBeChecked();
});

test("opens a footnote and returns to its exact reference", async ({
  page,
}) => {
  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入 EPUB" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "persimmon-footnote-e2e.epub",
    mimeType: "application/epub+zip",
    buffer: createTestEpub(),
  });

  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await expect(page.getByLabel(/全书第 1 页/)).toBeVisible();
  await page.getByRole("link", { name: "打开脚注 1" }).click();
  await expect(
    page.getByRole("button", { name: "返回脚注引用位置 1" }),
  ).toBeVisible();
  await expect(readerPageStatus(page)).toBeVisible();

  await page.getByRole("button", { name: "返回脚注引用位置 1" }).click();
  await expect(page.getByLabel(/全书第 1 页/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "返回脚注引用位置 1" }),
  ).toHaveCount(0);

  await page.getByRole("link", { name: "打开脚注 1" }).click();
  const returnButton = page.getByRole("button", {
    name: "返回脚注引用位置 1",
  });
  await expect(returnButton).toHaveText("↩ 返回正文");

  await turnPageAndWait(page, "上一页");
  await expect(returnButton).toHaveText("↩");
  await page
    .getByRole("button", { name: "关闭返回脚注引用位置的按钮" })
    .click();
  await expect(returnButton).toHaveCount(0);

  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await page.getByRole("button", { name: "打开目录" }).click();
  await page.getByRole("button", { name: "跳转到 第一章" }).click();
  await expect(page.getByRole("link", { name: "打开脚注 1" })).toBeVisible({
    timeout: 10_000,
  });
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.evaluate(async () => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("persimmon-library");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const books = await new Promise<
      Array<{ id: string; compilerVersion: number }>
    >((resolve, reject) => {
      const request = database
        .transaction("books", "readonly")
        .objectStore("books")
        .getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const [book] = books;
    if (!book) {
      throw new Error("Expected an imported book.");
    }

    await new Promise<void>((resolve, reject) => {
      const transaction = database.transaction(
        ["books", "sections"],
        "readwrite",
      );
      transaction.objectStore("books").put({
        ...book,
        compilerVersion: 3,
      });
      transaction
        .objectStore("sections")
        .delete(IDBKeyRange.bound([book.id, ""], [book.id, "\uffff"]));
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  });

  await page.getByRole("button", { name: "打开 E2E 柿子书" }).click();
  await expect(page.getByRole("link", { name: "打开脚注 1" })).toBeVisible({
    timeout: 10_000,
  });
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
          const request = indexedDB.open("persimmon-library");
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        });
        const books = await new Promise<Array<{ compilerVersion: number }>>(
          (resolve, reject) => {
            const request = database
              .transaction("books", "readonly")
              .objectStore("books")
              .getAll();
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
          },
        );
        database.close();
        return books[0]?.compilerVersion;
      }),
    )
    .toBe(4);
});

test("customizes typography and persists header progress placement", async ({
  page,
}) => {
  await page.getByRole("button", { name: "打开 柿子熟了" }).click();
  await expect(page.getByLabel(/^全书 \d+%$/)).toBeVisible();
  await expect(readerPageStatus(page)).toHaveCount(0);

  await page.getByRole("button", { name: "打开阅读样式" }).click();
  await expect(page.getByText("阅读样式", { exact: true })).toBeVisible();
  await page.getByRole("radio", { name: "无衬线字体" }).click();
  await page.getByRole("button", { name: "增大字号" }).click();
  await page.getByRole("button", { name: "增大行距" }).click();
  await page.getByRole("button", { name: "增大段落间距" }).click();
  await page.getByRole("button", { name: "增大左右页边距" }).click();
  await page.getByRole("radio", { name: "进度显示在页眉" }).click();

  await expect(page.getByRole("radio", { name: "无衬线字体" })).toBeChecked();
  await expect(page.getByRole("slider", { name: "字号" })).toHaveAttribute(
    "aria-valuenow",
    "21",
  );
  await expect(page.getByRole("slider", { name: "行距" })).toHaveAttribute(
    "aria-valuenow",
    "1.7",
  );
  await expect(page.getByRole("slider", { name: "段落间距" })).toHaveAttribute(
    "aria-valuenow",
    "1",
  );
  await expect(
    page.getByRole("slider", { name: "左右页边距" }),
  ).toHaveAttribute("aria-valuenow", "36");
  await page.getByRole("button", { name: "关闭阅读样式" }).click();
  await expect(page.getByLabel(/^目录层级：.+$/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[aria-label^="页眉："]')).toHaveCount(0);

  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await expect(page.getByLabel(/^页眉：[^，]+$/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[aria-label^="全书第 "]')).toHaveCount(0);

  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await expect(page.getByLabel(/^目录层级：.+$/)).toBeVisible();
  await page.waitForTimeout(400);
  await page.getByRole("button", { name: "返回书架" }).click();
  await page.getByRole("button", { name: "打开 柿子熟了" }).click();
  await expect(page.getByLabel(/^目录层级：.+$/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[aria-label^="页眉："]')).toHaveCount(0);

  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await expect(page.getByLabel(/^页眉：[^，]+$/)).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[aria-label^="全书第 "]')).toHaveCount(0);

  await page.getByRole("button", { name: "切换阅读工具" }).click();
  await page.getByRole("button", { name: "打开阅读样式" }).click();
  await expect(page.getByRole("radio", { name: "无衬线字体" })).toBeChecked();
  await expect(page.getByRole("slider", { name: "字号" })).toHaveAttribute(
    "aria-valuenow",
    "21",
  );
});

test("keeps the TOC path between the corner toolbar controls", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  const fileChooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "导入 EPUB" }).click();
  const fileChooser = await fileChooserPromise;
  await fileChooser.setFiles({
    name: "persimmon-toolbar-carousel.epub",
    mimeType: "application/epub+zip",
    buffer: createTestEpub(),
  });
  await waitForReaderReady(page);

  await page.getByRole("button", { name: "打开阅读样式" }).click();
  await page.getByRole("radio", { name: "进度显示在页眉" }).click();
  await page.getByRole("button", { name: "关闭阅读样式" }).click();

  const breadcrumb = page.getByLabel(
    "目录层级：第一部：这是一个用于验证工具栏长目录轮换效果的非常非常长的章节标题 › 第一章",
  );
  await expect(breadcrumb).toBeVisible();
  const breadcrumbBox = await breadcrumb.boundingBox();
  const shelfButtonBox = await page
    .getByRole("button", { name: "返回书架" })
    .boundingBox();
  const tocButtonBox = await page
    .getByRole("button", { name: "打开目录" })
    .boundingBox();
  const layoutButtonBox = await page
    .getByRole("button", { name: "打开阅读布局" })
    .boundingBox();
  const curveButtonBox = await page
    .getByRole("button", { name: "调节翻页常量" })
    .boundingBox();
  const styleButtonBox = await page
    .getByRole("button", { name: "打开阅读样式" })
    .boundingBox();
  expect(breadcrumbBox).not.toBeNull();
  expect(shelfButtonBox).not.toBeNull();
  expect(tocButtonBox).not.toBeNull();
  expect(layoutButtonBox).not.toBeNull();
  expect(curveButtonBox).not.toBeNull();
  expect(styleButtonBox).not.toBeNull();
  expect(breadcrumbBox!.y).toBeLessThan(844 / 2);
  expect(shelfButtonBox!.x).toBeLessThan(390 / 2);
  expect(shelfButtonBox!.y).toBeLessThan(844 / 2);
  expect(tocButtonBox!.x).toBeGreaterThan(390 / 2);
  expect(tocButtonBox!.y).toBeLessThan(844 / 2);
  for (const buttonBox of [
    layoutButtonBox!,
    curveButtonBox!,
    styleButtonBox!,
  ]) {
    expect(buttonBox.x).toBeGreaterThan(390 / 2);
    expect(buttonBox.y).toBeGreaterThan(844 / 2);
  }
  await expect(breadcrumb.getByText("1/2", { exact: true })).toBeVisible({
    timeout: 5_000,
  });
  await expect(breadcrumb.getByText("2/2", { exact: true })).toBeVisible({
    timeout: 5_000,
  });
});
