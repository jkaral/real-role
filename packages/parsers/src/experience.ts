/** Only explicit, unambiguous minimum years; never infer seniority from a title. */
export function extractExperienceMinimum(text: string): number | undefined {
  const pattern =
    /\b(?:at least|minimum(?: of)?|requires?)\s+(\d{1,2})\s*\+?\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+)?experience\b|\b(\d{1,2})\+\s*years?\s+(?:of\s+)?(?:relevant\s+|professional\s+)?experience\b/gi;
  const values = new Set(
    [...text.slice(0, 50000).matchAll(pattern)].map((match) => Number(match[1] ?? match[2])),
  );
  const [value] = [...values];
  return values.size === 1 && value !== undefined && value <= 60 ? value : undefined;
}
