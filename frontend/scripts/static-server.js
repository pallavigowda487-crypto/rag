import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";

const port = Number(process.env.PORT || 5173);
const root = resolve("dist");

const types = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg"
};

http
  .createServer((req, res) => {
    const url = new URL(req.url || "/", `http://localhost:${port}`);
    const pathname = decodeURIComponent(url.pathname);
    const requested = pathname === "/" ? "index.html" : pathname.slice(1);
    let filePath = resolve(join(root, requested));

    if (!filePath.startsWith(root) || !existsSync(filePath) || statSync(filePath).isDirectory()) {
      filePath = join(root, "index.html");
    }

    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", types[extname(filePath)] || "application/octet-stream");
    createReadStream(filePath).pipe(res);
  })
  .listen(port, () => {
    console.log(`Naive RAG frontend running on http://localhost:${port}`);
  });
