import fs from "fs";
import path from "path";
import axios from "axios";
import TurndownService from "turndown";
import mammoth from "mammoth";
import { Command } from "commander";

// Инициализация CLI
const program = new Command();
program
  .version("1.1.0")
  .description("Парсер About-секции")
  .option("-f, --file <file>", "Парсинг локального файла (.md, .docx)")
  .option("-u, --url <url>", "Парсинг Google Docs")
  .option(
    "-o, --output <file>",
    "Выходной JSON-файл",
    "content/output/about.json"
  )
  .parse(process.argv);

const options = program.opts();

// Пути к папкам
const INPUT_DIR = path.join(__dirname, "../content/input");
const OUTPUT_DIR = path.join(__dirname, "../content/output");

// Создаём output-папку, если её нет
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Функция парсинга Markdown в JSON
function parseMarkdownToJSON(content: string) {
  const data: any = { title: "", sections: [] };
  let currentSection: string | null = null;
  let sectionContent: any[] = [];
  let listBlock: any = null;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      data.title = trimmed.replace("# ", "").trim();
    } else if (trimmed.startsWith("## ")) {
      if (currentSection) {
        data.sections.push({ title: currentSection, content: sectionContent });
        sectionContent = [];
      }
      currentSection = trimmed.replace("## ", "").trim();
      listBlock = null;
    } else if (/^\d+\./.test(trimmed) || trimmed.startsWith("* ")) {
      const itemText = trimmed.replace(/^\d+\.\s*|\*\s*/, "").trim();
      if (!listBlock) {
        listBlock = {
          type: "list",
          style: /^\d+\./.test(trimmed) ? "ordered" : "unordered",
          items: [],
        };
        sectionContent.push(listBlock);
      }
      listBlock.items.push(itemText);
    } else if (trimmed) {
      sectionContent.push({ type: "paragraph", text: trimmed });
      listBlock = null;
    }
  }

  if (currentSection) {
    data.sections.push({ title: currentSection, content: sectionContent });
  }

  return data;
}

// Функция загрузки Google Docs
async function fetchGoogleDocs(docUrl: string): Promise<string> {
  try {
    const fileId = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    if (!fileId)
      throw new Error("Неверная ссылка! Убедитесь, что документ публичный.");

    const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=html`;
    const response = await axios.get(exportUrl);

    const turndownService = new TurndownService();
    return turndownService.turndown(response.data);
  } catch (error) {
    console.error("Ошибка загрузки Google Docs:", error);
    process.exit(1);
  }
}

// Функция обработки локального файла
async function parseFile(filePath: string): Promise<any> {
  const ext = path.extname(filePath).toLowerCase();

  if (!fs.existsSync(filePath)) {
    console.error(`Файл не найден: ${filePath}`);
    return null;
  }

  let content = "";

  if (ext === ".md") {
    content = fs.readFileSync(filePath, "utf-8");
  } else if (ext === ".docx") {
    const result = await mammoth.extractRawText({ path: filePath });
    content = result.value;
  } else {
    console.error(`Неподдерживаемый формат: ${filePath}`);
    return null;
  }

  return parseMarkdownToJSON(content);
}

// Запуск парсера
(async function main() {
  let jsonData;

  if (options.url) {
    console.log("🌍 Загружаем Google Docs...");
    const content = await fetchGoogleDocs(options.url);
    jsonData = parseMarkdownToJSON(content);
  } else if (options.file) {
    console.log("📂 Обрабатываем локальный файл...");
    jsonData = await parseFile(options.file);
  } else {
    console.error("❌ Укажите --url или --file");
    process.exit(1);
  }

  fs.writeFileSync(options.output, JSON.stringify(jsonData, null, 2), "utf-8");
  console.log(`✅ JSON сохранён в: ${options.output}`);
})();
