import { PDFDocument, StandardFonts, rgb, degrees, type PDFFont, type PDFPage, type RGB } from "pdf-lib";

export type DxfLayerJson = {
  name: string;
  color: number;
  line_type: string;
  frozen: boolean;
  locked: boolean;
};

export type DxfVertexJson = {
  x: number;
  y: number;
};

export type DxfEntityJson = {
  type: string;
  layer: string;
  color: number;
  line_type: string;
  line_weight?: number;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  center_x?: number;
  center_y?: number;
  radius?: number;
  start_angle?: number;
  end_angle?: number;
  major_axis_x?: number;
  major_axis_y?: number;
  minor_ratio?: number;
  start_param?: number;
  end_param?: number;
  x?: number;
  y?: number;
  height?: number;
  width_factor?: number;
  rotation?: number;
  content?: string;
  x3?: number;
  y3?: number;
  x4?: number;
  y4?: number;
  points?: DxfVertexJson[];
};

export type DxfDocumentJson = {
  layers: DxfLayerJson[];
  entities: DxfEntityJson[];
  blocks?: unknown[];
  unsupported_entities?: string[];
};

const MM_TO_PT = 72 / 25.4;
const MARGIN_MM = 10;
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const MAX_PAGE_PT = 14400;

type BBox = { minX: number; minY: number; maxX: number; maxY: number };

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function includePoint(box: BBox | null, x: number, y: number): BBox {
  if (!box) {
    return { minX: x, minY: y, maxX: x, maxY: y };
  }
  return {
    minX: Math.min(box.minX, x),
    minY: Math.min(box.minY, y),
    maxX: Math.max(box.maxX, x),
    maxY: Math.max(box.maxY, y),
  };
}

function entityPoints(entity: DxfEntityJson): DxfVertexJson[] {
  switch (entity.type) {
    case "LINE":
      return isFiniteNumber(entity.x1) && isFiniteNumber(entity.y1) && isFiniteNumber(entity.x2) && isFiniteNumber(entity.y2)
        ? [
            { x: entity.x1, y: entity.y1 },
            { x: entity.x2, y: entity.y2 },
          ]
        : [];
    case "CIRCLE":
    case "ARC":
      if (!isFiniteNumber(entity.center_x) || !isFiniteNumber(entity.center_y) || !isFiniteNumber(entity.radius)) {
        return [];
      }
      return [
        { x: entity.center_x - entity.radius, y: entity.center_y - entity.radius },
        { x: entity.center_x + entity.radius, y: entity.center_y + entity.radius },
      ];
    case "ELLIPSE": {
      if (
        !isFiniteNumber(entity.center_x) ||
        !isFiniteNumber(entity.center_y) ||
        !isFiniteNumber(entity.major_axis_x) ||
        !isFiniteNumber(entity.major_axis_y) ||
        !isFiniteNumber(entity.minor_ratio)
      ) {
        return [];
      }
      const major = Math.hypot(entity.major_axis_x, entity.major_axis_y);
      const minor = major * entity.minor_ratio;
      const pad = Math.max(major, minor);
      return [
        { x: entity.center_x - pad, y: entity.center_y - pad },
        { x: entity.center_x + pad, y: entity.center_y + pad },
      ];
    }
    case "POINT":
    case "TEXT":
      return isFiniteNumber(entity.x) && isFiniteNumber(entity.y) ? [{ x: entity.x, y: entity.y }] : [];
    case "SOLID":
      return [
        [entity.x1, entity.y1],
        [entity.x2, entity.y2],
        [entity.x3, entity.y3],
        [entity.x4, entity.y4],
      ]
        .filter((pair): pair is [number, number] => isFiniteNumber(pair[0]) && isFiniteNumber(pair[1]))
        .map(([x, y]) => ({ x, y }));
    case "FILLED_POLYGON":
      return (entity.points ?? []).filter((point) => isFiniteNumber(point.x) && isFiniteNumber(point.y));
    default:
      return [];
  }
}

function visibleEntities(doc: DxfDocumentJson): DxfEntityJson[] {
  const frozen = new Set(doc.layers.filter((layer) => layer.frozen).map((layer) => layer.name));
  return doc.entities.filter((entity) => entity.type !== "INSERT" && !frozen.has(entity.layer));
}

function boundsOf(entities: DxfEntityJson[]): BBox | null {
  let box: BBox | null = null;
  for (const entity of entities) {
    for (const point of entityPoints(entity)) {
      box = includePoint(box, point.x, point.y);
    }
  }
  return box;
}

/** AutoCAD ACI → RGB. Color 7 (white/black) is drawn as black on paper. */
export function aciToRgb(index: number): RGB {
  const aci = Math.trunc(index);
  if (aci === 7 || aci === 256 || aci === 0) {
    return rgb(0, 0, 0);
  }
  const named: Record<number, [number, number, number]> = {
    1: [1, 0, 0],
    2: [1, 1, 0],
    3: [0, 1, 0],
    4: [0, 1, 1],
    5: [0, 0, 1],
    6: [1, 0, 1],
    8: [0.5, 0.5, 0.5],
    9: [0.75, 0.75, 0.75],
  };
  const preset = named[aci];
  if (preset) {
    return rgb(preset[0], preset[1], preset[2]);
  }
  if (aci >= 1 && aci <= 255) {
    const t = ((aci * 37) % 180) / 180;
    return rgb(0.2 + 0.6 * Math.abs(Math.sin(t * Math.PI)), 0.2 + 0.6 * t, 0.8 - 0.5 * t);
  }
  return rgb(0, 0, 0);
}

function strokeWidth(entity: DxfEntityJson): number {
  const hundredths = entity.line_weight;
  if (isFiniteNumber(hundredths) && hundredths > 0) {
    return Math.max(0.25, (hundredths / 100) * MM_TO_PT);
  }
  return 0.4;
}

function dashArray(lineType: string): number[] | undefined {
  const kind = lineType.toUpperCase();
  if (kind === "CONTINUOUS" || kind === "BYLAYER" || kind === "") {
    return undefined;
  }
  if (kind.includes("DASHDOT") || kind.includes("DIVIDE")) {
    return [8, 3, 1.5, 3];
  }
  if (kind.includes("DASH") || kind.includes("HIDDEN")) {
    return [8, 4];
  }
  if (kind.includes("DOT")) {
    return [1.5, 3];
  }
  return undefined;
}

function strokeOptions(entity: DxfEntityJson) {
  return {
    color: aciToRgb(entity.color),
    thickness: strokeWidth(entity),
    dashArray: dashArray(entity.line_type),
  };
}

type Transform = (x: number, y: number) => { x: number; y: number };

function polar(cx: number, cy: number, radius: number, degreesAngle: number) {
  const rad = (degreesAngle * Math.PI) / 180;
  return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
}

function drawArc(page: PDFPage, entity: DxfEntityJson, toPage: Transform) {
  if (
    !isFiniteNumber(entity.center_x) ||
    !isFiniteNumber(entity.center_y) ||
    !isFiniteNumber(entity.radius) ||
    !isFiniteNumber(entity.start_angle) ||
    !isFiniteNumber(entity.end_angle)
  ) {
    return;
  }
  const startWorld = polar(entity.center_x, entity.center_y, entity.radius, entity.start_angle);
  const endWorld = polar(entity.center_x, entity.center_y, entity.radius, entity.end_angle);
  const start = toPage(startWorld.x, startWorld.y);
  const end = toPage(endWorld.x, endWorld.y);
  const radius = entity.radius * Math.hypot(toPage(1, 0).x - toPage(0, 0).x, toPage(1, 0).y - toPage(0, 0).y);
  let sweep = (entity.end_angle - entity.start_angle) % 360;
  if (sweep <= 0) {
    sweep += 360;
  }
  const large = sweep > 180 ? 1 : 0;
  page.drawSvgPath(`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`, {
    borderColor: aciToRgb(entity.color),
    borderWidth: strokeWidth(entity),
    borderDashArray: dashArray(entity.line_type),
  });
}

function drawEllipseEntity(page: PDFPage, entity: DxfEntityJson, toPage: Transform) {
  if (
    !isFiniteNumber(entity.center_x) ||
    !isFiniteNumber(entity.center_y) ||
    !isFiniteNumber(entity.major_axis_x) ||
    !isFiniteNumber(entity.major_axis_y) ||
    !isFiniteNumber(entity.minor_ratio)
  ) {
    return;
  }
  const center = toPage(entity.center_x, entity.center_y);
  const majorEnd = toPage(entity.center_x + entity.major_axis_x, entity.center_y + entity.major_axis_y);
  const xScale = Math.hypot(majorEnd.x - center.x, majorEnd.y - center.y);
  const yScale = xScale * entity.minor_ratio;
  const rotate = Math.atan2(majorEnd.y - center.y, majorEnd.x - center.x) * (180 / Math.PI);
  page.drawEllipse({
    x: center.x,
    y: center.y,
    xScale,
    yScale,
    rotate: degrees(rotate),
    borderColor: aciToRgb(entity.color),
    borderWidth: strokeWidth(entity),
    borderDashArray: dashArray(entity.line_type),
  });
}

function drawTextEntity(page: PDFPage, entity: DxfEntityJson, toPage: Transform, font: PDFFont) {
  if (!isFiniteNumber(entity.x) || !isFiniteNumber(entity.y) || !entity.content) {
    return;
  }
  const origin = toPage(entity.x, entity.y);
  const size = Math.max(4, (entity.height ?? 2.5) * MM_TO_PT);
  try {
    page.drawText(entity.content, {
      x: origin.x,
      y: origin.y,
      size,
      font,
      color: aciToRgb(entity.color),
      rotate: degrees(entity.rotation ?? 0),
    });
  } catch {
    const ascii = entity.content.replace(/[^\u0020-\u007e]/g, "?");
    if (ascii.trim()) {
      page.drawText(ascii, {
        x: origin.x,
        y: origin.y,
        size,
        font,
        color: aciToRgb(entity.color),
        rotate: degrees(entity.rotation ?? 0),
      });
    }
  }
}

function drawEntity(page: PDFPage, entity: DxfEntityJson, toPage: Transform, font: PDFFont) {
  const stroke = strokeOptions(entity);
  switch (entity.type) {
    case "LINE":
      if (isFiniteNumber(entity.x1) && isFiniteNumber(entity.y1) && isFiniteNumber(entity.x2) && isFiniteNumber(entity.y2)) {
        const start = toPage(entity.x1, entity.y1);
        const end = toPage(entity.x2, entity.y2);
        page.drawLine({ start, end, ...stroke });
      }
      return;
    case "CIRCLE":
      if (isFiniteNumber(entity.center_x) && isFiniteNumber(entity.center_y) && isFiniteNumber(entity.radius)) {
        const center = toPage(entity.center_x, entity.center_y);
        const radius = Math.abs(toPage(entity.center_x + entity.radius, entity.center_y).x - center.x);
        page.drawCircle({ x: center.x, y: center.y, size: radius, borderColor: stroke.color, borderWidth: stroke.thickness, borderDashArray: stroke.dashArray });
      }
      return;
    case "ARC":
      drawArc(page, entity, toPage);
      return;
    case "ELLIPSE":
      drawEllipseEntity(page, entity, toPage);
      return;
    case "POINT":
      if (isFiniteNumber(entity.x) && isFiniteNumber(entity.y)) {
        const point = toPage(entity.x, entity.y);
        page.drawCircle({ x: point.x, y: point.y, size: 0.8, color: stroke.color });
      }
      return;
    case "TEXT":
      drawTextEntity(page, entity, toPage, font);
      return;
    case "SOLID": {
      const verts = [
        [entity.x1, entity.y1],
        [entity.x2, entity.y2],
        [entity.x4, entity.y4],
        [entity.x3, entity.y3],
      ].filter((pair): pair is [number, number] => isFiniteNumber(pair[0]) && isFiniteNumber(pair[1]));
      if (verts.length >= 3) {
        const path = verts
          .map(([x, y], index) => {
            const p = toPage(x, y);
            return `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`;
          })
          .join(" ");
        page.drawSvgPath(`${path} Z`, { color: stroke.color });
      }
      return;
    }
    case "FILLED_POLYGON": {
      const points = entity.points ?? [];
      if (points.length < 3) {
        return;
      }
      const path = points
        .map((point, index) => {
          const p = toPage(point.x, point.y);
          return `${index === 0 ? "M" : "L"} ${p.x} ${p.y}`;
        })
        .join(" ");
      page.drawSvgPath(`${path} Z`, { color: stroke.color });
      return;
    }
    default:
      return;
  }
}

export async function dxfDocumentToPdf(doc: DxfDocumentJson): Promise<Uint8Array> {
  const entities = visibleEntities(doc);
  const box = boundsOf(entities);
  const minX = box?.minX ?? 0;
  const minY = box?.minY ?? 0;
  const spanX = box ? box.maxX - box.minX : 0;
  const spanY = box ? box.maxY - box.minY : 0;
  const widthMm = box ? spanX + MARGIN_MM * 2 : A4_WIDTH_MM;
  const heightMm = box ? spanY + MARGIN_MM * 2 : A4_HEIGHT_MM;
  let scale = MM_TO_PT;
  let pageWidth = Math.max(widthMm * scale, 10);
  let pageHeight = Math.max(heightMm * scale, 10);
  const longest = Math.max(pageWidth, pageHeight);
  if (longest > MAX_PAGE_PT) {
    scale *= MAX_PAGE_PT / longest;
    pageWidth = widthMm * scale;
    pageHeight = heightMm * scale;
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([pageWidth, pageHeight]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const margin = box ? MARGIN_MM * scale : 0;
  const toPage: Transform = (x, y) => ({
    x: (x - minX) * scale + margin,
    y: (y - minY) * scale + margin,
  });

  for (const entity of entities) {
    drawEntity(page, entity, toPage, font);
  }

  return pdf.save();
}
