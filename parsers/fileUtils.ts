import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const INPUT_DIR = path.join(__dirname, "../content/input");
const OUTPUT_DIR = path.join(__dirname, "../content/output");

// Создаём папки, если их нет
export function ensureDirectories() {
  if (!fs.existsSync(INPUT_DIR)) fs.mkdirSync(INPUT_DIR, { recursive: true });
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Функция сохранения JSON
export function saveJSON(outputPath: string, data: any) {
  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), "utf-8");
}
