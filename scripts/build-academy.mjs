import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, rmSync } from "node:fs";
import { join, dirname, relative, basename, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { marked } from "marked";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC_DIRS = ["docs/academy", "docs/adr"];
const OUT_DIR = join(ROOT, "site");

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (extname(full) === ".md") {
      files.push(full);
    }
  }
  return files;
}

function htmlTemplate(title, body) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${title} — Agenthood Academy</title>
</head>
<body>
<main>${body}</main>
</body>
</html>`;
}

function ensureDir(filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

function convertMarkdown(filePath) {
  const content = readFileSync(filePath, "utf-8");
  const html = marked.parse(content, { mangle: false, headerIds: true });

  const relPath = relative(join(ROOT, "docs"), filePath);
  const dir = dirname(relPath);
  const name = basename(filePath, ".md");
  const isIndex = name === "README" || name === "index";

  const title = content.split("\n")[0]?.replace(/^#\s*/, "") || "Agenthood Academy";
  const outPath = isIndex
    ? join(OUT_DIR, dir, "index.html")
    : join(OUT_DIR, dir, name, "index.html");

  ensureDir(outPath);
  writeFileSync(outPath, htmlTemplate(title, html));
  console.log("  →", relative(OUT_DIR, outPath));
}

function build() {
  console.log("Building Academy site...\n");

  if (existsSync(OUT_DIR)) rmSync(OUT_DIR, { recursive: true });

  const files = SRC_DIRS
    .flatMap((d) => walk(join(ROOT, d)))
    .filter((f) => !f.endsWith("ARTICLE_TEMPLATE.md"));

  for (const file of files) {
    convertMarkdown(file);
  }

  console.log("\nDone —", files.length, "pages built to site/");
}

build();
