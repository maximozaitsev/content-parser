// assembleBlocks.ts
import readline from "readline";

// Centralized, easily extendable keyword registry
const KEYWORDS = {
  advantages: [
    "Advantages",
    "Ventajas",
    "Vorteile",
    "Avantages",
    "Fördelar",
    "Vantaggi",
    "Vantagens",
    "Zalety",
    "Πλεονεκτήματα",
    "Voordelen",
    "Edut",
    "Fordeler",
    "Avantaje",
  ],
  games: [
    "Games",
    "Game",
    "Juegos",
    "Spiele",
    "Jeux",
    "Spel",
    "Giochi",
    "Jogos",
    "Jogo",
    "Gry",
    "Gra",
    "Spellen",
    "Παιχνίδια",
    "Pelit",
    "Spill",
    "Jocuri",
  ],
  bonus: [
    "bonus",
    "promo",
    "bono",
    "bonos",
    "bonificação",
    "bônus",
    "promoção",
    "promoções",
    "promociones",
    "promozioni",
    "promotions",
    "aktionen",
    "promoties",
    "προσφορές",
    "bonusar",
    "kampanj",
    "kampanjer",
    "bonussen",
    "Bonukset",
    "Tarjoukset",
    "Bonuser",
    "Kampanjer",
    "Bonusuri",
    "Promoții",
  ],
  support: [
    "support",
    "soporte",
    "unterstützung",
    "soutien",
    "asistencia",
    "assistance",
    "assistenza",
    "support",
    "customer support",
    "help",
    "suporte",
    "atendimento",
    "wsparcie",
    "pomoc",
    "ondersteuning",
    "klantenservice",
    "υποστήριξη",
    "στήριξη",
    "kundtjänst",
    "kundsupport",
    "Tuki",
    "Asiakastuki",
    "Kundestøtte",
    "Brukerstøtte",
    "Hjelp",
    "Suport",
    "Asistență clienți",
  ],
  faq: [
    "faq",
    "frequently asked questions",
    "preguntas",
    "preguntas frecuentes",
    "häufig gestellte fragen",
    "questions fréquentes",
    "domande frequenti",
    "perguntas frequentes",
    "najczęściej zadawane pytania",
    "veelgestelde vragen",
    "συχνές ερωτήσεις",
    "vanliga frågor",
    "UKK",
    "Usein kysytyt kysymykset",
    "OSS",
    "Ofte stilte spørsmål",
    "Întrebări frecvente",
  ],
  deposit: [
    "deposit",
    "depositing",
    "depósito",
    "dépôt",
    "einzahlung",
    "insättningsmetoder",
    "insättning",
    "insättningar",
    "deposito",
    "depósito",
    "wpłata",
    "depozyt",
    "storting",
    "storten",
    "κατάθεση",
    "Talletus",
    "Innskudd",
    "Depunere",
  ],
  withdrawal: [
    "withdrawal",
    "withdrawing",
    "retiro",
    "retirada",
    "retrait",
    "abhebung",
    "auszahlungsmethoden",
    "uttag",
    "prelievo",
    "saque",
    "levantamento",
    "wypłata",
    "wycofanie",
    "opname",
    "uitbetaling",
    "ανάληψη",
    "utbetalning",
    "utbetalningar",
    "uttagsmetoder",
    "Nosto",
    "Uttak",
    "Retragere",
  ],
} as const;

function includesAny(haystack: string, needles: readonly string[]) {
  const s = haystack.toLowerCase();
  return needles.some((n) => s.includes(n.toLowerCase()));
}

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

async function moveFirstMatchingSectionToAbout(
  data: any,
  keywords: readonly string[],
  promptText: string
): Promise<string | null> {
  const sectionKeys = Object.keys(data.sections);
  if (sectionKeys.length === 0) return null;

  let heading = sectionKeys.find((h) => includesAny(h, keywords)) || null;
  if (!heading) {
    const userHeader = await askUserForHeader(sectionKeys, `\n${promptText}`);
    if (sectionKeys.includes(userHeader)) heading = userHeader;
  }
  if (heading) {
    data.about[heading] = data.sections[heading];
    delete data.sections[heading];
    return heading;
  }
  return null;
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
    let isGamesCandidate = includesAny(candidate, KEYWORDS.games);
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
    let isBonusCandidate = includesAny(candidateBonus, KEYWORDS.bonus);
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

  // --- Блок: распределение Deposit и Withdrawal в about (без зависимости от бонусного блока) ---
  {
    await moveFirstMatchingSectionToAbout(
      data,
      KEYWORDS.deposit,
      "Введите заголовок для Deposit (или выберите), содержащий слово с корнем 'deposit' (или его аналог): "
    );

    await moveFirstMatchingSectionToAbout(
      data,
      KEYWORDS.withdrawal,
      "Введите заголовок для Withdrawal (или выберите), содержащий слово с корнем 'withdrawal' (или его аналог): "
    );
  }

  // --- Блок: выделение "support" ---
  const supportCandidates = Object.keys(data.sections).filter((header) =>
    includesAny(header, KEYWORDS.support)
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
    const headerLower = header.toLowerCase();
    if (includesAny(header, KEYWORDS.faq) && header in data.sections) {
      faqCandidate = header;
      break;
    }
  }
  if (!faqCandidate) {
    const sectionsHeadersForFaq = Object.keys(data.sections);
    if (sectionsHeadersForFaq.length > 0) {
      const userFaqHeader = await askUserForHeader(
        sectionsHeadersForFaq,
        "\nВ разделе sections не найден заголовок, содержащий 'faq' или 'frequently asked questions'.\nВыберите заголовок, который нужно принять за блок faq: "
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
    "meta-title": data["meta-title"],
    "meta-description": data["meta-description"],
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
