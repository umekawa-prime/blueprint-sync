/** OneNote Draw タブに近い色。上段がニュートラル、下段がアクセント。 */
export const PEN_COLORS = [
  "#000000",
  "#3B3B3B",
  "#767676",
  "#FFFFFF",
  "#E81123",
  "#EA4300",
  "#FF8C00",
  "#FFF100",
  "#107C10",
  "#00B294",
  "#0078D7",
  "#00188F",
  "#5C2D91",
  "#B4009E",
  "#E3008C",
  "#7A7574",
] as const;

/** OneNote の極細〜太ペンに相当するキャンバス上の線幅。 */
export const PEN_WIDTHS = [1, 2, 3, 5, 8, 12] as const;

export function normalizeHex(color: string): string {
  return color.trim().toUpperCase();
}

export function isPresetColor(color: string): boolean {
  const hex = normalizeHex(color);
  return PEN_COLORS.some((preset) => preset.toUpperCase() === hex);
}

export function isPresetWidth(width: number): boolean {
  return (PEN_WIDTHS as readonly number[]).includes(width);
}

export function thicknessDotSize(width: number): number {
  return 8 + width * 2;
}
