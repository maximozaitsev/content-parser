// markdownParser.ts
import fs from "fs";
import path from "path";
import mammoth from "mammoth";

/**
 * Функция для обработки Markdown-разметки (напр., преобразование **жирного текста**).
 */
function convertMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\\-(?=\s|$)/g, "-");
}

/**
 * Удаляет Markdown-жирный шрифт (**...**) без сохранения тэгов.
 */
function stripBoldMarkdown(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "$1");
}

/**
 * Парсит исходный Markdown (или DOCX через mammoth) в базовую JSON-структуру.
 * Возвращает объект вида:
 * { data, h2Headers, currentMode }
 */
export function parseMarkdownToJSON(content: string) {
  const data: any = {
    title: "",
    intro: [],
    about: {},
    advantages: {},
    sections: {},
  };

  let currentSection: string | null = null;
  let sectionContent: any[] = [];
  let listBlock: any = null;
  let inIntro = true;
  let currentMode: "about" | "advantages" | "sections" = "about";
  const h2Headers: string[] = [];
  const skippedParagraphs: string[] = [];
  let foundH1 = false;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Если еще не найден заголовок h1, пропускаем первые непустые параграфы
    if (!foundH1 && !trimmed.startsWith("# ")) {
      if (trimmed) {
        if (skippedParagraphs.length < 2) {
          skippedParagraphs.push(convertMarkdownFormatting(trimmed));
        }
        continue;
      }
    }

    if (trimmed.startsWith("# ")) {
      foundH1 = true;
      // Заголовок первого уровня используем как title
      data.title = stripBoldMarkdown(trimmed.replace("# ", "").trim());
    } else if (trimmed.startsWith("## ")) {
      // Сохраняем предыдущую секцию (если она есть)
      if (currentSection !== null) {
        if (currentMode === "about") {
          data.about[currentSection] = sectionContent;
        } else if (currentMode === "advantages") {
          data.advantages[currentSection] = sectionContent;
        } else if (currentMode === "sections") {
          data.sections[currentSection] = sectionContent;
        }
      }
      // Новый заголовок h2
      const sectionTitle = stripBoldMarkdown(trimmed.replace("## ", "").trim());
      h2Headers.push(sectionTitle);

      // Определяем изменение режима в зависимости от ключевых слов
      const advantagesKeywords = [
        "Advantages",
        "Ventajas",
        "Vorteile",
        "Avantages",
        "Fördelar",
      ];
      if (
        advantagesKeywords.some((keyword) =>
          sectionTitle.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        if (currentMode === "about") {
          currentMode = "advantages";
        }
      } else {
        if (currentMode === "advantages") {
          currentMode = "sections";
        }
      }
      currentSection = sectionTitle;
      sectionContent = [];
      listBlock = null;
      inIntro = false;
    } else if (trimmed.startsWith("### ")) {
      listBlock = null;
      sectionContent.push({
        type: "heading",
        level: 3,
        text: stripBoldMarkdown(trimmed.replace("### ", "").trim()),
      });
    } else if (
      /^\d+\./.test(trimmed) ||
      trimmed.startsWith("* ") ||
      trimmed.startsWith("- ")
    ) {
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
  // Сохраняем последнюю секцию
  if (currentSection !== null) {
    if (currentMode === "about") {
      data.about[currentSection] = sectionContent;
    } else if (currentMode === "advantages") {
      data.advantages[currentSection] = sectionContent;
    } else if (currentMode === "sections") {
      data.sections[currentSection] = sectionContent;
    }
  }
  return { data, h2Headers, currentMode };
}

/**
 * Функция для обработки локального файла (Markdown или DOCX).
 */
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
  // Просто возвращаем результат базового парсинга
  return parseMarkdownToJSON(content);
}
