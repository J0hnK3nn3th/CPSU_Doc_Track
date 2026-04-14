import http from "node:http";
import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = new Set(process.argv.slice(2));
const useDist = args.has("--dist");
const rootDir = useDist ? path.join(__dirname, "dist") : __dirname;
const port = Number.parseInt(process.env.PORT || "5173", 10);
const apiTarget = process.env.API_TARGET || "http://127.0.0.1:8000";

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".svg", "image/svg+xml"],
  [".ico", "image/x-icon"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function sendNotFound(res) {
  res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Not found");
}

async function serveStatic(req, res) {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const cleanedPath = path.normalize(urlPath).replace(/^(\.\.(\/|\\|$))+/, "");
  let filePath = path.join(rootDir, cleanedPath === "/" ? "index.html" : cleanedPath);

  try {
    const fileStat = await stat(filePath);
    if (fileStat.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
  } catch {
    if (!path.extname(filePath)) {
      const htmlFile = `${filePath}.html`;
      if (existsSync(htmlFile)) {
        filePath = htmlFile;
      }
    }
  }

  if (!existsSync(filePath)) {
    sendNotFound(res);
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES.get(ext) || "application/octet-stream";
  res.writeHead(200, { "Content-Type": contentType });
  createReadStream(filePath).pipe(res);
}

function proxyApi(req, res) {
  const targetUrl = new URL(req.url || "/", apiTarget);
  const proxyReq = http.request(
    {
      protocol: targetUrl.protocol,
      hostname: targetUrl.hostname,
      port: targetUrl.port,
      path: `${targetUrl.pathname}${targetUrl.search}`,
      method: req.method,
      headers: {
        ...req.headers,
        host: targetUrl.host,
      },
    },
    (proxyRes) => {
      res.writeHead(proxyRes.statusCode || 500, proxyRes.headers);
      proxyRes.pipe(res);
    },
  );

  proxyReq.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Bad gateway: API target is unavailable.");
  });

  req.pipe(proxyReq);
}

const server = http.createServer((req, res) => {
  if ((req.url || "").startsWith("/api")) {
    proxyApi(req, res);
    return;
  }
  serveStatic(req, res).catch(() => {
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  });
});

server.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
  console.log(`Serving: ${rootDir}`);
  console.log(`Proxy /api -> ${apiTarget}`);
});
