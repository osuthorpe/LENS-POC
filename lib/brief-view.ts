import type { BriefItem } from '@/lib/types';

export function selectKeyFacts(
  changes: BriefItem[],
  currentState: BriefItem[],
) {
  const selected: BriefItem[] = [];

  for (const item of [...changes, ...currentState]) {
    if (item.kind !== 'fact') continue;

    const textKey = item.text.trim().replace(/\s+/g, ' ').toLowerCase();
    const valueKey = valueSetKey(item);
    const isDuplicate = selected.some((selectedItem) => {
      const selectedTextKey = selectedItem.text.trim().replace(/\s+/g, ' ').toLowerCase();
      if (selectedTextKey === textKey) return true;

      const selectedValueKey = valueSetKey(selectedItem);
      const hasSharedSource = item.sourceIds.some((sourceId) =>
        selectedItem.sourceIds.includes(sourceId),
      );
      return Boolean(valueKey && valueKey === selectedValueKey && hasSharedSource);
    });

    if (!isDuplicate) selected.push(item);
  }

  return selected;
}

function valueSetKey(item: BriefItem) {
  const values = item.values?.map((value) =>
    `${value.kind}:${value.value.trim().toLowerCase()}`,
  ).sort() ?? [];

  return values.length > 1 ? values.join('|') : null;
}
