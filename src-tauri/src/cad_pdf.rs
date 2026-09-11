use ezjww_core::dxf::{DxfDocument, DxfEntity};
use std::collections::HashSet;
use std::f64::consts::PI;
use std::fmt::Write as FmtWrite;
use std::io::Write as IoWrite;

const MM_TO_PT: f64 = 72.0 / 25.4;
const MARGIN_MM: f64 = 10.0;
const A4_WIDTH_MM: f64 = 210.0;
const A4_HEIGHT_MM: f64 = 297.0;
const MAX_PAGE_PT: f64 = 14400.0;

struct BBox {
    min_x: f64,
    min_y: f64,
    max_x: f64,
    max_y: f64,
}

impl BBox {
    fn include(&mut self, x: f64, y: f64) {
        self.min_x = self.min_x.min(x);
        self.min_y = self.min_y.min(y);
        self.max_x = self.max_x.max(x);
        self.max_y = self.max_y.max(y);
    }
}

fn finite(value: f64) -> bool {
    value.is_finite()
}

fn entity_layer(entity: &DxfEntity) -> &str {
    match entity {
        DxfEntity::Line(v) => &v.layer,
        DxfEntity::Circle(v) => &v.layer,
        DxfEntity::Arc(v) => &v.layer,
        DxfEntity::Ellipse(v) => &v.layer,
        DxfEntity::Point(v) => &v.layer,
        DxfEntity::Text(v) => &v.layer,
        DxfEntity::Solid(v) => &v.layer,
        DxfEntity::FilledPolygon(v) => &v.layer,
        DxfEntity::Insert(v) => &v.layer,
    }
}

fn add_entity_points(box_: &mut Option<BBox>, entity: &DxfEntity) {
    let mut push = |x: f64, y: f64| {
        if !finite(x) || !finite(y) {
            return;
        }
        match box_ {
            Some(existing) => existing.include(x, y),
            None => {
                *box_ = Some(BBox {
                    min_x: x,
                    min_y: y,
                    max_x: x,
                    max_y: y,
                });
            }
        }
    };
    match entity {
        DxfEntity::Line(v) => {
            push(v.x1, v.y1);
            push(v.x2, v.y2);
        }
        DxfEntity::Circle(v) => {
            push(v.center_x - v.radius, v.center_y - v.radius);
            push(v.center_x + v.radius, v.center_y + v.radius);
        }
        DxfEntity::Arc(v) => {
            push(v.center_x - v.radius, v.center_y - v.radius);
            push(v.center_x + v.radius, v.center_y + v.radius);
        }
        DxfEntity::Ellipse(v) => {
            let major = v.major_axis_x.hypot(v.major_axis_y);
            let pad = major.max(major * v.minor_ratio);
            push(v.center_x - pad, v.center_y - pad);
            push(v.center_x + pad, v.center_y + pad);
        }
        DxfEntity::Point(v) => push(v.x, v.y),
        DxfEntity::Text(v) => push(v.x, v.y),
        DxfEntity::Solid(v) => {
            push(v.x1, v.y1);
            push(v.x2, v.y2);
            push(v.x3, v.y3);
            push(v.x4, v.y4);
        }
        DxfEntity::FilledPolygon(v) => {
            for point in &v.points {
                push(point.x, point.y);
            }
        }
        DxfEntity::Insert(_) => {}
    }
}

fn aci_rgb(index: i32) -> (f64, f64, f64) {
    let aci = index;
    if aci == 7 || aci == 256 || aci == 0 {
        return (0.0, 0.0, 0.0);
    }
    match aci {
        1 => (1.0, 0.0, 0.0),
        2 => (1.0, 1.0, 0.0),
        3 => (0.0, 1.0, 0.0),
        4 => (0.0, 1.0, 1.0),
        5 => (0.0, 0.0, 1.0),
        6 => (1.0, 0.0, 1.0),
        8 => (0.5, 0.5, 0.5),
        9 => (0.75, 0.75, 0.75),
        10..=255 => {
            let t = ((aci * 37) % 180) as f64 / 180.0;
            (
                0.2 + 0.6 * (t * PI).sin().abs(),
                0.2 + 0.6 * t,
                0.8 - 0.5 * t,
            )
        }
        _ => (0.0, 0.0, 0.0),
    }
}

fn stroke_width(line_weight: i32) -> f64 {
    if line_weight > 0 {
        ((line_weight as f64) / 100.0 * MM_TO_PT).max(0.25)
    } else {
        0.4
    }
}

fn dash_array(line_type: &str) -> Option<&'static str> {
    let kind = line_type.to_ascii_uppercase();
    if kind == "CONTINUOUS" || kind == "BYLAYER" || kind.is_empty() {
        return None;
    }
    if kind.contains("DASHDOT") || kind.contains("DIVIDE") {
        return Some("[8 3 1.5 3] 0 d");
    }
    if kind.contains("DASH") || kind.contains("HIDDEN") {
        return Some("[8 4] 0 d");
    }
    if kind.contains("DOT") {
        return Some("[1.5 3] 0 d");
    }
    None
}

fn fmt_n(value: f64) -> String {
    format!("{value:.4}")
}

fn set_stroke(out: &mut String, color: i32, line_weight: i32, line_type: &str) {
    let (r, g, b) = aci_rgb(color);
    let _ = writeln!(
        out,
        "{} {} {} RG {} w [] 0 d",
        fmt_n(r),
        fmt_n(g),
        fmt_n(b),
        fmt_n(stroke_width(line_weight))
    );
    if let Some(dash) = dash_array(line_type) {
        out.push_str(dash);
        out.push('\n');
    }
}

fn set_fill(out: &mut String, color: i32) {
    let (r, g, b) = aci_rgb(color);
    let _ = writeln!(out, "{} {} {} rg", fmt_n(r), fmt_n(g), fmt_n(b));
}

fn pdf_escape(text: &str) -> String {
    let mut out = String::new();
    for ch in text.chars() {
        let byte = if ch.is_ascii() && (' '..='~').contains(&ch) {
            ch
        } else {
            '?'
        };
        match byte {
            '\\' | '(' | ')' => {
                out.push('\\');
                out.push(byte);
            }
            _ => out.push(byte),
        }
    }
    out
}

struct PageXform {
    min_x: f64,
    min_y: f64,
    scale: f64,
    margin: f64,
}

impl PageXform {
    fn map(&self, x: f64, y: f64) -> (f64, f64) {
        (
            (x - self.min_x) * self.scale + self.margin,
            (y - self.min_y) * self.scale + self.margin,
        )
    }
}

fn polar(cx: f64, cy: f64, radius: f64, degrees: f64) -> (f64, f64) {
    let rad = degrees * PI / 180.0;
    (cx + radius * rad.cos(), cy + radius * rad.sin())
}

fn draw_entity(out: &mut String, entity: &DxfEntity, xform: &PageXform) {
    match entity {
        DxfEntity::Insert(_) => {}
        DxfEntity::Line(v) => {
            if !finite(v.x1) || !finite(v.y1) || !finite(v.x2) || !finite(v.y2) {
                return;
            }
            set_stroke(out, v.color, v.line_weight, &v.line_type);
            let (x1, y1) = xform.map(v.x1, v.y1);
            let (x2, y2) = xform.map(v.x2, v.y2);
            let _ = writeln!(
                out,
                "{} {} m {} {} l S",
                fmt_n(x1),
                fmt_n(y1),
                fmt_n(x2),
                fmt_n(y2)
            );
        }
        DxfEntity::Circle(v) => {
            if !finite(v.center_x) || !finite(v.center_y) || !finite(v.radius) {
                return;
            }
            set_stroke(out, v.color, v.line_weight, &v.line_type);
            let radius = v.radius.abs() * xform.scale;
            let (cx, cy) = xform.map(v.center_x, v.center_y);
            append_circle(out, cx, cy, radius);
            out.push_str(" S\n");
        }
        DxfEntity::Arc(v) => {
            if !finite(v.center_x)
                || !finite(v.center_y)
                || !finite(v.radius)
                || !finite(v.start_angle)
                || !finite(v.end_angle)
            {
                return;
            }
            set_stroke(out, v.color, v.line_weight, &v.line_type);
            let mut sweep = (v.end_angle - v.start_angle) % 360.0;
            if sweep <= 0.0 {
                sweep += 360.0;
            }
            let steps = ((sweep / 5.0).ceil() as i32).max(1);
            for i in 0..=steps {
                let angle = v.start_angle + sweep * (i as f64) / (steps as f64);
                let (wx, wy) = polar(v.center_x, v.center_y, v.radius, angle);
                let (x, y) = xform.map(wx, wy);
                if i == 0 {
                    let _ = writeln!(out, "{} {} m", fmt_n(x), fmt_n(y));
                } else {
                    let _ = writeln!(out, "{} {} l", fmt_n(x), fmt_n(y));
                }
            }
            out.push_str("S\n");
        }
        DxfEntity::Ellipse(v) => {
            if !finite(v.center_x)
                || !finite(v.center_y)
                || !finite(v.major_axis_x)
                || !finite(v.major_axis_y)
                || !finite(v.minor_ratio)
            {
                return;
            }
            set_stroke(out, v.color, v.line_weight, &v.line_type);
            let start = v.start_param;
            let mut end = v.end_param;
            if !finite(start) || !finite(end) {
                return;
            }
            if (end - start).abs() < f64::EPSILON {
                end = start + 2.0 * PI;
            }
            let steps = 72;
            for i in 0..=steps {
                let t = start + (end - start) * (i as f64) / (steps as f64);
                let wx = v.center_x
                    + v.major_axis_x * t.cos()
                    - v.major_axis_y * v.minor_ratio * t.sin();
                let wy = v.center_y
                    + v.major_axis_y * t.cos()
                    + v.major_axis_x * v.minor_ratio * t.sin();
                let (x, y) = xform.map(wx, wy);
                if i == 0 {
                    let _ = writeln!(out, "{} {} m", fmt_n(x), fmt_n(y));
                } else {
                    let _ = writeln!(out, "{} {} l", fmt_n(x), fmt_n(y));
                }
            }
            out.push_str("S\n");
        }
        DxfEntity::Point(v) => {
            if !finite(v.x) || !finite(v.y) {
                return;
            }
            set_fill(out, v.color);
            let (x, y) = xform.map(v.x, v.y);
            append_circle(out, x, y, 0.8);
            out.push_str(" f\n");
        }
        DxfEntity::Text(v) => {
            if !finite(v.x) || !finite(v.y) || v.content.is_empty() {
                return;
            }
            let ascii = pdf_escape(&v.content);
            if ascii.trim().is_empty() {
                return;
            }
            let (x, y) = xform.map(v.x, v.y);
            let size = (v.height * MM_TO_PT).max(4.0);
            let rot = v.rotation * PI / 180.0;
            let (r, g, b) = aci_rgb(v.color);
            let a = size * rot.cos();
            let b_comp = size * rot.sin();
            let _ = writeln!(
                out,
                "BT /F1 1 Tf {} {} {} rg {} {} {} {} {} {} Tm ({ascii}) Tj ET",
                fmt_n(r),
                fmt_n(g),
                fmt_n(b),
                fmt_n(a),
                fmt_n(b_comp),
                fmt_n(-b_comp),
                fmt_n(a),
                fmt_n(x),
                fmt_n(y)
            );
        }
        DxfEntity::Solid(v) => {
            let verts = [(v.x1, v.y1), (v.x2, v.y2), (v.x4, v.y4), (v.x3, v.y3)];
            append_polygon(out, xform, v.color, &verts);
        }
        DxfEntity::FilledPolygon(v) => {
            let verts: Vec<(f64, f64)> = v.points.iter().map(|p| (p.x, p.y)).collect();
            append_polygon(out, xform, v.color, &verts);
        }
    }
}

fn append_polygon(out: &mut String, xform: &PageXform, color: i32, verts: &[(f64, f64)]) {
    let finite_verts: Vec<(f64, f64)> = verts
        .iter()
        .copied()
        .filter(|(x, y)| finite(*x) && finite(*y))
        .collect();
    if finite_verts.len() < 3 {
        return;
    }
    set_fill(out, color);
    for (index, (wx, wy)) in finite_verts.iter().enumerate() {
        let (x, y) = xform.map(*wx, *wy);
        if index == 0 {
            let _ = writeln!(out, "{} {} m", fmt_n(x), fmt_n(y));
        } else {
            let _ = writeln!(out, "{} {} l", fmt_n(x), fmt_n(y));
        }
    }
    out.push_str("h f\n");
}

fn append_circle(out: &mut String, cx: f64, cy: f64, radius: f64) {
    let k = 0.5522847498 * radius;
    let _ = writeln!(out, "{} {} m", fmt_n(cx + radius), fmt_n(cy));
    let _ = writeln!(
        out,
        "{} {} {} {} {} {} c",
        fmt_n(cx + radius),
        fmt_n(cy + k),
        fmt_n(cx + k),
        fmt_n(cy + radius),
        fmt_n(cx),
        fmt_n(cy + radius)
    );
    let _ = writeln!(
        out,
        "{} {} {} {} {} {} c",
        fmt_n(cx - k),
        fmt_n(cy + radius),
        fmt_n(cx - radius),
        fmt_n(cy + k),
        fmt_n(cx - radius),
        fmt_n(cy)
    );
    let _ = writeln!(
        out,
        "{} {} {} {} {} {} c",
        fmt_n(cx - radius),
        fmt_n(cy - k),
        fmt_n(cx - k),
        fmt_n(cy - radius),
        fmt_n(cx),
        fmt_n(cy - radius)
    );
    let _ = writeln!(
        out,
        "{} {} {} {} {} {} c",
        fmt_n(cx + k),
        fmt_n(cy - radius),
        fmt_n(cx + radius),
        fmt_n(cy - k),
        fmt_n(cx + radius),
        fmt_n(cy)
    );
}

fn build_pdf(page_width: f64, page_height: f64, content: &str) -> Vec<u8> {
    let stream = format!(
        "<< /Length {} >>\nstream\n{content}endstream",
        content.len()
    );
    let objects = [
        "<< /Type /Catalog /Pages 2 0 R >>".to_string(),
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>".to_string(),
        format!(
            "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 {} {}] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
            fmt_n(page_width),
            fmt_n(page_height)
        ),
        stream,
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>".to_string(),
    ];
    let mut out = b"%PDF-1.4\n".to_vec();
    let mut offsets = Vec::with_capacity(objects.len());
    for (index, object) in objects.iter().enumerate() {
        offsets.push(out.len());
        let _ = write!(out, "{} 0 obj\n", index + 1);
        out.extend_from_slice(object.as_bytes());
        out.extend_from_slice(b"\nendobj\n");
    }
    let xref = out.len();
    let _ = write!(out, "xref\n0 {}\n", objects.len() + 1);
    out.extend_from_slice(b"0000000000 65535 f \n");
    for offset in offsets {
        let _ = write!(out, "{offset:010} 00000 n \n");
    }
    let _ = write!(
        out,
        "trailer<< /Size {} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF\n",
        objects.len() + 1
    );
    out
}

pub fn dxf_document_to_pdf(doc: &DxfDocument) -> Result<Vec<u8>, String> {
    let frozen: HashSet<&str> = doc
        .layers
        .iter()
        .filter(|layer| layer.frozen)
        .map(|layer| layer.name.as_str())
        .collect();
    let entities: Vec<&DxfEntity> = doc
        .entities
        .iter()
        .filter(|entity| {
            !matches!(entity, DxfEntity::Insert(_)) && !frozen.contains(entity_layer(entity))
        })
        .collect();

    let mut box_ = None;
    for entity in &entities {
        add_entity_points(&mut box_, entity);
    }

    let has_geometry = box_.is_some();
    let (min_x, min_y, width_mm, height_mm) = match box_ {
        Some(bounds) => (
            bounds.min_x,
            bounds.min_y,
            bounds.max_x - bounds.min_x + MARGIN_MM * 2.0,
            bounds.max_y - bounds.min_y + MARGIN_MM * 2.0,
        ),
        None => (0.0, 0.0, A4_WIDTH_MM, A4_HEIGHT_MM),
    };

    let mut scale = MM_TO_PT;
    let mut page_width = (width_mm * scale).max(10.0);
    let mut page_height = (height_mm * scale).max(10.0);
    let longest = page_width.max(page_height);
    if longest > MAX_PAGE_PT {
        scale *= MAX_PAGE_PT / longest;
        page_width = width_mm * scale;
        page_height = height_mm * scale;
    }
    let margin = if has_geometry {
        MARGIN_MM * scale
    } else {
        0.0
    };
    let xform = PageXform {
        min_x,
        min_y,
        scale,
        margin,
    };

    let mut content = String::new();
    content.push_str("q\n");
    for entity in entities {
        draw_entity(&mut content, entity, &xform);
    }
    content.push_str("Q\n");
    Ok(build_pdf(page_width, page_height, &content))
}
