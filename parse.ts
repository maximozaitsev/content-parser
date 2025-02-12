import { Command } from "commander";
import { parseFile } from "./parsers/markdownParser";
import { fetchGoogleDocs } from "./parsers/googleDocsParser";
import { ensureDirectories, saveJSON } from "./parsers/fileUtils";

// Инициализация CLI
const program = new Command();
program
  .version("1.2.0")
  .description("Парсер Markdown и Google Docs")
  .option("-f, --file <file>", "Парсинг локального файла (.md, .docx)")
  .option("-u, --url <url>", "Парсинг Google Docs")
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
  let jsonData;

  if (options.url) {
    console.log("🌍 Загружаем Google Docs...");
    const markdownContent = await fetchGoogleDocs(options.url);
    jsonData = parseFile(markdownContent);
  } else if (options.file) {
    console.log("📂 Обрабатываем локальный файл...");
    jsonData = await parseFile(options.file);
  } else {
    console.error("❌ Укажите --url или --file");
    process.exit(1);
  }

  saveJSON(options.output, jsonData);
  console.log(`✅ JSON сохранён в: ${options.output}`);
})();
