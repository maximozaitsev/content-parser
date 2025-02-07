import axios from "axios";
import TurndownService from "turndown";

// Функция загрузки Google Docs
export async function fetchGoogleDocs(docUrl: string): Promise<string> {
  try {
    const fileId = docUrl.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1];
    if (!fileId)
      throw new Error("Неверная ссылка! Убедитесь, что документ публичный.");

    const exportUrl = `https://docs.google.com/document/d/${fileId}/export?format=html`;
    const response = await axios.get(exportUrl);

    const turndownService = new TurndownService();
    return turndownService.turndown(response.data);
  } catch (error) {
    console.error("Ошибка загрузки Google Docs:", error);
    process.exit(1);
  }
}
