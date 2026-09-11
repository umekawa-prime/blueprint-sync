export const TEXT_BG_PADDING = 6;
export const DEFAULT_TEXT_FILL = "#E81123";

export type TextStyle = {
  fill: string;
  backgroundColor: string;
  padding: number;
};

export function isNoneBackground(color: string | undefined | null): boolean {
  if (!color) {
    return true;
  }
  return color.trim().toLowerCase() === "transparent";
}

export function textStyleFromColors(fill: string, background: string): TextStyle {
  const backgroundColor = isNoneBackground(background) ? "" : background;
  return {
    fill,
    backgroundColor,
    padding: backgroundColor ? TEXT_BG_PADDING : 0,
  };
}

export function isTextAnnotation(object: { type?: unknown }): boolean {
  const type = typeof object.type === "string" ? object.type.toLowerCase() : "";
  return type === "i-text" || type === "itext" || type === "textbox";
}

export function textStyleFromObject(object: {
  fill?: unknown;
  backgroundColor?: unknown;
}): TextStyle {
  const fill = typeof object.fill === "string" && object.fill ? object.fill : DEFAULT_TEXT_FILL;
  const background =
    typeof object.backgroundColor === "string" ? object.backgroundColor : "";
  return textStyleFromColors(fill, background);
}

export function textStyleFromSelection(object: unknown): TextStyle | null {
  if (!object || typeof object !== "object") {
    return null;
  }
  if (!isTextAnnotation(object as { type?: unknown })) {
    return null;
  }
  return textStyleFromObject(object as { fill?: unknown; backgroundColor?: unknown });
}

export function textStylesEqual(a: TextStyle, b: TextStyle): boolean {
  return (
    a.fill === b.fill && a.backgroundColor === b.backgroundColor && a.padding === b.padding
  );
}
