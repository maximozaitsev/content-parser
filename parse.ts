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
  .option(
    "--mode <mode>",
    'Режим работы: "default" (по умолчанию) или "simple"',
    "default"
  )
  .parse(process.argv);

const options = program.opts();

// Убеждаемся, что необходимые директории существуют
ensureDirectories();

// Функция для режима simple – группировка контента по заголовкам h2 с сохранением h1 и вводного контента
function simpleGrouping(parsed: { data: any }): any {
  const result: any = {
    title: parsed.data.title || "",
    intro: parsed.data.intro || [],
    content: {},
  };

  // Объединяем блоки, сформированные базовым парсингом (about, advantages, sections)
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
  console.log("📂 Обрабатываем локальный файл...");

  // Базовый парсинг: parseFile возвращает объект с ключами data, h2Headers и currentMode
  const parsed = await parseFile(options.file);
  if (!parsed) process.exit(1);

  let jsonData;
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
