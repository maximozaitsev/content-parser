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

// Список ключевых слов для определения блока games-to-play (на английском, испанском, немецком, французском)
const GAMES_KEYWORDS = ["Games", "Juegos", "Spiele", "Jeux"];

// Список ключевых слов для определения блока bonuses-and-promotions (ищем корень "bonus" или "promo" в любом регистре)
const BONUS_KEYWORDS = ["bonus", "promo"];

/**
 * Функция парсинга Markdown.
 * Возвращает объект вида:
 * {
 *   data: { title, intro, about, advantages, sections, "games-to-play", "bonuses-and-promotions" },
 *   h2Headers: string[] // список всех h2 в порядке появления
 * }
 */
export function parseMarkdownToJSON(content: string) {
  // Инициализируем итоговую структуру данных
  const data: any = {
    title: "",
    intro: [],
    about: {},
    advantages: {},
    sections: {},
    // блоки "games-to-play" и "bonuses-and-promotions" будут добавлены после парсинга
  };

  let currentSection: string | null = null;
  let sectionContent: any[] = [];
  let listBlock: any = null;
  let inIntro = true;
  // Режимы: "about", "advantages", "sections"
  let currentMode: "about" | "advantages" | "sections" = "about";
  // Массив для хранения h2-заголовков в порядке появления
  const h2Headers: string[] = [];

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    if (trimmed.startsWith("# ")) {
      // Заголовок первого уровня используется как title
      data.title = convertMarkdownFormatting(trimmed.replace("# ", "").trim());
    } else if (trimmed.startsWith("## ")) {
      // Сохраняем предыдущую секцию (если она есть) в соответствующий блок
      if (currentSection !== null) {
        if (currentMode === "about") {
          data.about[currentSection] = sectionContent;
        } else if (currentMode === "advantages") {
          data.advantages[currentSection] = sectionContent;
        } else if (currentMode === "sections") {
          data.sections[currentSection] = sectionContent;
        }
      }

      // Получаем текст заголовка h2 и регистрируем его
      const sectionTitle = convertMarkdownFormatting(
        trimmed.replace("## ", "").trim()
      );
      h2Headers.push(sectionTitle);

      // Определяем, нужно ли менять режим в зависимости от наличия ключевых слов для advantages
      if (
        ADVANTAGES_KEYWORDS.some((keyword) =>
          sectionTitle.toLowerCase().includes(keyword.toLowerCase())
        )
      ) {
        // Если до этого были разделы about – переключаемся на advantages
        if (currentMode === "about") {
          currentMode = "advantages";
        }
        // Если уже в advantages – остаёмся в advantages,
        // а если уже перешли в sections – режим не меняем.
      } else {
        // Если мы находимся в advantages, а встречается заголовок без ключевого слова,
        // значит, блок advantages окончен – переключаемся на sections.
        if (currentMode === "advantages") {
          currentMode = "sections";
        }
      }

      // Устанавливаем текущий заголовок и сбрасываем временное хранилище для контента
      currentSection = sectionTitle;
      sectionContent = [];
      listBlock = null;
      inIntro = false;
    } else if (trimmed.startsWith("### ")) {
      // При встрече заголовка h3 сбрасываем listBlock, чтобы завершить предыдущий список
      listBlock = null;
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
 * Функция для запроса ввода у пользователя через консоль.
 * Можно задать кастомный текст приглашения.
 */
function askUserForHeader(
  availableHeaders: string[],
  promptMsg?: string
): Promise<string> {
  return new Promise((resolve) => {
    console.log("\nДоступные заголовки:");
    availableHeaders.forEach((header, index) => {
      console.log(`${index + 1}. ${header}`);
    });
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(
      promptMsg || "\nВведите заголовок (точно так, как он указан выше): ",
      (answer) => {
        rl.close();
        resolve(answer.trim());
      }
    );
  });
}

/**
 * Функция обработки локального файла.
 * Если при автоматическом разбиении на about/advantages/sections не найдено ни одного h2 с контрольным словом,
 * и обнаружено не менее 3 заголовков, то дополнительно запрашивается у пользователя,
 * с какого заголовка начинать блок advantages и, при возможности, блок sections.
 * После этого, если в блоке sections есть хотя бы один заголовок,
 * пытаемся выделить блок games-to-play как первый h2 из sections,
 * в заголовке которого встречается слово Games (или его аналог).
 * Если автоматическое определение не срабатывает, выводим список заголовков и просим выбрать один.
 * Далее аналогичным образом выделяем блок bonuses-and-promotions,
 * ищем в заголовке слово с корнем "bonus" или "promo" (на разных языках).
 * В итоговой структуре JSON мы затем создаём новый объект, где ключ "games-to-play" располагается над "sections",
 * а ключ "bonuses-and-promotions" — под "games-to-play".
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

  // Первоначальный парсинг Markdown
  const { data, h2Headers, currentMode } = parseMarkdownToJSON(content);

  // Если ни один h2 не перевёл режим в advantages (все разделы оказались в about)
  // и обнаружено не менее 3 заголовков, то предлагаем вручную разделить контент на about, advantages и sections.
  if (currentMode === "about" && h2Headers.length >= 3) {
    // Запрос для выбора заголовка, с которого начать блок advantages
    const userAdvHeader = await askUserForHeader(
      h2Headers,
      "\nНе найден заголовок с контрольным словом.\nВведите заголовок, с которого нужно начать блок advantages: "
    );
    const indexAdvantage = h2Headers.indexOf(userAdvHeader);
    if (indexAdvantage === -1) {
      console.log(
        `Введённый заголовок "${userAdvHeader}" не найден. Структура останется без изменений.`
      );
    } else {
      // Если после выбранного для advantages ещё имеются заголовки – запрашиваем заголовок начала sections
      let indexSection = -1;
      if (indexAdvantage < h2Headers.length - 1) {
        const availableForSections = h2Headers.slice(indexAdvantage + 1);
        const userSecHeader = await askUserForHeader(
          availableForSections,
          "\nВведите заголовок, с которого нужно начать блок sections: "
        );
        indexSection = h2Headers.indexOf(userSecHeader);
        if (indexSection === -1) {
          console.log(
            `Введённый заголовок "${userSecHeader}" не найден. Все разделы после выбранного будут отнесены к advantages.`
          );
        }
      }
      // Перераспределяем разделы из data.about в новые блоки
      const newAbout: any = {};
      const newAdvantages: any = {};
      const newSections: any = {};
      h2Headers.forEach((header, i) => {
        if (i < indexAdvantage) {
          newAbout[header] = data.about[header];
        } else if (indexSection !== -1 && i >= indexSection) {
          newSections[header] = data.about[header];
        } else {
          newAdvantages[header] = data.about[header];
        }
      });
      data.about = newAbout;
      data.advantages = newAdvantages;
      data.sections = newSections;
    }
  }

  // --- Блок: выделение "games-to-play" ---
  // Пытаемся определить блок games-to-play как первый h2 из data.sections,
  // в заголовке которого встречается одно из ключевых слов GAMES_KEYWORDS.
  const sectionsHeaders = Object.keys(data.sections);
  if (sectionsHeaders.length > 0) {
    // Берём первый заголовок из раздела sections как кандидата
    let candidate = sectionsHeaders[0];
    const candidateLower = candidate.toLowerCase();
    let isGamesCandidate = GAMES_KEYWORDS.some((keyword) =>
      candidateLower.includes(keyword.toLowerCase())
    );
    // Если первый заголовок не подходит, просим пользователя выбрать из списка
    if (!isGamesCandidate) {
      const userGamesHeader = await askUserForHeader(
        sectionsHeaders,
        "\nВ разделе sections не найден заголовок, содержащий слово 'Games' (или его аналог).\nВыберите заголовок, который нужно принять за блок games-to-play: "
      );
      if (sectionsHeaders.includes(userGamesHeader)) {
        candidate = userGamesHeader;
        isGamesCandidate = true;
      }
    }
    if (isGamesCandidate) {
      // Переносим найденный раздел из sections в новый блок "games-to-play"
      // При этом создаём объект, где ключ – это заголовок h2 (candidate)
      data["games-to-play"] = { [candidate]: data.sections[candidate] };
      delete data.sections[candidate];
    } else {
      console.log(
        "Подходящий заголовок для 'games-to-play' не найден в разделе sections."
      );
      data["games-to-play"] = {};
    }
  } else {
    data["games-to-play"] = {};
  }
  // --- Конец блока games-to-play ---

  // --- Блок: выделение "bonuses-and-promotions" ---
  // Пытаемся определить блок bonuses-and-promotions как первый h2 из data.sections,
  // в заголовке которого встречается одно из ключевых слов BONUS_KEYWORDS.
  const sectionsHeadersAfterGames = Object.keys(data.sections);
  if (sectionsHeadersAfterGames.length > 0) {
    let candidateBonus = sectionsHeadersAfterGames[0];
    const candidateBonusLower = candidateBonus.toLowerCase();
    let isBonusCandidate = BONUS_KEYWORDS.some((keyword) =>
      candidateBonusLower.includes(keyword.toLowerCase())
    );
    if (!isBonusCandidate) {
      const userBonusHeader = await askUserForHeader(
        sectionsHeadersAfterGames,
        "\nВ разделе sections не найден заголовок, содержащий слово 'bonus' или 'promo' (или его аналог).\nВыберите заголовок, который нужно принять за блок bonuses-and-promotions: "
      );
      if (sectionsHeadersAfterGames.includes(userBonusHeader)) {
        candidateBonus = userBonusHeader;
        isBonusCandidate = true;
      }
    }
    if (isBonusCandidate) {
      data["bonuses-and-promotions"] = {
        [candidateBonus]: data.sections[candidateBonus],
      };
      delete data.sections[candidateBonus];
    } else {
      console.log(
        "Подходящий заголовок для 'bonuses-and-promotions' не найден в разделе sections."
      );
      data["bonuses-and-promotions"] = {};
    }
  } else {
    data["bonuses-and-promotions"] = {};
  }
  // --- Конец блока bonuses-and-promotions ---

  // --- Перестановка ключей ---
  // Создаем итоговый объект с нужным порядком ключей:
  // title, intro, about, advantages, games-to-play, bonuses-and-promotions, sections
  const orderedData = {
    title: data.title,
    intro: data.intro,
    about: data.about,
    advantages: data.advantages,
    "games-to-play": data["games-to-play"],
    "bonuses-and-promotions": data["bonuses-and-promotions"],
    sections: data.sections,
  };

  return orderedData;
}
