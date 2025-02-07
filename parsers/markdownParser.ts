import fs from "fs";
import path from "path";
import mammoth from "mammoth";

// Функция для обработки форматирования Markdown (жирный текст)
function convertMarkdownFormatting(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

// Список возможных заголовков для Advantages
const ADVANTAGES_KEYWORDS = ["Advantages", "Ventajas", "Vorteile", "Avantages"];

// Функция парсинга Markdown
export function parseMarkdownToJSON(content: string) {
  const data: any = { title: "", intro: [], about: {}, sections: {} };
  let currentSection: string | null = null;
  let sectionContent: any[] = [];
  let listBlock: any = null;
  let inIntro = true;
  // Используем переменную currentMode, которая может быть "about" или "sections"
  let currentMode: "about" | "sections" = "about";

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      // Заголовок первого уровня используется как title
      data.title = convertMarkdownFormatting(trimmed.replace("# ", "").trim());
    } else if (trimmed.startsWith("## ")) {
      // При встрече нового заголовка h2 сохраняем предыдущую секцию, если она существует
      if (currentSection !== null) {
        if (currentMode === "about") {
          data.about[currentSection] = sectionContent;
        } else {
          data.sections[currentSection] = sectionContent;
        }
      }

      // Получаем текст заголовка h2
      const sectionTitle = convertMarkdownFormatting(
        trimmed.replace("## ", "").trim()
      );

      // Если ещё в режиме about и встречен заголовок с ключевым словом, переключаемся в sections
      if (
        currentMode === "about" &&
        ADVANTAGES_KEYWORDS.some((keyword) =>
          sectionTitle.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        currentMode = "sections";
      }

      // Устанавливаем текущий заголовок и сбрасываем временное хранилище для контента
      currentSection = sectionTitle;
      sectionContent = [];
      listBlock = null;
      inIntro = false;
    } else if (trimmed.startsWith("### ")) {
      // Заголовки h3
      sectionContent.push({
        type: "heading",
        level: 3,
        text: convertMarkdownFormatting(trimmed.replace("### ", "").trim()),
      });
    } else if (
      /^\d+\./.test(trimmed) ||
      trimmed.startsWith("* ") ||
      trimmed.startsWith("- ")
    ) {
      // Обработка списков
      const itemText = convertMarkdownFormatting(
        trimmed.replace(/^\d+\.\s*|\*\s*|- /, "").trim()
      );
      if (!listBlock) {
        listBlock = {
          type: "list",
          style: /^\d+\./.test(trimmed) ? "ordered" : "unordered",
          items: [],
        };
        if (inIntro) {
          data.intro.push(listBlock);
        } else {
          sectionContent.push(listBlock);
        }
      }
      listBlock.items.push(itemText);
    } else if (trimmed) {
      // Обработка параграфов
      const paragraph = {
        type: "paragraph",
        text: convertMarkdownFormatting(trimmed),
      };
      if (inIntro) {
        data.intro.push(paragraph);
      } else {
        sectionContent.push(paragraph);
      }
      listBlock = null;
    }
  }

  // Сохраняем последнюю секцию, если она существует
  if (currentSection !== null) {
    if (currentMode === "about") {
      data.about[currentSection] = sectionContent;
    } else {
      data.sections[currentSection] = sectionContent;
    }
  }

  return data;
}

// Функция обработки локального файла
export async function parseFile(filePath: string): Promise<any> {
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
