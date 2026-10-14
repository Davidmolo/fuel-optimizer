/**
 * Builds a stable dispatcher filter label from an OpenRoad `/users` row.
 * Duplicate first names (e.g. Alex Mladenovski / Alex V) get a last initial.
 */
export function buildOpenRoadManagerLabelMap(
  users: Array<{ id: number; name?: string | null; lastname?: string | null }>,
) {
  const firstNameCounts = new Map<string, number>();
  for (const user of users) {
    const first = user.name?.trim();
    if (!first) {
      continue;
    }
    const key = first.toLowerCase();
    firstNameCounts.set(key, (firstNameCounts.get(key) ?? 0) + 1);
  }

  const labels = new Map<number, string>();
  for (const user of users) {
    const first = user.name?.trim() || "";
    const last = user.lastname?.trim() || "";
    if (!first && !last) {
      continue;
    }

    const ambiguous = Boolean(first && (firstNameCounts.get(first.toLowerCase()) ?? 0) > 1);
    const label =
      ambiguous && last
        ? `${first} ${last.charAt(0).toUpperCase()}`
        : first || last;

    labels.set(user.id, label);
  }

  return labels;
}
