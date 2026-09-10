// Local UI-only preview using the lead's existing tsx/esbuild dependency.
// This is explicitly replay, never evidence of live backend acceptance.
import { createRequire } from "node:module";
import { createServer, request } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild");
const connected = process.env.ROOTS_UI_CONNECTED === "1";
const round3 = process.env.ROOTS_UI_ROUND3 === "1";
const round2 = process.env.ROOTS_UI_ROUND2 === "1";
const port = round3 ? 3104 : round2 ? 3103 : connected ? 3102 : 3101;
const entry = round3 ? "round3-preview" : round2 ? "round2-preview" : connected ? "connected" : "preview";
const output = resolve(".ui-preview", entry);
await mkdir(output, { recursive: true });
await build({
  entryPoints: [`tests/ui/${entry}.tsx`],
  bundle: true,
  outdir: output,
  jsx: "automatic",
  platform: "browser",
  sourcemap: true,
});
if (process.env.ROOTS_UI_BUILD_ONLY !== "1") createServer(async (req, res) => {
  try {
    if (connected && req.url?.startsWith("/api/")) {
      const upstream = request(
        {
          hostname: "127.0.0.1",
          port: 3100,
          path: req.url,
          method: req.method,
          headers: req.headers,
        },
        (response) => {
          res.writeHead(response.statusCode || 502, response.headers);
          response.pipe(res);
        },
      );
      upstream.on("error", () =>
        res.writeHead(502).end("Start the lead Next server on port 3100."),
      );
      req.pipe(upstream);
      return;
    }
    if (req.url === "/") {
      res.setHeader("content-type", "text/html");
      res.end(
        `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Osmy Roots · ${connected ? "connected UI" : "development replay"}</title><link rel="stylesheet" href="/${entry}.css"></head><body style="margin:0"><div id="root"></div><script src="/${entry}.js"></script></body></html>`,
      );
      return;
    }
    const file = {
      [`/${entry}.js`]: `${entry}.js`,
      [`/${entry}.css`]: `${entry}.css`,
    }[req.url];
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
}).listen(port, "127.0.0.1", () =>
  console.log(`UI ${entry}: http://127.0.0.1:${port}`),
);
