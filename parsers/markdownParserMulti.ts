// markdownParserMulti.ts
import fs from "fs";
import path from "path";

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
  if (lower.includes("bonus")) {
    return "bonus";
  }
  if (lower.includes("login")) {
    return "login";
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
  let listBlock: Block | null = null;

  for (let raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      listBlock = null;
      continue;
    }
    // Список
    if (/^\d+\./.test(trimmed) || /^[*\-]\s+/.test(trimmed)) {
      const isOrdered = /^\d+\./.test(trimmed);
      const text = trimmed.replace(/^\d+\.|^[*\-]\s+/, "").trim();
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
      const level = hMatch[1].length;
      blocks.push({
        type: "heading",
        level,
        text: hMatch[2].trim(),
      });
      continue;
    }
    // Параграф
    blocks.push({ type: "paragraph", text: trimmed });
    listBlock = null;
  }

  return blocks;
}

/**
 * Основной парсер: из Markdown-строки собирает SiteData
 */
export function parseMarkdownToSiteData(content: string): SiteData {
  // Удаляем картинки
  const cleaned = removeImages(content);
  const lines = cleaned.split(/\r?\n/);

  // Собираем пары метаданных
  interface MetaPos {
    slug: keyof SiteData;
    title: string;
    description: string;
    index: number;
  }
  const metas: MetaPos[] = [];
  for (let i = 0; i < lines.length; i++) {
    const tMatch = lines[i].match(titlePattern);
    if (tMatch) {
      console.log(
        `DEBUG: Found titlePattern at line ${i + 1}: "${lines[i].trim()}"`
      );
      // Skip blank lines to find description
      let j = i + 1;
      while (j < lines.length && lines[j].trim() === "") {
        j++;
      }
      const dMatch = lines[j]?.match(descPattern);
      if (!dMatch) {
        console.warn(
          `DEBUG: No description match at line ${j + 1}: "${lines[j]?.trim()}"`
        );
      }
      if (dMatch) {
        const titleText = tMatch[1].trim();
        // Strip bold Markdown from title
        const cleanTitle = titleText.replace(/^\*{1,2}\s*/, '').replace(/\s*\*{1,2}$/, '').trim();
        // Strip bold Markdown from description
        const descText = dMatch[1].trim();
        const cleanDesc = descText.replace(/^\*{1,2}\s*/, '').replace(/\s*\*{1,2}$/, '').trim();
        const slug = detectSlug(cleanTitle, metas.length === 0);
        // Skip duplicate slug entries
        if (metas.length > 0 && metas[metas.length - 1].slug === slug) {
          i = j;
          continue;
        }
        metas.push({
          slug,
          title: cleanTitle,
          description: cleanDesc,
          index: j + 1,
        });
        i = j; // skip over description
      }
    }
  }
  console.log(`DEBUG: metas collected (${metas.length}):`, metas);

  if (metas.length !== 5) {
    console.warn("Failed to detect all page metadata. Detected headings:");
    // вывести все заголовки H2
    const h2s = lines
      .filter((l) => /^##\s+/.test(l))
      .map((l) => l.replace(/^##\s+/, "").trim());
    console.warn(h2s);
    throw new Error(
      "parseMarkdownToSiteData: Metadata detection incomplete. Please verify H2 headings."
    );
  }

  // Составляем фрагменты по страницам
  const siteData = {} as SiteData;
  metas.forEach((meta, idx) => {
    const start = meta.index;
    const end = metas[idx + 1]?.index ?? lines.length;
    const fragment = lines.slice(start, end);
    const blocks = parseBlocks(fragment);
    siteData[meta.slug] = {
      title: meta.title,
      description: meta.description,
      blocks,
    };
  });

  return siteData;
}

/**
 * Читает файл .md или .docx и возвращает SiteData или null при ошибке
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
    return parseMarkdownToSiteData(content);
  } catch (err) {
    console.error(err);
    return null;
  }
}
