import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const clientDirectory = path.join(root, "dist", "client");
const serverDirectory = path.join(root, "dist", "server");
const hostingDirectory = path.join(root, "dist", ".openai");

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

async function collectFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = {};

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.posix.join(prefix, entry.name);
    if (entry.isDirectory()) {
      Object.assign(files, await collectFiles(absolutePath, relativePath));
      continue;
    }

    const bytes = await readFile(absolutePath);
    files[`/${relativePath}`] = {
      body: bytes.toString("base64"),
      type: mimeTypes[path.extname(entry.name).toLowerCase()] ?? "application/octet-stream",
    };
  }

  return files;
}

const assets = await collectFiles(clientDirectory);
const workerSource = `"use strict";

const ASSETS = ${JSON.stringify(assets)};

const SECURITY_HEADERS = {
  "Content-Security-Policy": "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()"
};

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function responseFor(asset, pathname, request) {
  return new Response(request.method === "HEAD" ? null : decodeBase64(asset.body), {
    status: 200,
    headers: {
      "Content-Type": asset.type,
      "Cache-Control": pathname === "/index.html" ? "no-cache" : "public, max-age=31536000, immutable",
      ...SECURITY_HEADERS
    }
  });
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    let pathname;
    try {
      pathname = decodeURIComponent(url.pathname);
    } catch {
      return new Response("Bad request", { status: 400 });
    }

    if (pathname === "/" || pathname === "") pathname = "/index.html";
    const asset = ASSETS[pathname];
    if (asset) return responseFor(asset, pathname, request);

    if (!pathname.split("/").pop()?.includes(".")) {
      return responseFor(ASSETS["/index.html"], "/index.html", request);
    }

    return new Response("Not found", {
      status: 404,
      headers: { "Content-Type": "text/plain; charset=utf-8", ...SECURITY_HEADERS }
    });
  }
};
`;

await rm(serverDirectory, { recursive: true, force: true });
await rm(hostingDirectory, { recursive: true, force: true });
await mkdir(serverDirectory, { recursive: true });
await mkdir(hostingDirectory, { recursive: true });
await writeFile(path.join(serverDirectory, "index.js"), workerSource, "utf8");
await copyFile(path.join(root, ".openai", "hosting.json"), path.join(hostingDirectory, "hosting.json"));

console.log(`Static worker built with ${Object.keys(assets).length} assets`);
