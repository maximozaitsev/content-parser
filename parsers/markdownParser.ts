import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import readline from "readline";

// Функция для обработки форматирования Markdown (жирный текст)
function convertMarkdownFormatting(text: string): string {
  return text.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");
}

// Список возможных заголовков для Advantages
const ADVANTAGES_KEYWORDS = ["Advantages", "Ventajas", "Vorteile", "Avantages"];

// Функция парсинга Markdown.
// В дополнение к объекту data возвращаем также список h2-заголовков и текущий режим.
export function parseMarkdownToJSON(content: string) {
  const data: any = { title: "", intro: [], about: {}, sections: {} };
  let currentSection: string | null = null;
  let sectionContent: any[] = [];
  let listBlock: any = null;
  let inIntro = true;
  // Режим: "about" до тех пор, пока не найден заголовок с контрольным словом, затем "sections"
  let currentMode: "about" | "sections" = "about";
  // Массив для хранения h2-заголовков в порядке появления
  const h2Headers: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      // Заголовок первого уровня используется как title
      data.title = convertMarkdownFormatting(trimmed.replace("# ", "").trim());
    } else if (trimmed.startsWith("## ")) {
      // Сохраняем предыдущую секцию, если она существует
      if (currentSection !== null) {
        if (currentMode === "about") {
          data.about[currentSection] = sectionContent;
        } else {
          data.sections[currentSection] = sectionContent;
        }
      }

      // Получаем текст заголовка h2 и регистрируем его в списке
      const sectionTitle = convertMarkdownFormatting(
        trimmed.replace("## ", "").trim()
      );
      h2Headers.push(sectionTitle);

      // Если мы всё ещё в режиме "about" и заголовок содержит одно из ключевых слов,
      // переключаем режим на "sections"
      if (
        currentMode === "about" &&
        ADVANTAGES_KEYWORDS.some((keyword) =>
          sectionTitle.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        currentMode = "sections";
      }

      // Обновляем текущую секцию и сбрасываем временное хранилище для контента
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

  // Возвращаем объект с данными, списком h2-заголовков и текущим режимом
  return { data, h2Headers, currentMode };
}

// Функция для запроса ввода у пользователя через консоль
function askUserForHeader(availableHeaders: string[]): Promise<string> {
  return new Promise((resolve) => {
    console.log(
      "\nНе найден заголовок с контрольным словом.\nДоступные заголовки:"
    );
    availableHeaders.forEach((header, index) =>
      console.log(`${index + 1}. ${header}`)
    );
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      "\nВведите заголовок (точно так, как он указан выше), с которого нужно начать добавлять в sections: ",
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
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

  // Выполняем первоначальный парсинг
  const { data, h2Headers, currentMode } = parseMarkdownToJSON(content);

  // Если после парсинга не найдено контрольное слово (т.е. ни один h2 не перевёл режим в "sections")
  // и найдено как минимум 2 заголовка, запрашиваем у пользователя, с какого заголовка начинать заполнять sections.
  if (currentMode === "about" && h2Headers.length >= 2) {
    const userHeader = await askUserForHeader(h2Headers);
    // Если введённый заголовок найден в списке, перемещаем его и все следующие в sections.
    const index = h2Headers.indexOf(userHeader);
    if (index !== -1) {
      // Для каждого заголовка, начиная с userHeader, переносим контент из about в sections.
      for (let i = index; i < h2Headers.length; i++) {
        const key = h2Headers[i];
        data.sections[key] = data.about[key];
        delete data.about[key];
      }
    } else {
      console.log(
        `Введённый заголовок "${userHeader}" не найден. Структура останется без изменений.`
      );
    }
  }

  return data;
}
