export const PHONE_MAX_WIDTH = 767;

export function isPhoneWidth(width: number): boolean {
  return width <= PHONE_MAX_WIDTH;
}

export function isTabletWidth(width: number): boolean {
  return width > PHONE_MAX_WIDTH;
}
