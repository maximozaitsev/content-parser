// markdownParserMulti.ts
import fs from "fs";
import path from "path";
import readline from "readline";

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
      const cleanHeading = rawHeading
        .replace(boldRegex, "$1")
        .replace(/\\/g, "");
      blocks.push({
        type: "heading",
        level: hMatch[1].length,
        text: cleanHeading,
      });
      continue;
    }
    // Параграф
    // inline bold to <strong> in paragraphs
    const paraText = trimmed
      .replace(boldRegex, "<strong>$1</strong>")
      .replace(/\\/g, "");
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
 * Основной парсер: из Markdown-строки собирает SiteData
 */
export async function parseMarkdownToSiteData(
  content: string
): Promise<SiteData> {
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
        const cleanTitle = titleText
          .replace(/^\*{1,2}\s*/, "")
          .replace(/\s*\*{1,2}$/, "")
          .replace(/\\/g, "")
          .trim();
        // Strip bold Markdown from description
        const descText = dMatch[1].trim();
        const cleanDesc = descText
          .replace(/^\*{1,2}\s*/, "")
          .replace(/\s*\*{1,2}$/, "")
          .replace(/\\/g, "")
          .trim();
        const slug = detectSlug(cleanTitle, metas.length === 0);
        // Skip duplicate slug entries only if we already have all required slugs
        const requiredSlugs: (keyof SiteData)[] = ["home", "games", "app", "bonus", "login"];
        const foundSlugs = metas.map((m) => m.slug);
        const uniqueSlugs = [...new Set(foundSlugs)];
        const hasAllRequired = requiredSlugs.every(s => uniqueSlugs.includes(s));
        
        // If we have all required slugs and this is a duplicate, skip it
        if (hasAllRequired && foundSlugs.includes(slug)) {
          i = j;
          continue;
        }
        
        // If we have a duplicate slug but not all required slugs, skip it to force manual assignment
        if (foundSlugs.includes(slug) && !hasAllRequired) {
          console.log(`DEBUG: Skipping duplicate slug "${slug}" to force manual assignment`);
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

  // If not all 5 pages were found, ask user to assign H1 headings manually
  const requiredSlugs: (keyof SiteData)[] = [
    "home",
    "games",
    "app",
    "bonus",
    "login",
  ];
  const foundSlugs = metas.map((m) => m.slug);
  const uniqueSlugs = [...new Set(foundSlugs)];
  const missing = requiredSlugs.filter((s) => !uniqueSlugs.includes(s));
  if (missing.length > 0) {
    console.log(
      "Could not auto-detect all pages. Please assign H1 headings to each page slug."
    );
    const h1Headings = lines
      .map((l, idx) => ({ line: l, idx }))
      .filter((o) => /^#\s+/.test(o.line))
      .map((o) => o.line.replace(/^#\s+/, "").trim());
    h1Headings.forEach((h, i) => console.log(`${i + 1}) ${h}`));
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    const ask = (q: string) =>
      new Promise<string>((res) => rl.question(q, res));
    const manualMetas: MetaPos[] = [];
    for (const slug of requiredSlugs) {
      const answer = await ask(`Select the number for slug "${slug}": `);
      const index = parseInt(answer, 10) - 1;
      const heading = h1Headings[index];
      const lineIdx = lines.findIndex(
        (l) => l.includes(heading) && /^#\s+/.test(l)
      );
      // Find Title and Description above H1
      let titleLine = "";
      let descLine = "";
      for (let k = lineIdx - 1; k >= 0; k--) {
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
      const cleanTitle = titleLine
        .replace(/^\*{1,2}/, "")
        .replace(/\*{1,2}$/, "")
        .replace(/\\/g, "")
        .trim();
      const cleanDesc = descLine
        .replace(/^\*{1,2}/, "")
        .replace(/\*{1,2}$/, "")
        .replace(/\\/g, "")
        .trim();
      manualMetas.push({
        slug,
        title: cleanTitle,
        description: cleanDesc,
        index: lineIdx, // Start from the H1 heading
      });
    }
    rl.close();
    metas.length = 0;
    manualMetas.forEach((m) => metas.push(m));
  }

  // Составляем фрагменты по страницам
  const siteData = {} as SiteData;
  metas.forEach((meta, idx) => {
    // Find the H1 heading for this page
    let start = meta.index;
    for (let i = meta.index; i < lines.length; i++) {
      if (lines[i].match(/^#\s+/)) {
        start = i;
        break;
      }
    }
    
    // Find the next H1 heading or end of file
    let end = lines.length;
    for (let i = start + 1; i < lines.length; i++) {
      if (lines[i].match(/^#\s+/)) {
        end = i;
        break;
      }
    }
    console.log(`DEBUG: Processing page "${meta.slug}" from line ${start + 1} to ${end} (${end - start} lines)`);
    const fragment = lines.slice(start, end);
    const blocksAll = parseBlocks(fragment);
    const blocks = blocksAll.filter((b) => {
      if (b.type === "paragraph" && typeof b.text === "string") {
        const plain = b.text.replace(/<\/?strong>/gi, "");
        if (titlePattern.test(plain) || descPattern.test(plain)) {
          return false;
        }
      }
      return true;
    });
    console.log(`DEBUG: Page "${meta.slug}" has ${blocks.length} blocks`);
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
    return await parseMarkdownToSiteData(content);
  } catch (err) {
    console.error(err);
    return null;
  }
}
