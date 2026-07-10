/**
 * Shared validation utilities for student forms.
 * Used by StudentsPage and LessonDetailPage to ensure consistent validation.
 */

export interface StudentFormErrors {
  first_name?: string;
  last_name?: string;
  age?: string;
  phone?: string;
  parent_contact?: string;
}

/**
 * Validate first name or last name.
 * Required, min 2 chars, only letters/space/hyphen.
 */
export function validateName(value: string, fieldName: string): string | undefined {
  const trimmed = value.trim();
  if (!trimmed) {
    return `${fieldName} обязательно`;
  }
  if (trimmed.length < 2) {
    return `${fieldName} должно содержать минимум 2 символа`;
  }
  if (!/^[a-zA-Zа-яА-ЯёЁ\s\-]+$/.test(trimmed)) {
    return `${fieldName} должно содержать только буквы, пробел и дефис`;
  }
  return undefined;
}

/**
 * Validate age.
 * Optional, but if filled: must be a number, range 3–99.
 */
export function validateAge(value: string): string | undefined {
  if (!value || value.trim() === '') return undefined;
  const num = Number(value);
  if (isNaN(num) || !Number.isInteger(num)) {
    return 'Возраст должен быть числом';
  }
  if (num < 3 || num > 99) {
    return 'Возраст должен быть от 3 до 99';
  }
  return undefined;
}

/**
 * Validate phone number.
 * Optional, but if filled: minimum length check.
 */
export function validatePhone(value: string): string | undefined {
  if (!value || value.trim() === '') return undefined;
  const cleaned = value.replace(/[\s\-\+\(\)]/g, '');
  if (cleaned.length < 5) {
    return 'Номер телефона слишком короткий';
  }
  return undefined;
}

/**
 * Validate entire student form.
 */
export function validateStudentForm(form: {
  first_name: string;
  last_name: string;
  age: string;
  phone?: string;
  parent_contact?: string;
}): StudentFormErrors {
  const errors: StudentFormErrors = {};

  const firstNameError = validateName(form.first_name, 'Имя');
  if (firstNameError) errors.first_name = firstNameError;

  const lastNameError = validateName(form.last_name, 'Фамилия');
  if (lastNameError) errors.last_name = lastNameError;

  const ageError = validateAge(form.age);
  if (ageError) errors.age = ageError;

  const phoneError = validatePhone(form.phone || '');
  if (phoneError) errors.phone = phoneError;

  const parentContactError = validatePhone(form.parent_contact || '');
  if (parentContactError) errors.parent_contact = parentContactError;

  return errors;
}

/**
 * Check if a StudentFormErrors object has any errors.
 */
export function hasErrors(errors: StudentFormErrors): boolean {
  return Object.keys(errors).length > 0;
}
