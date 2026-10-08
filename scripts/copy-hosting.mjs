import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const serverEntry = path.join(root, "dist", "server", "index.js");
if (!fs.existsSync(serverEntry)) throw new Error("vinext did not create dist/server/index.js");

const hostingDir = path.join(root, "dist", ".openai");
fs.mkdirSync(hostingDir, { recursive: true });
fs.copyFileSync(path.join(root, ".openai", "hosting.json"), path.join(hostingDir, "hosting.json"));

console.log("Sites hosting metadata copied into dist");
