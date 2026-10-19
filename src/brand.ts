export const brand = {
  name: import.meta.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Goldsmith OS',
  tagline: import.meta.env.NEXT_PUBLIC_APP_TAGLINE?.trim() || 'Goldsmith Accounting System',
  logo: import.meta.env.NEXT_PUBLIC_APP_LOGO?.trim() || '/demo-logo.svg',
};
