// The existing detector's findings are stable by path + selector, not line number.
export function parseFindings(output) {
  return output.split(/\r?\n/).flatMap(line => {
    const match = line.match(/^(.+\.css):\d+: (.+)$/);
    return match ? [`${match[1]}: ${match[2]}`] : [];
  }).sort();
}
export function addedFindings(current, baseline) {
  const remaining = new Map();
  for (const finding of baseline) remaining.set(finding, (remaining.get(finding) ?? 0) + 1);
  return current.filter(finding => {
    const count = remaining.get(finding) ?? 0;
    if (!count) return true;
    remaining.set(finding, count - 1);
    return false;
  });
}
