export function replaceCurrentYearWithPlaceholder(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  const currentYear = new Date().getFullYear();
  const yearRegex = new RegExp(`\\b${currentYear}\\b`, 'g');
  return text.replace(yearRegex, '{{CURRENT_YEAR}}');
}
