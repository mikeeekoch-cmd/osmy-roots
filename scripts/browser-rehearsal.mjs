/** Actual browser journeys; private screenshots, snapshots and downloads stay ignored. */
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { resolve, join } from "node:path";
import { createHash } from "node:crypto";
import { authoritativeMetrics } from "../server/state/research.ts";
import { DemoManifestV3Schema } from "../packages/contracts/round3.ts";
import { readGeneratedZip } from "../server/agent/bundle.ts";
if (!process.env.ROOTS_PACKET_DIR)
  throw Error("Set ROOTS_PACKET_DIR to the frozen packet.");
const packet = resolve(process.env.ROOTS_PACKET_DIR),
  raw = JSON.parse(await readFile(join(packet, "DEMO_MANIFEST.json"), "utf8"));
if (raw.schemaVersion !== "roots-demo-v3") {
  await import("./browser-rehearsal-round2.mjs");
} else {
  const manifest = DemoManifestV3Schema.parse(raw),
    hash = (b) => createHash("sha256").update(b).digest("hex"),
    packetHash = hash(
      JSON.stringify({
        ...manifest,
        batches: [],
        sourceJobs: [],
        initialReleaseOffsetSeconds: 0,
      }),
    );
  const { chromium } = await import(
    process.env.PLAYWRIGHT_MODULE || "playwright"
  );
  const base = process.env.ROOTS_APP_URL || "http://127.0.0.1:3300",
    directory = resolve(
      process.env.ROOTS_REHEARSAL_OUTPUT || ".roots-data/rehearsals/round3",
    );
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const label =
    process.env.ROOTS_REHEARSAL_LABEL ||
    new Date().toISOString().replace(/[:.]/g, "-");
  const seedName = process.env.ROOTS_REHEARSAL_NAME;
  if (!seedName) throw Error("Set the supplied starting name.");
  const files = manifest.files.filter((f) => f.path.startsWith("01-upload/"));
  for (const f of files) {
    const b = await readFile(join(packet, f.path));
    if (b.length !== f.bytes || hash(b) !== f.sha256)
      throw Error("Frozen input bytes changed.");
  }
  const browser = await chromium.launch({
      headless: process.env.ROOTS_HEADFUL !== "1",
      ...(process.env.CHROME_EXECUTABLE
        ? { executablePath: process.env.CHROME_EXECUTABLE }
        : {}),
    }),
    context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      hasTouch: true,
      acceptDownloads: true,
    }),
    page = await context.newPage();
  const log = {
    label,
    packetHash,
    appCommit: process.env.ROOTS_APP_COMMIT,
    startedAt: new Date().toISOString(),
    cycles: [],
    photos: [],
    errors: [],
    requests: [],
    pass: false,
  };
  let latest;
  page.on("pageerror", (e) =>
    log.errors.push({ kind: "page", message: e.message }),
  );
  page.on("request", (r) => {
    if (r.url().includes("/api/projects"))
      log.requests.push({
        at: new Date().toISOString(),
        method: r.method(),
        path: new URL(r.url()).pathname,
      });
  });
  page.on("response", async (r) => {
    if (
      !r.url().includes("/api/projects") ||
      !r.headers()["content-type"]?.includes("application/json")
    )
      return;
    try {
      const s = await r.json();
      if (s.projectId && (!latest || s.version >= latest.version)) {
        latest = s;
        log.projectId = s.projectId;
      }
    } catch {}
  });
  const wait = async (fn, timeout = 180000) => {
    const t = Date.now();
    while (!fn()) {
      if (Date.now() - t > timeout)
        throw Error("Timed out waiting for the saved research state.");
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const shot = async (name) =>
    page.screenshot({
      path: join(directory, `${label}-${name}.png`),
      fullPage: true,
    });
  try {
    await page.goto(base, { waitUntil: "networkidle" });
    for (const provider of ["Google Drive", "Gmail"]) {
      const card = page.locator(".provider-card").filter({ hasText: provider });
      const connect = card.getByRole("button", {
        name: "Connect",
        exact: true,
      });
      if (await connect.count()) await connect.click();
    }
    await page.getByLabel("Full name", { exact: false }).first().fill(seedName);
    await page
      .locator("input[type=file]")
      .first()
      .setInputFiles(files.map((f) => join(packet, f.path)));
    await shot("intake");
    if (log.requests.some((r) => r.method === "POST"))
      throw Error("Project research started before Continue.");
    log.continueAt = new Date().toISOString();
    await page.getByRole("button", { name: "Continue", exact: false }).click();
    await wait(() => latest?.research, 30000);
    if (latest.run.questions.length !== 6)
      throw Error("Exactly six checks required.");
    if (latest.run.packetHash !== packetHash)
      throw Error("Runtime packet fingerprint mismatch.");
    for (let i = 0; i < 6; i++) {
      await page
        .getByText(`${i + 1} of 6`, { exact: true })
        .waitFor({ timeout: 60000 });
      const q = latest.run.questions[i];
      if (q.photoAssetId || q.effect.photoAssetId) {
        await page.locator(".setup-photo img").first().waitFor();
        await page
          .locator(".setup-photo img")
          .first()
          .evaluate((img) => img.decode());
        const box = await page.locator(".setup-photo").boundingBox();
        if (box.width < 450)
          throw Error("Initial photograph is too small at desktop width.");
        await shot(`check-${i + 1}`);
      }
      const button =
        q.category === "conflict"
          ? page
              .locator(".setup-actions")
              .getByRole("button", { name: "I don't know", exact: true })
          : page.getByRole("button", {
              name: "Confirm and continue",
              exact: true,
            });
      await button.click({ timeout: 90000 });
      await wait(() => latest.run.answers.length >= i + 1, 15000);
    }
    await wait(() => latest.research.intake.status === "ready", 20000);
    log.checksCompletedAt = new Date().toISOString();
    for (let ordinal = 1; ordinal <= 3; ordinal++) {
      const clickAt = new Date().toISOString();
      await page
        .getByRole("button", {
          name: ordinal === 1 ? "Start research" : "Research deeper",
          exact: true,
        })
        .click();
      await wait(() => latest.research.cycles.length === ordinal, 10000);
      const cycleId = latest.research.cycles[ordinal - 1].id;
      const entry = {
        ordinal,
        cycleId,
        clickAt,
        firstActivityAt: new Date().toISOString(),
      };
      log.cycles.push(entry);
      if (ordinal === 2 && process.env.ROOTS_REHEARSAL_REFRESH === "1") {
        await page.reload({ waitUntil: "domcontentloaded" });
        await wait(() => latest.research.cycles[1]?.id === cycleId);
        entry.refreshed = true;
      }
      await wait(
        () =>
          latest.research.cycles[ordinal - 1]?.status === "completed" ||
          latest.research.cycles[ordinal - 1]?.status === "failed",
        240000,
      );
      const cycle = latest.research.cycles[ordinal - 1];
      if (cycle.status !== "completed")
        throw Error(
          `Round ${ordinal} failed: ${latest.research.jobs
            .filter((j) => j.cycleId === cycleId && j.status === "failed")
            .map((j) => j.error)
            .join(" ")}`,
        );
      entry.completedAt = cycle.completedAt;
      entry.firstResultAt = cycle.firstResultAt;
      entry.firstResultMs =
        Date.parse(cycle.firstResultAt) - Date.parse(clickAt);
      entry.jobs = latest.research.jobs
        .filter((j) => j.cycleId === cycleId)
        .map((j) => ({
          id: j.id,
          kind: j.kind,
          status: j.status,
          attempt: j.attempt,
          resultIds: j.resultIds,
        }));
      entry.metrics = latest.research.metrics;
      if (
        JSON.stringify(entry.metrics.totals) !==
        JSON.stringify(authoritativeMetrics(latest).totals)
      )
        throw Error("Stored metrics diverge from saved operations");
      if (
        !entry.jobs.some(
          (j) => j.kind === "analyze" && j.status === "completed",
        )
      )
        throw Error("Round has no completed record analysis");
      await shot(`round-${ordinal}`);
      // Explicit UI reviews; no private expected answers are supplied to the model.
      for (const proposal of latest.research.graphProposals.filter(
        (p) => p.status === "pending",
      )) {
        const card = page
          .locator(".bank-card")
          .filter({
            has: page.getByRole("heading", {
              name: proposal.summary,
              exact: true,
            }),
          })
          .last();
        const previous = latest.version;
        await card
          .getByRole("button", {
            name: proposal.alternatives.length
              ? "Keep unknown"
              : "Accept connection",
            exact: true,
          })
          .click();
        await wait(() => latest.version > previous);
      }
    }
    const bank = page
      .locator(".question-bank .bank-card")
      .filter({
        has: page.getByRole("button", { name: "Confirm", exact: true }),
      })
      .first();
    await bank.getByRole("button", { name: "Confirm", exact: true }).click();
    await wait(() =>
      latest.research.questionBank.some((q) => q.status === "answered"),
    );
    // Inspect every original in its source/person card and actual full viewer.
    const closeEvidence = async () => {
      const close = page.getByRole("button", {
        name: "Close evidence",
        exact: true,
      });
      if (await close.count()) await close.click();
    };
    const openGallery = async (asset) => {
      await closeEvidence();
      const annotation = latest.photoAnnotations?.find(
        (a) => a.assetId === asset.id,
      );
      const candidates = [
        ...latest.people
          .filter((p) => p.photoIds.includes(asset.id))
          .map((p) => p.id),
        ...(annotation?.positions.map((p) => p.personId).filter(Boolean) || []),
        ...(annotation?.depictedPersonIds || []),
      ];
      const person = latest.people.find((p) => candidates.includes(p.id));
      if (person) {
        await page
          .getByRole("textbox", { name: "Search people", exact: true })
          .fill(person.displayNameEn);
        await page
          .locator(".person-node")
          .filter({ hasText: person.displayNameEn })
          .first()
          .click();
      } else {
        const inventory = page.locator(".processing-files");
        if ((await inventory.getAttribute("open")) === null)
          await inventory.locator("summary").click();
        const file = latest.files.find((f) => f.assetIds.includes(asset.id));
        if (!file) throw Error("Original has no source inventory entry");
        await inventory
          .locator("article")
          .filter({ hasText: file.originalName })
          .getByRole("button", { name: "Inspect source", exact: false })
          .first()
          .click();
      }
      const figure = page
        .locator(".photo-gallery figure")
        .filter({
          has: page.getByRole("button", {
            name: `Enlarge ${asset.originalName}`,
            exact: true,
          }),
        })
        .first();
      await figure.waitFor();
      await figure
        .locator("img")
        .first()
        .evaluate((img) => img.decode());
      return figure;
    };
    const originals = latest.assets.filter(
      (a) =>
        a.mediaType.startsWith("image/") &&
        a.role !== "derivative" &&
        !latest.photoPairs.some((p) => p.enhancedAssetId === a.id),
    );
    for (const asset of originals) {
      const url = `${base}/api/projects/${latest.projectId}/assets/${asset.id}`,
        response = await context.request.get(url);
      const bytes = await response.body();
      if (
        !response.ok() ||
        hash(bytes) !== asset.contentHash ||
        !response.headers()["content-type"]?.startsWith("image/")
      )
        throw Error("Original photo response failed byte/type verification.");
      const figure = await openGallery(asset),
        opener = figure.getByRole("button", {
          name: `Enlarge ${asset.originalName}`,
          exact: true,
        });
      await opener.click();
      const full = page.locator(".photo-lightbox .photo-zoom-surface img");
      await full.evaluate((img) => img.decode());
      if (
        !((await full.getAttribute("src")) || "").endsWith(
          `/assets/${asset.id}`,
        )
      )
        throw Error("Full viewer shows a stale original");
      await page
        .getByRole("button", { name: "Zoom photograph in", exact: true })
        .click();
      await page
        .getByRole("button", { name: "Fit photograph", exact: true })
        .click();
      await shot(`original-${asset.id}`);
      await page.keyboard.press("Escape");
      if (!(await opener.evaluate((el) => el === document.activeElement)))
        throw Error("Original viewer did not restore focus");
      log.photos.push({
        assetId: asset.id,
        sha256: hash(bytes),
        decoded: true,
        card: true,
        fullView: true,
        zoom: true,
        focusRestored: true,
      });
    }
    if (
      log.photos.length !==
      manifest.files.filter((f) => /\.(?:jpe?g|png|webp)$/i.test(f.path)).length
    )
      throw Error("Original coverage mismatch");
    // Every selected old-photo pair must use the actual aligned comparison control.
    for (const [index, pair] of manifest.photoPairs.entries()) {
      if (pair.qa.status !== "passed" || pair.alignment.mode !== "aligned")
        throw Error("A required photo pair has not passed QA.");
      const asset = latest.assets.find((a) => a.id === pair.originalAssetId),
        enhanced = latest.assets.find((a) => a.id === pair.enhancedAssetId);
      const bytes = await (
        await context.request.get(
          `${base}/api/projects/${latest.projectId}/assets/${enhanced.id}`,
        )
      ).body();
      if (hash(bytes) !== pair.enhancedHash)
        throw Error("Enhanced bytes differ from manifest");
      const figure = await openGallery(asset),
        opener = figure.getByRole("button", {
          name: "Compare photos",
          exact: true,
        });
      await opener.click();
      const slider = page.getByRole("slider", {
        name: "Photo comparison divider",
      });
      await slider.waitFor();
      await slider.press("Home");
      if ((await slider.inputValue()) !== "0")
        throw Error("Slider Home failed");
      await slider.press("End");
      if ((await slider.inputValue()) !== "100")
        throw Error("Slider End failed");
      await slider.press("ArrowLeft");
      if (
        (await slider.inputValue()) !== "99" ||
        !(await page.locator(".photo-lightbox").innerText()).includes(
          asset.originalName,
        )
      )
        throw Error("Slider arrow changed photograph");
      await page
        .getByRole("button", { name: "Half and half", exact: true })
        .click();
      if ((await slider.inputValue()) !== "50")
        throw Error("Slider midpoint failed");
      const box = await slider.boundingBox();
      await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
      await page.mouse.down();
      await page.mouse.move(
        box.x + box.width * 0.75,
        box.y + box.height * 0.5,
        { steps: 5 },
      );
      await page.mouse.up();
      if (Number(await slider.inputValue()) < 65)
        throw Error("Mouse divider drag failed");
      await page.touchscreen.tap(
        box.x + box.width * 0.25,
        box.y + box.height * 0.5,
      );
      if (Number(await slider.inputValue()) > 40)
        throw Error("Touch divider failed");
      await page
        .getByRole("button", { name: "Half and half", exact: true })
        .click();
      await slider.focus();
      for (let i = 0; i < 14; i++) await page.keyboard.press("Tab");
      if (
        !(await page
          .locator(".photo-lightbox")
          .evaluate((el) => el.contains(document.activeElement)))
      )
        throw Error("Comparison focus escaped modal");
      await shot(`pair-${pair.id}`);
      await page.keyboard.press("Escape");
      if (await page.locator(".photo-lightbox").count())
        throw Error("Escape did not close comparison");
      if (!(await opener.evaluate((el) => el === document.activeElement)))
        throw Error("Comparison did not restore focus");
      await opener.click();
      await slider.waitFor();
      if ((await slider.inputValue()) !== "50")
        throw Error("Reopened comparison retained stale divider state");
      await page.keyboard.press("Escape");
      log.photos.find((p) => p.assetId === asset.id).pair = {
        id: pair.id,
        enhancedHash: hash(bytes),
        mouse: true,
        touch: true,
        keyboard: true,
        reopened: true,
      };
    }
    await closeEvidence();
    await page
      .getByRole("textbox", { name: "Search people", exact: true })
      .fill("");
    await page.locator(".book-info-button").click();
    const prepare = page.getByRole("button", {
      name: "Prepare current edition",
      exact: true,
    });
    if (await prepare.count()) await prepare.click();
    await wait(
      () => ["current", "error"].includes(latest.research.bookEdition?.status),
      240000,
    );
    if (latest.research.bookEdition.status !== "current")
      throw Error(latest.research.bookEdition.error);
    if (
      latest.research.bookEdition.pageCount < 35 ||
      latest.research.bookEdition.pageCount > 40
    )
      throw Error("Full English edition page count failed");
    const previewResponse = page.waitForResponse(
      (r) => r.url().includes("/book/preview") && r.status() === 200,
    );
    await page
      .getByRole("button", { name: "Preview current PDF", exact: true })
      .click();
    const preview = await previewResponse,
      pdf = await (await context.request.get(preview.url())).body();
    if (pdf.subarray(0, 5).toString() !== "%PDF-")
      throw Error("Preview was not a real PDF");
    await shot("book-preview");
    await page
      .getByRole("button", { name: "Close book details", exact: true })
      .click();
    const downloadPromise = page.waitForEvent("download", { timeout: 60000 });
    await page
      .getByRole("button", { name: "Download family book", exact: false })
      .click();
    const download = await downloadPromise;
    await download.saveAs(join(directory, `${label}.zip`));
    if (await download.failure()) throw Error("Download failed");
    log.receiptAt = new Date().toISOString();
    const zip = await readFile(join(directory, `${label}.zip`)),
      entries = readGeneratedZip(zip);
    if (hash(entries.get("book.pdf")) !== hash(pdf))
      throw Error("Preview and downloaded book bytes differ");
    log.edition = latest.research.bookEdition;
    log.pdfHash = hash(pdf);
    log.zipHash = hash(zip);
    log.totalMs = Date.parse(log.receiptAt) - Date.parse(log.continueAt);
    if (log.errors.length) throw Error("Browser reported page errors");
    log.pass = true;
    await writeFile(
      join(directory, `${label}-project.json`),
      JSON.stringify(latest, null, 2),
      { mode: 0o600 },
    );
    console.log(
      JSON.stringify({
        label,
        pass: true,
        totalMs: log.totalMs,
        cycles: log.cycles.map((c) => ({
          ordinal: c.ordinal,
          firstResultMs: c.firstResultMs,
        })),
        pageCount: log.edition.pageCount,
        photos: log.photos.length,
      }),
    );
  } catch (e) {
    log.errors.push({ kind: "rehearsal", message: e.message });
    await shot("failure").catch(() => {});
    console.error("Rehearsal failed:", e.message);
    process.exitCode = 1;
  } finally {
    await writeFile(
      join(directory, `${label}-timing.json`),
      JSON.stringify(log, null, 2),
      { mode: 0o600 },
    );
    await context.close();
    await browser.close();
  }
}
