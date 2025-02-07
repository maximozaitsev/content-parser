import fs from "fs";
import path from "path";
import mammoth from "mammoth";

// Функция для обработки форматирования Markdown (жирный текст)
function convertMarkdownFormatting(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"); // Преобразуем **жирный текст** в <strong>
}

// Функция парсинга Markdown
export function parseMarkdownToJSON(content: string) {
  const data: any = { title: "", intro: [], sections: [] };
  let currentSection: string | null = null;
  let sectionContent: any[] = [];
  let listBlock: any = null;
  let inIntro = true; // Всё, что перед `h2`, попадает в `intro`

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      data.title = convertMarkdownFormatting(trimmed.replace("# ", "").trim());
    } else if (trimmed.startsWith("## ")) {
      // Если есть текущая секция, сохраняем её
      if (currentSection) {
        data.sections.push({ title: currentSection, content: sectionContent });
        sectionContent = [];
      }
      currentSection = convertMarkdownFormatting(
        trimmed.replace("## ", "").trim()
      );
      listBlock = null;
      inIntro = false; // Теперь контент идёт в sections
    } else if (trimmed.startsWith("### ")) {
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

  // Добавляем последнюю секцию
  if (currentSection) {
    data.sections.push({ title: currentSection, content: sectionContent });
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
