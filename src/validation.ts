export const PH_CONTACT_PATTERN = /^(09\d{9}|\+639\d{9})$/;
export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isValidPHContact = (value: string) => PH_CONTACT_PATTERN.test(value.trim().replace(/[ -]/g, ""));
export const isValidEmail = (value: string) => EMAIL_PATTERN.test(value.trim());
export const hasMinimumDownPayment = (downpayment: number, totalPrice: number) => downpayment >= totalPrice * 0.25;
