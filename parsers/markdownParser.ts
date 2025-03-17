import fs from "fs";
import path from "path";
import mammoth from "mammoth";
import readline from "readline";

// Функция для обработки форматирования Markdown (жирный текст)
function convertMarkdownFormatting(text: string): string {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\\-(?=\s|$)/g, "-");
}

// Список возможных заголовков для Advantages
const ADVANTAGES_KEYWORDS = [
  "Advantages",
  "Ventajas",
  "Vorteile",
  "Avantages",
  "Fördelar",
];

// Список ключевых слов для определения блока games-to-play (на английском, испанском, немецком, французском, шведском)
const GAMES_KEYWORDS = ["Games", "Juegos", "Spiele", "Jeux", "Spel"];

// Список ключевых слов для определения блока bonuses-and-promotions (ищем корень "bonus" или "promo" в любом регистре)
const BONUS_KEYWORDS = ["bonus", "promo"];

// Список ключевых слов для определения блока support (на английском, испанском, немецком, французском)
const SUPPORT_KEYWORDS = ["support", "soporte", "unterstützung", "soutien"];

/**
 * Функция парсинга Markdown.
 * Возвращает объект вида:
 * {
 *   data: { title, intro, about, advantages, sections, "games-to-play", "bonuses-and-promotions", support, faq },
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
    // Блоки "games-to-play", "bonuses-and-promotions", "support" и "faq" будут добавлены после парсинга
  };

  let currentSection: string | null = null;
  let sectionContent: any[] = [];
  let listBlock: any = null;
  let inIntro = true;
  // Режимы: "about", "advantages", "sections"
  let currentMode: "about" | "advantages" | "sections" = "about";
  // Массив для хранения h2-заголовков в порядке появления
  const h2Headers: string[] = [];

  // Локальная переменная для сохранения первых двух параграфов (не используется в итоговом JSON)
  const skippedParagraphs: string[] = [];
  let foundH1 = false;

  const lines = content.split("\n");

  for (const line of lines) {
    const trimmed = line.trim();

    // Если h1 еще не найден и строка не начинается с h1,
    // сохраняем первые два непустых параграфа и пропускаем их обработку
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
      // Определяем, нужно ли менять режим
      if (
        ADVANTAGES_KEYWORDS.some((keyword) =>
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
      // Сбрасываем текущий раздел
      currentSection = sectionTitle;
      sectionContent = [];
      listBlock = null;
      inIntro = false;
    } else if (trimmed.startsWith("### ")) {
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
 * Функция для запроса ввода у пользователя через консоль.
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
 * Основная логика:
 * 1. Парсинг Markdown и разделение на блоки about, advantages, sections, support, faq, games-to-play, bonuses-and-promotions.
 * 2. После формирования блока "bonuses-and-promotions" (который извлекается из sections), считаем, что:
 *    - Deposit – это первый заголовок h2 после заголовка, принятого за bonuses-and-promotions.
 *      В этом заголовке должно встречаться слово с корнем "deposit" (чтобы охватить варианты deposits)
 *      или его аналог на испанском, немецком, французском языках.
 *      Если условие не выполняется, запрашиваем у пользователя нужное название.
 *    - Withdrawal – это следующий заголовок (второй после бонусного),
 *      в котором должно встречаться слово с корнем "withdrawal" (или его аналог).
 *      Если условие не выполняется, запрашиваем у пользователя.
 *    Эти разделы сразу записываются в about (то есть, не попадают в sections).
 * 3. Остальные блоки остаются без изменений.
 * 4. Итоговая структура JSON имеет порядок ключей:
 *    title, intro, about, advantages, "games-to-play", "bonuses-and-promotions", support, faq.
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
  const { data, h2Headers, currentMode } = parseMarkdownToJSON(content);

  // Если режим "about" и заголовков >= 3, предлагаем вручную разделить about/advantages/sections.
  if (currentMode === "about" && h2Headers.length >= 3) {
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
  const sectionsHeaders = Object.keys(data.sections);
  if (sectionsHeaders.length > 0) {
    let candidate = sectionsHeaders[0];
    const candidateLower = candidate.toLowerCase();
    let isGamesCandidate = GAMES_KEYWORDS.some((keyword) =>
      candidateLower.includes(keyword.toLowerCase())
    );
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

  // --- Блок: распределение Deposit и Withdrawal в about ---
  // Согласно требованиям, Deposit – это первый h2 после бонусного блока, а Withdrawal – следующий.
  // Если bonuses-and-promotions существует, используем его заголовок для определения порядка.
  if (
    data["bonuses-and-promotions"] &&
    Object.keys(data["bonuses-and-promotions"]).length > 0
  ) {
    const bonusHeading = Object.keys(data["bonuses-and-promotions"])[0];
    const bonusIndex = h2Headers.indexOf(bonusHeading);
    if (bonusIndex !== -1 && bonusIndex + 1 < h2Headers.length) {
      // Deposit – следующий заголовок
      let depositHeading = h2Headers[bonusIndex + 1];
      const lowerDeposit = depositHeading.toLowerCase();
      const isDeposit = [
        "deposit",
        "depósito",
        "dépôt",
        "einzahlung",
        "insättningsmetoder",
      ].some((kw) => lowerDeposit.includes(kw));
      if (!isDeposit) {
        depositHeading = await askUserForHeader(
          h2Headers,
          "\nВведите заголовок для Deposit, содержащий слово с корнем 'deposit' (или его аналог): "
        );
      }
      if (data.sections[depositHeading]) {
        data.about[depositHeading] = data.sections[depositHeading];
        delete data.sections[depositHeading];
      }
      // Withdrawal – следующий за Deposit
      if (bonusIndex + 2 < h2Headers.length) {
        let withdrawalHeading = h2Headers[bonusIndex + 2];
        const lowerWithdrawal = withdrawalHeading.toLowerCase();
        const isWithdrawal = [
          "withdrawal",
          "retiro",
          "retrait",
          "abhebung",
          "uttag",
        ].some((kw) => lowerWithdrawal.includes(kw));
        if (!isWithdrawal) {
          withdrawalHeading = await askUserForHeader(
            h2Headers,
            "\nВведите заголовок для Withdrawal, содержащий слово с корнем 'withdrawal' (или его аналог): "
          );
        }
        if (data.sections[withdrawalHeading]) {
          data.about[withdrawalHeading] = data.sections[withdrawalHeading];
          delete data.sections[withdrawalHeading];
        }
      }
    } else {
      console.log(
        "Не удалось определить Deposit и Withdrawal, так как после бонусного раздела нет достаточного количества заголовков."
      );
    }
  } else {
    console.log(
      "Блок bonuses-and-promotions не найден, невозможно автоматически определить Deposit и Withdrawal."
    );
  }
  // --- Конец блока распределения Deposit и Withdrawal ---

  // --- Блок: выделение "support" ---
  const supportCandidates = Object.keys(data.sections).filter((header) =>
    SUPPORT_KEYWORDS.some((keyword) =>
      header.toLowerCase().includes(keyword.toLowerCase())
    )
  );
  let supportCandidate: string | null = null;
  if (supportCandidates.length >= 2) {
    supportCandidate = supportCandidates[supportCandidates.length - 2];
  } else if (supportCandidates.length === 1) {
    supportCandidate = supportCandidates[0];
  } else {
    const sectionsHeadersForSupport = Object.keys(data.sections);
    if (sectionsHeadersForSupport.length > 0) {
      const userSupportHeader = await askUserForHeader(
        sectionsHeadersForSupport,
        "\nВ разделе sections не найден заголовок, содержащий слово 'support' (или его аналог).\nВыберите заголовок, который нужно принять за блок support: "
      );
      if (sectionsHeadersForSupport.includes(userSupportHeader)) {
        supportCandidate = userSupportHeader;
      }
    }
  }
  if (supportCandidate) {
    data.support = { [supportCandidate]: data.sections[supportCandidate] };
    delete data.sections[supportCandidate];
  } else {
    console.log("Подходящий заголовок для 'support' не найден.");
    data.support = {};
  }
  // --- Конец блока support ---

  // --- Блок: выделение "faq" ---
  let faqCandidate: string | null = null;
  for (let i = h2Headers.length - 1; i >= 0; i--) {
    const header = h2Headers[i];
    if (header.toLowerCase().includes("faq") && header in data.sections) {
      faqCandidate = header;
      break;
    }
  }
  if (!faqCandidate) {
    const sectionsHeadersForFaq = Object.keys(data.sections);
    if (sectionsHeadersForFaq.length > 0) {
      const userFaqHeader = await askUserForHeader(
        sectionsHeadersForFaq,
        "\nВ разделе sections не найден заголовок, содержащий слово 'faq'.\nВыберите заголовок, который нужно принять за блок faq: "
      );
      if (sectionsHeadersForFaq.includes(userFaqHeader)) {
        faqCandidate = userFaqHeader;
      }
    }
  }
  if (faqCandidate) {
    data.faq = { [faqCandidate]: data.sections[faqCandidate] };
    delete data.sections[faqCandidate];
  } else {
    console.log("Подходящий заголовок для 'faq' не найден.");
    data.faq = {};
  }
  // --- Конец блока faq ---

  // --- Перестановка ключей ---
  // Итоговый объект с нужным порядком ключей:
  // title, intro, about, advantages, "games-to-play", "bonuses-and-promotions", support, faq, sections
  const orderedData = {
    title: data.title,
    intro: data.intro,
    about: data.about,
    advantages: data.advantages,
    "games-to-play": data["games-to-play"] || {},
    "bonuses-and-promotions": data["bonuses-and-promotions"] || {},
    support: data.support || {},
    faq: data.faq || {},
    sections: data.sections,
  };

  return orderedData;
}
