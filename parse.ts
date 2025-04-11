import { Command } from "commander";
import { parseFile } from "./parsers/markdownParser";
import { ensureDirectories, saveJSON } from "./parsers/fileUtils";
import { assembleBlocks } from "./parsers/assembleBlocks";

// Инициализация CLI
const program = new Command();
program
  .version("1.2.0")
  .description("Парсер Markdown")
  .option("-f, --file <file>", "Парсинг локального файла (.md, .docx)")
  .option(
    "-o, --output <file>",
    "Выходной JSON-файл",
    "content/output/content.json"
  )
  .parse(process.argv);

const options = program.opts();

// Убеждаемся, что папки существуют
ensureDirectories();

(async function main() {
  if (!options.file) {
    console.error("❌ Укажите --file");
    process.exit(1);
  }
  console.log("📂 Обрабатываем локальный файл...");
  const parsed = await parseFile(options.file);
  const jsonData = await assembleBlocks(parsed);
  saveJSON(options.output, jsonData);
  console.log(`✅ JSON сохранён в: ${options.output}`);
})();
