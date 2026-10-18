/** Window-local review labels, independent of document versions and branches. */
export const modelReviewTags = (): Record<string, string[]> => ({
  'wall-review': ['Design'], 'clearance-review': ['Clearance'],
  'version-review': ['Review'], 'approved-review': ['Review'],
  'wall-task': ['Design'], 'bracket-task': ['Clearance'],
  'drawing-task': ['Drawings'], 'fea-task': ['Analysis'],
  'fastener-task': ['Review'], 'thermal-task': ['Analysis'],
});

export function parseReviewTags(text: string): string[] {
  const seen = new Set<string>();
  return text.split(',').map(tag => tag.trim()).filter(tag => {
    const key = tag.toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key); return true;
  });
}
