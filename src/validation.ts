export const PH_CONTACT_PATTERN = /^09\d{9}$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidPHContact = (value: string) => PH_CONTACT_PATTERN.test(value);
export function normalizeContactInput(value: string): string {
  const digits = value.replace(/\D/g, "");
  // Preserve existing international-format PH numbers when opening an edit form.
  return (digits.length === 12 && digits.startsWith("639") ? `0${digits.slice(2)}` : digits).slice(0, 11);
}
export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());
