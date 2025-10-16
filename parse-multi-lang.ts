import { Command } from "commander";
import { parseFile } from "./parsers/markdownParserMultiLang.ts";
import { ensureDirectories, saveJSON } from "./parsers/fileUtils.ts";
import { assembleBlocks } from "./parsers/assembleBlocks.ts";

// Инициализация CLI, совместимая с обычным parse.ts
const program = new Command();
program
  .version("1.0.0")
  .description(
    "Мультиязычный парсер Markdown/DOCX для генерации content.<locale>.json"
  )
  .option("-f, --file <file>", "Парсинг локального файла (.md, .docx)")
  .option(
    "-o, --output <file>",
    "Выходной JSON-файл",
    "content/output/content.json"
  )
  .option(
    "--mode <mode>",
    'Режим работы: "default" (по умолчанию) или "simple"',
    "default"
  )
  .parse(process.argv);

const options = program.opts();

// Убедимся, что целевые директории существуют (поведение как в parse.ts)
ensureDirectories();

// Режим simple – плоская группировка по h2, с сохранением h1/intro
function simpleGrouping(parsed: { data: any }): any {
  const result: any = {
    "meta-title": parsed.data["meta-title"] || "",
    "meta-description": parsed.data["meta-description"] || "",
    title: parsed.data.title || "",
    intro: parsed.data.intro || [],
    content: {},
  };
  Object.assign(
    result.content,
    parsed.data.about,
    parsed.data.advantages,
    parsed.data.sections
  );
  return result;
}

(async function main() {
  if (!options.file) {
    console.error("❌ Укажите --file");
    process.exit(1);
  }
  console.log("📂 Обрабатываем локальный файл (multi‑lang)...");

  // parseFile возвращает { data, h2Headers, currentMode }
  const parsed = await parseFile(options.file);
  if (!parsed) process.exit(1);

  let jsonData: any;
  if (options.mode === "simple") {
    console.log("🔄 Режим simple: группировка контента по заголовкам h2");
    jsonData = simpleGrouping(parsed);
  } else {
    // Режим default – сборка блоков с перераспределением данных
    jsonData = await assembleBlocks(parsed);
  }

  saveJSON(options.output, jsonData);
  console.log(`✅ JSON сохранён в: ${options.output}`);
})();
