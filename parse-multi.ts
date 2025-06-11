#!/usr/bin/env ts-node
// Скрипт для тестирования parseFileMulti: читает все .md из content/input и пишет JSON в content/output

import fs from "fs";
import path from "path";
import { parseFileMulti } from "./parsers/markdownParserMulti";

async function main() {
  const root = path.resolve(__dirname);
  const inputDir = path.join(root, "content", "input");
  const outputDir = path.join(root, "content", "output");

  if (!fs.existsSync(inputDir)) {
    console.error(`Input directory not found: ${inputDir}`);
    process.exit(1);
  }
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const files = fs
    .readdirSync(inputDir)
    .filter((f) => f.toLowerCase().endsWith(".md"));
  if (!files.length) {
    console.warn(`No .md files found in ${inputDir}`);
    return;
  }

  for (const file of files) {
    const filePath = path.join(inputDir, file);
    console.log(`Parsing ${file}...`);
    const siteData = await parseFileMulti(filePath);
    if (siteData) {
      const baseName = path.basename(file, ".md");
      const outPath = path.join(outputDir, `${baseName}.json`);
      fs.writeFileSync(outPath, JSON.stringify(siteData, null, 2), "utf-8");
      console.log(`→ Output written to ${outPath}`);
    } else {
      console.error(`Failed to parse ${file}`);
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
