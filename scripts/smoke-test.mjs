import { spawn } from "node:child_process";

const port = 3210;
const server = spawn(
  process.platform === "win32" ? "node_modules/.bin/vite.cmd" : "node_modules/.bin/vite",
  ["preview", "--config", "vite.spa.config.mjs", "--host", "127.0.0.1", "--port", String(port), "--strictPort"],
  {
    cwd: process.cwd(),
    env: { ...process.env, HOST: "127.0.0.1", PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  }
);

let output = "";
server.stdout.on("data", (chunk) => (output += chunk.toString()));
server.stderr.on("data", (chunk) => (output += chunk.toString()));

async function waitForServer() {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (server.exitCode !== null) throw new Error(`Server exited early:\n${output}`);
    try {
      const response = await fetch(`http://127.0.0.1:${port}/`);
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not become ready:\n${output}`);
}

try {
  await waitForServer();
  const response = await fetch(`http://127.0.0.1:${port}/`);
  const html = await response.text();
  if (!response.ok) throw new Error(`Root page: HTTP ${response.status}`);
  if (!html.includes("私藏香水档案")) throw new Error("Root page is missing site content");
  if (!html.includes('id="root"')) throw new Error("SPA root is missing");
  if (html.includes("香水(1).docx") || html.includes("file_00000000a58871fd94374a90811072bc")) {
    throw new Error("Uploaded filename or internal identifier is exposed");
  }

  const imageResponse = await fetch(`http://127.0.0.1:${port}/thumbnails/p0001.webp`);
  if (!imageResponse.ok || !imageResponse.headers.get("content-type")?.includes("image/webp")) {
    throw new Error("Perfume thumbnail endpoint failed");
  }

  const placeholderResponse = await fetch(`http://127.0.0.1:${port}/images/image-pending.svg`);
  if (!placeholderResponse.ok || !placeholderResponse.headers.get("content-type")?.includes("svg")) {
    throw new Error("Fallback image endpoint failed");
  }

  const workerModule = await import(new URL(`../dist/server/index.js?test=${Date.now()}`, import.meta.url));
  const workerRoot = await workerModule.default.fetch(new Request("https://example.test/"));
  const workerHtml = await workerRoot.text();
  const missingImage = await workerModule.default.fetch(new Request("https://example.test/thumbnails/not-found.webp"));
  const workerAfterMissing = await workerModule.default.fetch(new Request("https://example.test/"));
  if (workerRoot.status !== 200 || !workerHtml.includes("私藏香水档案")) {
    throw new Error("Static worker homepage failed");
  }
  if (missingImage.status !== 404 || workerAfterMissing.status !== 200) {
    throw new Error("A missing image affected the static worker");
  }

  console.log(JSON.stringify({ spa: "ok", thumbnail: "ok", fallback: "ok", worker: "ok", missingImage: 404 }));
} finally {
  server.kill("SIGTERM");
}
