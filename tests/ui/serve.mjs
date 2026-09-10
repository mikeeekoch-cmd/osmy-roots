// Local UI-only preview using the lead's existing tsx/esbuild dependency.
// This is explicitly replay, never evidence of live backend acceptance.
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const output = resolve(".ui-preview");
await mkdir(output, { recursive: true });
await build({
  entryPoints: ["tests/ui/preview.tsx"],
  bundle: true,
  outdir: output,
  jsx: "automatic",
  platform: "browser",
  sourcemap: true,
});
createServer(async (req, res) => {
  try {
    if (req.url === "/") {
      res.setHeader("content-type", "text/html");
      res.end(
        '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Roots — development replay</title><link rel="stylesheet" href="/preview.css"></head><body style="margin:0"><div id="root"></div><script src="/preview.js"></script></body></html>',
      );
      return;
    }
    const file = { "/preview.js": "preview.js", "/preview.css": "preview.css" }[
      req.url
    ];
    if (!file) {
      res.writeHead(404).end();
      return;
    }
    res.setHeader(
      "content-type",
      file.endsWith("css") ? "text/css" : "application/javascript",
    );
    res.end(await readFile(resolve(output, file)));
  } catch {
    res.writeHead(500).end("Preview failed");
  }
}).listen(3101, "127.0.0.1", () =>
  console.log("UI replay: http://127.0.0.1:3101"),
);
