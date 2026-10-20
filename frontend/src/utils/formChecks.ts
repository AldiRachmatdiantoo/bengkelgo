// Client-side copies of the API's field rules (backend/src/common/middlewares/validate.ts), so a form can say what
// is still wrong before it is sent. The API stays the authority; these only drive the "Lengkapi dulu" list.

/** 8–72 characters with a lowercase letter, an uppercase letter and a digit. */
export const isStrongPassword = (v: string) => v.length >= 8 && v.length <= 72 && /[a-z]/.test(v) && /[A-Z]/.test(v) && /\d/.test(v);

/** Indonesian WhatsApp number: 08…, 628… or +628…, 10–15 digits in total. */
export const isIdPhone = (v: string) => /^(\+62|62|0)8[1-9][0-9]{6,11}$/.test(v.trim());

/** Loose email shape check (the browser and the API do the strict one). */
export const isEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/** Checklist entry for a contact/password field: missing when empty, otherwise flags a wrong format. */
export function fieldIssue(value: string, label: string, valid: (v: string) => boolean, wrongLabel: string) {
  if (!value.trim()) return label;
  return valid(value) ? null : wrongLabel;
}
