export type ApprovalChange = {
  key: string;
  label: string;
  initialValue: unknown;
  editedValue: unknown;
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const valuesMatch = (left: unknown, right: unknown): boolean => {
  const isEmpty = (value: unknown) => value === null || value === undefined || value === "" || value === "Not set";
  if (isEmpty(left) && isEmpty(right)) return true;
  if (Object.is(left, right)) return true;
  if (Array.isArray(left) && Array.isArray(right)) {
    return left.length === right.length && left.every((value, index) => valuesMatch(value, right[index]));
  }
  if (isPlainObject(left) && isPlainObject(right)) {
    const keys = new Set([...Object.keys(left), ...Object.keys(right)]);
    return [...keys].every(key => valuesMatch(left[key], right[key]));
  }
  return false;
};

export const approvalFieldLabel = (key: string): string => {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/^is\s+/i, "")
    .trim();
  return words.replace(/\b\w/g, character => character.toUpperCase());
};

export const approvalChanges = (
  current: unknown,
  requested: unknown,
): ApprovalChange[] => {
  const currentValues = isPlainObject(current) ? current : {};
  const requestedValues = isPlainObject(requested) ? requested : {};

  return Object.entries(requestedValues)
    .filter(([key, editedValue]) => !valuesMatch(currentValues[key], editedValue))
    .map(([key, editedValue]) => ({
      key,
      label: approvalFieldLabel(key),
      initialValue: currentValues[key],
      editedValue,
    }));
};

const moneyFields = /(?:price|cost|amount|payment|charge)$/i;
const dateFields = /(?:date|deadline|updatedAt)$/i;

export const approvalValue = (value: unknown, key = ""): string => {
  if (value === null || value === undefined || value === "" || value === "Not set") return "—";
  if (typeof value === "string") {
    if (dateFields.test(key) && !Number.isNaN(Date.parse(value))) return new Date(value).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
    if (moneyFields.test(key) && /^-?\d+(?:\.\d+)?$/.test(value.trim())) {
      return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(value));
    }
    return value;
  }
  if (typeof value === "number" && moneyFields.test(key)) return new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) return value.length ? value.map(entry => approvalValue(entry, key)).join(", ") : "None";
  if (isPlainObject(value)) {
    const entries = Object.entries(value);
    return entries.length
      ? entries.map(([entryKey, entry]) => `${approvalFieldLabel(entryKey)}: ${approvalValue(entry, entryKey)}`).join("; ")
      : "None";
  }
  return String(value);
};
