export function formatDisplayNumbers(value: string) {
  return value.replace(/\b\d{5,}\b/g, (digits) =>
    digits.replace(/\B(?=(\d{3})+(?!\d))/g, ','),
  );
}
