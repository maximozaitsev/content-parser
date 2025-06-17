// assembleBlocks.ts
import readline from "readline";

const ADVANTAGES_KEYWORDS = [
  "Advantages",
  "Ventajas",
  "Vorteile",
  "Avantages",
  "Fördelar",
];
const GAMES_KEYWORDS = ["Games", "Game", "Juegos", "Spiele", "Jeux", "Spel"];
const BONUS_KEYWORDS = ["bonus", "promo"];
const SUPPORT_KEYWORDS = ["support", "soporte", "unterstützung", "soutien"];

/**
 * Запрос ввода у пользователя через консоль с отображением доступных заголовков.
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
 * Функция сборки итоговой структуры из результата базового парсинга.
 * Производит перераспределение разделов и формирует итоговый объект с требуемым порядком ключей.
 */
export async function assembleBlocks(parsed: {
  data: any;
  h2Headers: string[];
  currentMode: string;
}) {
  const { data, h2Headers, currentMode } = parsed;

  // --- Блок: разделение about/advantages/sections ---
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

  // --- Блок: распределение Deposit и Withdrawal в about ---
  if (
    data["bonuses-and-promotions"] &&
    Object.keys(data["bonuses-and-promotions"]).length > 0
  ) {
    const bonusHeading = Object.keys(data["bonuses-and-promotions"])[0];
    const bonusIndex = h2Headers.indexOf(bonusHeading);
    if (bonusIndex !== -1 && bonusIndex + 1 < h2Headers.length) {
      let depositHeading = h2Headers[bonusIndex + 1];
      const lowerDeposit = depositHeading.toLowerCase();
      const isDeposit = [
        "deposit",
        "depositing",
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
      if (bonusIndex + 2 < h2Headers.length) {
        let withdrawalHeading = h2Headers[bonusIndex + 2];
        const lowerWithdrawal = withdrawalHeading.toLowerCase();
        const isWithdrawal = [
          "withdrawal",
          "withdrawing",
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

  // --- Итоговая сборка: упорядочиваем ключи ---
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
