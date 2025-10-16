// markdownParserMulti.ts
import fs from "fs";
import path from "path";
import readline from "readline";
import { replaceCurrentYearWithPlaceholder } from "../utils/yearReplacer";

/**
 * Структуры данных для мультистраничного сайта
 */
export interface Block {
  type: "paragraph" | "heading" | "list";
  text?: string;
  level?: number;
  style?: "ordered" | "unordered";
  items?: string[];
}

export interface PageData {
  title: string;
  description: string;
  blocks: Block[];
}

export interface SiteData {
  home: PageData;
  games: PageData;
  bonus: PageData;
  app: PageData;
  login: PageData;
}

/**
 * Определяет slug страницы по ключевым словам в заголовке
 */
function detectSlug(title: string, isFirst: boolean): keyof SiteData {
  const lower = title.toLowerCase();
  if (isFirst) {
    return "home";
  }
  // Mobile and website pages should be detected before games
  if (
    lower.includes("app") ||
    lower.includes("website") ||
    lower.includes("mobile")
  ) {
    return "app";
  }
  if (lower.includes("games") || lower.includes("game")) {
    return "games";
  }
  if (lower.includes("login")) {
    return "login";
  }
  if (lower.includes("bonus")) {
    return "bonus";
  }
  console.warn(`Unknown page type for title "${title}", defaulting to home`);
  return "home";
}

// Регэксы для метаданных (поддерживают Title, Meta-Title, SEO-Title и их вариации, универсальная форма)
export const titlePattern =
  /^(?:\*\*?)?\s*(?:meta[\s-]*|seo[\s-]*|)\s*title\s*(?:\*\*?)?\s*:\s*(.+)$/i;
export const descPattern =
  /^(?:\*\*?)?\s*(?:meta[\s-]*|seo[\s-]*|)\s*description\s*(?:\*\*?)?\s*:\s*(.+)$/i;

/**
 * Удаляет Markdown-картинки из текста
 */
function removeImages(content: string): string {
  return content.replace(/!\[[^]*?\]\([^)]*?\)/g, "");
}

/**
 * Парсит сырые строки в блоки (paragraph и list)
 */
function parseBlocks(lines: string[]): Block[] {
  const blocks: Block[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let listBlock: Block | null = null;

  for (let raw of lines) {
    const trimmed = raw.trim();
    // skip empty headings like "#", "##", "###"
    if (/^#{1,6}\s*$/.test(trimmed)) {
      listBlock = null;
      continue;
    }
    if (!trimmed) {
      listBlock = null;
      continue;
    }
    // Список
    if (/^\d+\./.test(trimmed) || /^[*\-]\s+/.test(trimmed)) {
      const isOrdered = /^\d+\./.test(trimmed);
      let text = trimmed.replace(/^\d+\.|^[*\-]\s+/, "").trim();
      text = text.replace(boldRegex, "<strong>$1</strong>");
      text = text.replace(/\\/g, "");
      text = replaceCurrentYearWithPlaceholder(text);
      if (!listBlock) {
        listBlock = {
          type: "list",
          style: isOrdered ? "ordered" : "unordered",
          items: [],
        };
        blocks.push(listBlock);
      }
      listBlock.items!.push(text);
      continue;
    }
    // Заголовки H1–H6
    const hMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);
    if (hMatch) {
      listBlock = null;
      // strip bold from headings
      const rawHeading = hMatch[2].trim();
      const cleanHeading = replaceCurrentYearWithPlaceholder(
        rawHeading
          .replace(boldRegex, "$1")
          .replace(/\\/g, "")
      );
      blocks.push({
        type: "heading",
        level: hMatch[1].length,
        text: cleanHeading,
      });
      continue;
    }
    // Параграф
    // inline bold to <strong> in paragraphs
    const paraText = replaceCurrentYearWithPlaceholder(
      trimmed
        .replace(boldRegex, "<strong>$1</strong>")
        .replace(/\\/g, "")
    );
    blocks.push({ type: "paragraph", text: paraText });
    listBlock = null;
  }

  // Merge consecutive list blocks of the same style into one
  const mergedBlocks: Block[] = [];
  for (const block of blocks) {
    if (
      block.type === "list" &&
      mergedBlocks.length > 0 &&
      mergedBlocks[mergedBlocks.length - 1].type === "list" &&
      mergedBlocks[mergedBlocks.length - 1].style === block.style
    ) {
      // Append items to the previous list
      mergedBlocks[mergedBlocks.length - 1].items = (
        mergedBlocks[mergedBlocks.length - 1].items || []
      ).concat(block.items || []);
    } else {
      mergedBlocks.push(block);
    }
  }
  return mergedBlocks;
}

/**
 * Извлекает метаданные (Title + Description) над H1 заголовком
 */
function extractMetadataAboveH1(lines: string[], h1Pos: number): { title: string; description: string } | null {
  let titleLine = "";
  let descLine = "";
  
  for (let k = h1Pos - 1; k >= 0; k--) {
    if (!descLine) {
      const d = lines[k].match(descPattern);
      if (d) {
        descLine = d[1].trim();
        continue;
      }
    }
    if (!titleLine) {
      const t = lines[k].match(titlePattern);
      if (t) {
        titleLine = t[1].trim();
        break;
      }
    }
  }
  
  if (titleLine && descLine) {
    const cleanTitle = titleLine
      .replace(/^\*{1,2}\s*/, "")
      .replace(/\s*\*{1,2}$/, "")
      .replace(/\\/g, "")
      .trim();
    const cleanDesc = descLine
      .replace(/^\*{1,2}\s*/, "")
      .replace(/\s*\*{1,2}$/, "")
      .replace(/\\/g, "")
      .trim();
    return { title: cleanTitle, description: cleanDesc };
  }
  return null;
}

/**
 * Извлекает контент под H1 до следующего H1 или конца файла
 */
function extractContentUnderH1(lines: string[], h1Pos: number): string[] {
  const content: string[] = [];
  for (let i = h1Pos; i < lines.length; i++) {
    // Если встретили следующий H1, останавливаемся
    if (i > h1Pos && lines[i] && lines[i].match(/^#\s+/)) {
      break;
    }
    content.push(lines[i]);
  }
  return content;
}

/**
 * Основной парсер: из Markdown-строки собирает SiteData
 */
export async function parseMarkdownToSiteData(
  content: string
): Promise<SiteData> {
  // ЭТАП 1: Подготовка и очистка
  const cleaned = removeImages(content);
  const lines = cleaned.split(/\r?\n/);

  // Найти все H1 заголовки и их позиции
  const h1Positions: number[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^#\s+/)) {
      h1Positions.push(i);
    }
  }
  console.log(`DEBUG: Found ${h1Positions.length} H1 headings at lines:`, h1Positions.map(p => p + 1));

  // ЭТАП 2: Классификация кейса
  const h1Count = h1Positions.length;
  const requiredSlugs: (keyof SiteData)[] = ["home", "games", "app", "bonus", "login"];
  
  interface MetaPos {
    slug: keyof SiteData;
    title: string;
    description: string;
    h1Index: number;
  }
  
  let metas: MetaPos[] = [];

  // ЭТАП 3: Автодетект (КЕЙС 1) - только если 5 заголовков
  if (h1Count === 5) {
    console.log("DEBUG: Case 1/2 - 5 headers found, trying automatic detection");
    
    for (const h1Pos of h1Positions) {
      const metadata = extractMetadataAboveH1(lines, h1Pos);
      if (metadata) {
        const slug = detectSlug(metadata.title, metas.length === 0);
        metas.push({
          slug,
          title: metadata.title,
          description: metadata.description,
          h1Index: h1Pos,
        });
        console.log(`DEBUG: Auto-detected "${metadata.title}" -> ${slug}`);
      }
    }

    // Проверяем, все ли slug'и найдены автоматически и уникально
    const foundSlugs = metas.map(m => m.slug);
    const uniqueSlugs = [...new Set(foundSlugs)];
    const missingSlugs = requiredSlugs.filter(s => !uniqueSlugs.includes(s));
    
    if (missingSlugs.length === 0 && uniqueSlugs.length === 5) {
      console.log("DEBUG: Case 1 - All slugs auto-detected successfully");
    } else {
      console.log(`DEBUG: Case 2 - Missing/duplicate slugs: ${missingSlugs.join(', ')}, switching to manual mode`);
      metas = []; // Сбрасываем автоматические результаты
    }
  } else {
    console.log(`DEBUG: Case 3 - ${h1Count} headers found (< 5), manual mode required`);
  }

  // ЭТАП 4: Ручной режим (КЕЙС 2 и 3)
  if (metas.length === 0) {
    console.log(`Found ${h1Count} pages. Please assign H1 headings to page slugs.`);

    // Извлекаем заголовки для ручного назначения
    const h1Headings: string[] = [];
    for (const h1Pos of h1Positions) {
      const heading = lines[h1Pos].replace(/^#\s+/, "").trim();
      h1Headings.push(heading);
    }

    // Показываем доступные заголовки
    h1Headings.forEach((heading, idx) => {
      console.log(`${idx + 1}) ${heading}`);
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const ask = (q: string) => new Promise<string>((res) => rl.question(q, res));
    
    // Спрашиваем про все 5 slug'ов
    for (const slug of requiredSlugs) {
      const answer = await ask(`Select the number for slug "${slug}" (press Enter to skip): `);
      
      if (!answer.trim()) {
        console.log(`Skipping slug "${slug}"`);
        continue;
      }
      
      const index = parseInt(answer, 10) - 1;
      if (index < 0 || index >= h1Headings.length) {
        console.log(`Invalid selection for slug "${slug}", skipping`);
        continue;
      }
      
      const h1Pos = h1Positions[index];
      const metadata = extractMetadataAboveH1(lines, h1Pos);
      
      if (metadata) {
        metas.push({
          slug,
          title: metadata.title,
          description: metadata.description,
          h1Index: h1Pos,
        });
        console.log(`DEBUG: Manually assigned "${metadata.title}" -> ${slug}`);
      } else {
        console.warn(`DEBUG: No metadata found for H1 at line ${h1Pos + 1}`);
      }
    }
    
    rl.close();
  }

  // ЭТАП 5: Извлечение контента
  const siteData = {} as SiteData;
  
  for (const meta of metas) {
    const content = extractContentUnderH1(lines, meta.h1Index);
    
    // ЭТАП 6: Парсинг и очистка
    const blocksAll = parseBlocks(content);
    const blocks = blocksAll.filter((b) => {
      if (b.type === "paragraph" && typeof b.text === "string") {
        const plain = b.text.replace(/<\/?strong>/gi, "");
        // Удаляем блоки с метаданными
        if (titlePattern.test(plain) || descPattern.test(plain)) {
          return false;
        }
        return plain.trim().length > 0;
      }
      return true;
    });
    
    console.log(`DEBUG: Processing page "${meta.slug}" with ${blocks.length} blocks`);
    
    // ЭТАП 7: Формирование результата
    siteData[meta.slug] = {
      title: meta.title,
      description: meta.description,
      blocks,
    };
  }

  return siteData;
}

/**
 * Читает файл .md и возвращает SiteData или null при ошибке
 */
export async function parseFileMulti(
  filePath: string
): Promise<SiteData | null> {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return null;
  }
  const ext = path.extname(filePath).toLowerCase();
  let content: string;
  if (ext === ".md") {
    content = fs.readFileSync(filePath, "utf-8");
  } else {
    console.error(`Unsupported format: ${filePath}`);
    return null;
  }
  try {
    return await parseMarkdownToSiteData(content);
  } catch (err) {
    console.error(err);
    return null;
  }
}