/**
 * If `text` exceeds `maxChars`, slice and append a human-readable notice.
 */
export function truncateWithNotice(text, maxChars) {
  if (text.length <= maxChars) return text;
  return (
    text.slice(0, maxChars) +
    `\n\n[truncated after ${maxChars} characters]`
  );
}
