import fs from "node:fs";
import path from "node:path";

const sourceImageDirectory = path.join(process.cwd(), "dist", "client", "perfumes");

if (fs.existsSync(sourceImageDirectory)) {
  fs.rmSync(sourceImageDirectory, { recursive: true, force: true });
}

console.log("Unused PNG source images removed from deployment output");
