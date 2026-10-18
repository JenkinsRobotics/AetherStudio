/** npm may prune a nested file dependency's node_modules when installing its
 * consumer. Install consumers first, then dependencies, including shared ones. */
export function installationOrder(packages, dependencies) {
  const complete = new Set(), visiting = new Set(), ordered = [];
  const byPath = new Map(packages.map(pkg => [pkg.path, pkg]));
  function visit(pkg) {
    if (complete.has(pkg.path)) return;
    if (visiting.has(pkg.path)) throw new Error(`Circular local package dependency: ${pkg.path}`);
    visiting.add(pkg.path);
    for (const path of dependencies(pkg)) {
      if (byPath.has(path)) visit(byPath.get(path));
    }
    visiting.delete(pkg.path);
    complete.add(pkg.path);
    ordered.push(pkg);
  }
  packages.forEach(visit);
  return ordered.reverse();
}
