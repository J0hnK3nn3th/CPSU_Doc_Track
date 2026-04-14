import { cp, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outDir = path.join(__dirname, "dist");

async function build() {
  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir, { recursive: true });

  const entries = [
    "src",
    "index.html",
    "admin.html",
    "incoming.html",
    "outgoing.html",
    "system_config.html",
    "user.html",
    "uincoming.html",
    "uoutgoing.html",
  ];

  for (const entry of entries) {
    await cp(path.join(__dirname, entry), path.join(outDir, entry), {
      recursive: true,
      force: true,
    });
  }

  console.log("Build complete: static files copied to Frontend/dist");
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
