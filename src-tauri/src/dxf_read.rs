use ezjww_core::dxf::{
    DxfArc, DxfBlock, DxfCircle, DxfDocument, DxfEllipse, DxfEntity, DxfInsert, DxfLayer, DxfLine,
    DxfPoint, DxfSolid, DxfText,
};
use std::collections::HashMap;
use std::f64::consts::PI;

const BINARY_HEADER: &[u8] = b"AutoCAD Binary DXF";

pub fn is_binary_dxf(bytes: &[u8]) -> bool {
    bytes.starts_with(BINARY_HEADER)
}

pub fn looks_like_ascii_dxf(bytes: &[u8]) -> bool {
    if is_binary_dxf(bytes) {
        return false;
    }
    let text = decode_dxf_text(bytes);
    for (code, value) in DxfPairs::new(&text) {
        if code == 999 {
            continue;
        }
        return code == 0 && value.eq_ignore_ascii_case("SECTION");
    }
    false
}

pub fn parse_ascii_dxf(bytes: &[u8]) -> Result<DxfDocument, String> {
    if is_binary_dxf(bytes) {
        return Err("バイナリDXFには未対応です".to_string());
    }
    let text = decode_dxf_text(bytes);
    let mut parser = DxfParser::default();
    parser.read_pairs(DxfPairs::new(&text))?;
    parser.into_document()
}

fn decode_dxf_text(bytes: &[u8]) -> String {
    let without_bom = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]).unwrap_or(bytes);
    match std::str::from_utf8(without_bom) {
        Ok(text) => text.to_string(),
        Err(_) => String::from_utf8_lossy(without_bom).into_owned(),
    }
}

struct DxfPairs<'a> {
    lines: Vec<&'a str>,
    index: usize,
}

impl<'a> DxfPairs<'a> {
    fn new(text: &'a str) -> Self {
        Self {
            lines: text.split('\n').map(|line| line.trim_end_matches('\r')).collect(),
            index: 0,
        }
    }
}

impl<'a> Iterator for DxfPairs<'a> {
    type Item = (i32, &'a str);

    fn next(&mut self) -> Option<Self::Item> {
        while self.index + 1 < self.lines.len() {
            let code_line = self.lines[self.index].trim();
            let value = self.lines[self.index + 1].trim();
            self.index += 2;
            if let Ok(code) = code_line.parse::<i32>() {
                return Some((code, value));
            }
            self.index -= 1;
        }
        None
    }
}

#[derive(Default)]
struct DxfParser {
    section: String,
    table: String,
    layers: Vec<DxfLayer>,
    blocks: Vec<DxfBlock>,
    entities: Vec<DxfEntity>,
    unsupported: Vec<String>,
    current_block: Option<DxfBlock>,
    current_entity: Option<PendingEntity>,
    current_layer: Option<PendingLayer>,
    pending_vertex: Option<PendingEntity>,
}

#[derive(Default)]
struct PendingLayer {
    name: String,
    color: i32,
    flags: i32,
}

struct PendingEntity {
    kind: String,
    layer: String,
    color: i32,
    line_type: String,
    line_weight: i32,
    x: f64,
    y: f64,
    x2: f64,
    y2: f64,
    x3: f64,
    y3: f64,
    x4: f64,
    y4: f64,
    radius: f64,
    start: f64,
    end: f64,
    ratio: f64,
    start_param: f64,
    end_param: f64,
    height: f64,
    width_factor: f64,
    rotation: f64,
    scale_x: f64,
    scale_y: f64,
    content: String,
    extra_text: String,
    style: String,
    block_name: String,
    closed: bool,
    vertices: Vec<(f64, f64, f64)>,
    bulge: f64,
}

impl Default for PendingEntity {
    fn default() -> Self {
        Self {
            kind: String::new(),
            layer: "0".into(),
            color: 256,
            line_type: "BYLAYER".into(),
            line_weight: -1,
            x: 0.0,
            y: 0.0,
            x2: 0.0,
            y2: 0.0,
            x3: 0.0,
            y3: 0.0,
            x4: 0.0,
            y4: 0.0,
            radius: 0.0,
            start: 0.0,
            end: 0.0,
            ratio: 1.0,
            start_param: 0.0,
            end_param: 2.0 * PI,
            height: 2.5,
            width_factor: 1.0,
            rotation: 0.0,
            scale_x: 1.0,
            scale_y: 1.0,
            content: String::new(),
            extra_text: String::new(),
            style: "STANDARD".into(),
            block_name: String::new(),
            closed: false,
            vertices: Vec::new(),
            bulge: 0.0,
        }
    }
}

impl DxfParser {
    fn read_pairs(&mut self, pairs: DxfPairs<'_>) -> Result<(), String> {
        for (code, value) in pairs {
            self.feed(code, value)?;
        }
        self.flush_entity();
        self.flush_layer();
        self.flush_block();
        Ok(())
    }

    fn feed(&mut self, code: i32, value: &str) -> Result<(), String> {
        if code == 0 {
            let name = value.to_ascii_uppercase();
            match name.as_str() {
                "SECTION" => {
                    self.flush_entity();
                    self.section.clear();
                }
                "ENDSEC" => {
                    self.flush_entity();
                    self.section.clear();
                    self.table.clear();
                }
                "TABLE" => {
                    self.flush_layer();
                    self.table.clear();
                }
                "ENDTAB" => {
                    self.flush_layer();
                    self.table.clear();
                }
                "BLOCK" => {
                    self.flush_entity();
                    self.flush_block();
                    self.current_block = Some(DxfBlock {
                        name: String::new(),
                        base_x: 0.0,
                        base_y: 0.0,
                        entities: Vec::new(),
                    });
                }
                "ENDBLK" => {
                    self.flush_entity();
                    self.flush_block();
                }
                "LAYER" if self.table == "LAYER" => {
                    self.flush_layer();
                    self.current_layer = Some(PendingLayer::default());
                }
                "EOF" => self.flush_entity(),
                _ => {
                    if self.section == "ENTITIES" || self.section == "BLOCKS" || self.current_block.is_some()
                    {
                        self.start_entity(name);
                    }
                }
            }
            return Ok(());
        }

        if code == 2 && self.section.is_empty() {
            self.section = value.to_ascii_uppercase();
            return Ok(());
        }
        if code == 2 && self.table.is_empty() && self.section == "TABLES" && self.current_layer.is_none()
        {
            self.table = value.to_ascii_uppercase();
            return Ok(());
        }

        if let Some(layer) = self.current_layer.as_mut() {
            match code {
                2 => layer.name = value.to_string(),
                62 => layer.color = parse_i32(value),
                70 => layer.flags = parse_i32(value),
                _ => {}
            }
            return Ok(());
        }

        if let Some(block) = self.current_block.as_mut() {
            if self.current_entity.is_none() {
                match code {
                    2 if block.name.is_empty() => block.name = value.to_string(),
                    10 => block.base_x = parse_f64(value),
                    20 => block.base_y = parse_f64(value),
                    _ => {}
                }
                if self.current_entity.is_none() {
                    return Ok(());
                }
            }
        }

        if let Some(entity) = self.pending_vertex.as_mut().or(self.current_entity.as_mut()) {
            apply_entity_group(entity, code, value);
        }
        Ok(())
    }

    fn start_entity(&mut self, kind: String) {
        if kind == "VERTEX" {
            if self
                .current_entity
                .as_ref()
                .is_some_and(|entity| entity.kind == "POLYLINE")
            {
                self.pending_vertex = Some(PendingEntity {
                    kind,
                    ..PendingEntity::default()
                });
                return;
            }
        }
        if kind == "SEQEND" {
            self.take_vertex_into_polyline();
            self.flush_entity();
            return;
        }
        self.take_vertex_into_polyline();
        self.flush_entity();
        self.current_entity = Some(PendingEntity {
            kind,
            ..PendingEntity::default()
        });
    }

    fn take_vertex_into_polyline(&mut self) {
        let Some(vertex) = self.pending_vertex.take() else {
            return;
        };
        if let Some(polyline) = self.current_entity.as_mut() {
            if polyline.kind == "POLYLINE" {
                polyline.vertices.push((vertex.x, vertex.y, vertex.bulge));
            }
        }
    }

    fn flush_layer(&mut self) {
        if let Some(layer) = self.current_layer.take() {
            if !layer.name.is_empty() {
                self.layers.push(DxfLayer {
                    name: layer.name,
                    color: layer.color,
                    line_type: "CONTINUOUS".into(),
                    frozen: layer.flags & 1 != 0,
                    locked: layer.flags & 4 != 0,
                });
            }
        }
    }

    fn flush_block(&mut self) {
        if let Some(block) = self.current_block.take() {
            if !block.name.is_empty() {
                self.blocks.push(block);
            }
        }
    }

    fn flush_entity(&mut self) {
        self.take_vertex_into_polyline();
        let Some(pending) = self.current_entity.take() else {
            return;
        };
        if pending.kind == "VERTEX" || pending.kind == "SEQEND" {
            return;
        }
        let built = build_entities(pending);
        if built.is_empty() {
            return;
        }
        if let Some(block) = self.current_block.as_mut() {
            block.entities.extend(built);
        } else {
            self.entities.extend(built);
        }
    }

    fn into_document(mut self) -> Result<DxfDocument, String> {
        self.entities = explode_inserts(self.entities, &self.blocks);
        if self.entities.is_empty() {
            return Err("図面を読み込めませんでした: 図形がありません".to_string());
        }
        Ok(DxfDocument {
            layers: self.layers,
            entities: self.entities,
            blocks: self.blocks,
            unsupported_entities: self.unsupported,
        })
    }
}

fn apply_entity_group(entity: &mut PendingEntity, code: i32, value: &str) {
    match code {
        8 => entity.layer = value.to_string(),
        6 => entity.line_type = value.to_string(),
        2 => entity.block_name = value.to_string(),
        1 => entity.content = value.to_string(),
        3 => entity.extra_text.push_str(value),
        7 => entity.style = value.to_string(),
        10 => {
            if matches!(entity.kind.as_str(), "LWPOLYLINE") {
                entity.vertices.push((parse_f64(value), 0.0, 0.0));
            } else {
                entity.x = parse_f64(value);
            }
        }
        20 => {
            if matches!(entity.kind.as_str(), "LWPOLYLINE") {
                if let Some(last) = entity.vertices.last_mut() {
                    last.1 = parse_f64(value);
                }
            } else {
                entity.y = parse_f64(value);
            }
        }
        11 => entity.x2 = parse_f64(value),
        21 => entity.y2 = parse_f64(value),
        12 => entity.x3 = parse_f64(value),
        22 => entity.y3 = parse_f64(value),
        13 => entity.x4 = parse_f64(value),
        23 => entity.y4 = parse_f64(value),
        40 => {
            if entity.kind == "CIRCLE" || entity.kind == "ARC" {
                entity.radius = parse_f64(value);
            } else {
                entity.height = parse_f64(value);
            }
        }
        41 => {
            if entity.kind == "ELLIPSE" {
                entity.ratio = parse_f64(value);
            } else if entity.kind == "INSERT" {
                entity.scale_x = parse_f64(value);
            } else {
                entity.width_factor = parse_f64(value);
            }
        }
        42 => {
            if entity.kind == "LWPOLYLINE" {
                if let Some(last) = entity.vertices.last_mut() {
                    last.2 = parse_f64(value);
                }
            } else if entity.kind == "INSERT" {
                entity.scale_y = parse_f64(value);
            } else {
                entity.bulge = parse_f64(value);
            }
        }
        50 => {
            if entity.kind == "ARC" {
                entity.start = parse_f64(value);
            } else {
                entity.rotation = parse_f64(value);
            }
        }
        51 => entity.end = parse_f64(value),
        62 => entity.color = parse_i32(value),
        70 => entity.closed = parse_i32(value) & 1 != 0,
        370 => entity.line_weight = parse_i32(value),
        _ => {}
    }
}

fn build_entities(pending: PendingEntity) -> Vec<DxfEntity> {
    match pending.kind.as_str() {
        "LINE" => vec![DxfEntity::Line(DxfLine {
            layer: pending.layer,
            color: pending.color,
            line_type: pending.line_type,
            line_weight: pending.line_weight,
            x1: pending.x,
            y1: pending.y,
            x2: pending.x2,
            y2: pending.y2,
        })],
        "CIRCLE" => vec![DxfEntity::Circle(DxfCircle {
            layer: pending.layer,
            color: pending.color,
            line_type: pending.line_type,
            line_weight: pending.line_weight,
            center_x: pending.x,
            center_y: pending.y,
            radius: pending.radius,
        })],
        "ARC" => vec![DxfEntity::Arc(DxfArc {
            layer: pending.layer,
            color: pending.color,
            line_type: pending.line_type,
            line_weight: pending.line_weight,
            center_x: pending.x,
            center_y: pending.y,
            radius: pending.radius,
            start_angle: pending.start,
            end_angle: pending.end,
        })],
        "ELLIPSE" => vec![DxfEntity::Ellipse(DxfEllipse {
            layer: pending.layer,
            color: pending.color,
            line_type: pending.line_type,
            line_weight: pending.line_weight,
            center_x: pending.x,
            center_y: pending.y,
            major_axis_x: pending.x2,
            major_axis_y: pending.y2,
            minor_ratio: pending.ratio,
            start_param: pending.start_param,
            end_param: pending.end_param,
        })],
        "POINT" => vec![DxfEntity::Point(DxfPoint {
            layer: pending.layer,
            color: pending.color,
            line_type: pending.line_type,
            x: pending.x,
            y: pending.y,
        })],
        "TEXT" | "MTEXT" => {
            let content = if pending.kind == "MTEXT" {
                strip_mtext(&format!("{}{}", pending.extra_text, pending.content))
            } else {
                pending.content
            };
            vec![DxfEntity::Text(DxfText {
                layer: pending.layer,
                color: pending.color,
                line_type: pending.line_type,
                x: pending.x,
                y: pending.y,
                end_x: pending.x2,
                end_y: pending.y2,
                height: pending.height,
                width_factor: pending.width_factor,
                rotation: pending.rotation,
                content,
                style: pending.style,
            })]
        }
        "SOLID" => vec![DxfEntity::Solid(DxfSolid {
            layer: pending.layer,
            color: pending.color,
            line_type: pending.line_type,
            line_weight: pending.line_weight,
            x1: pending.x,
            y1: pending.y,
            x2: pending.x2,
            y2: pending.y2,
            x3: pending.x4,
            y3: pending.y4,
            x4: pending.x3,
            y4: pending.y3,
        })],
        "LWPOLYLINE" | "POLYLINE" => polyline_entities(&pending),
        "INSERT" => vec![DxfEntity::Insert(DxfInsert {
            layer: pending.layer,
            color: pending.color,
            line_type: pending.line_type,
            block_name: pending.block_name,
            x: pending.x,
            y: pending.y,
            scale_x: pending.scale_x,
            scale_y: pending.scale_y,
            rotation: pending.rotation,
        })],
        _ => Vec::new(),
    }
}

fn polyline_entities(pending: &PendingEntity) -> Vec<DxfEntity> {
    if pending.vertices.len() < 2 {
        if pending.vertices.len() == 1 {
            return vec![DxfEntity::Point(DxfPoint {
                layer: pending.layer.clone(),
                color: pending.color,
                line_type: pending.line_type.clone(),
                x: pending.vertices[0].0,
                y: pending.vertices[0].1,
            })];
        }
        return Vec::new();
    }
    let mut points: Vec<(f64, f64, f64)> = pending.vertices.clone();
    if pending.closed {
        points.push(points[0]);
    }
    let mut entities = Vec::new();
    for pair in points.windows(2) {
        let (x1, y1, bulge) = pair[0];
        let (x2, y2, _) = pair[1];
        if bulge.abs() > 1e-12 {
            if let Some(arc) = arc_from_bulge(pending, x1, y1, x2, y2, bulge) {
                entities.push(DxfEntity::Arc(arc));
                continue;
            }
        }
        entities.push(DxfEntity::Line(DxfLine {
            layer: pending.layer.clone(),
            color: pending.color,
            line_type: pending.line_type.clone(),
            line_weight: pending.line_weight,
            x1,
            y1,
            x2,
            y2,
        }));
    }
    entities
}

fn arc_from_bulge(
    pending: &PendingEntity,
    x1: f64,
    y1: f64,
    x2: f64,
    y2: f64,
    bulge: f64,
) -> Option<DxfArc> {
    let dx = x2 - x1;
    let dy = y2 - y1;
    let chord = dx.hypot(dy);
    if chord < 1e-12 {
        return None;
    }
    let included = 4.0 * bulge.atan();
    let half = included * 0.5;
    let radius = chord / (2.0 * half.sin().abs());
    let dist = (radius * radius - (chord * 0.5).powi(2)).sqrt();
    let side = if bulge.abs() <= 1.0 { 1.0 } else { -1.0 };
    let sign = bulge.signum() * side;
    let cx = (x1 + x2) * 0.5 + (-dy / chord) * dist * sign;
    let cy = (y1 + y2) * 0.5 + (dx / chord) * dist * sign;
    let start = (y1 - cy).atan2(x1 - cx).to_degrees();
    let end = (y2 - cy).atan2(x2 - cx).to_degrees();
    let (start_angle, end_angle) = if bulge >= 0.0 {
        (start, end)
    } else {
        (end, start)
    };
    Some(DxfArc {
        layer: pending.layer.clone(),
        color: pending.color,
        line_type: pending.line_type.clone(),
        line_weight: pending.line_weight,
        center_x: cx,
        center_y: cy,
        radius,
        start_angle,
        end_angle,
    })
}

fn strip_mtext(raw: &str) -> String {
    let mut out = String::new();
    let mut chars = raw.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '{' {
            continue;
        }
        if ch == '}' {
            continue;
        }
        if ch == '\\' {
            match chars.peek().copied() {
                Some('P' | 'p') => {
                    chars.next();
                    out.push('\n');
                }
                Some('~') => {
                    chars.next();
                    out.push(' ');
                }
                Some(next) if next.is_ascii_alphabetic() => {
                    while let Some(consumed) = chars.next() {
                        if consumed == ';' {
                            break;
                        }
                    }
                }
                Some(_) => {
                    if let Some(escaped) = chars.next() {
                        out.push(escaped);
                    }
                }
                None => {}
            }
            continue;
        }
        out.push(ch);
    }
    out
}

fn explode_inserts(entities: Vec<DxfEntity>, blocks: &[DxfBlock]) -> Vec<DxfEntity> {
    let by_name: HashMap<&str, &DxfBlock> = blocks
        .iter()
        .map(|block| (block.name.as_str(), block))
        .collect();
    let mut out = Vec::new();
    for entity in entities {
        match entity {
            DxfEntity::Insert(insert) => {
                if let Some(block) = by_name.get(insert.block_name.as_str()) {
                    out.extend(transform_block_entities(block, &insert, &by_name, 0));
                }
            }
            other => out.push(other),
        }
    }
    out
}

fn transform_block_entities(
    block: &DxfBlock,
    insert: &DxfInsert,
    by_name: &HashMap<&str, &DxfBlock>,
    depth: usize,
) -> Vec<DxfEntity> {
    if depth > 32 {
        return Vec::new();
    }
    let mut out = Vec::new();
    for entity in &block.entities {
        match entity {
            DxfEntity::Insert(nested) => {
                if let Some(child) = by_name.get(nested.block_name.as_str()) {
                    let combined = DxfInsert {
                        layer: nested.layer.clone(),
                        color: nested.color,
                        line_type: nested.line_type.clone(),
                        block_name: nested.block_name.clone(),
                        x: transform_x(nested.x, nested.y, block, insert),
                        y: transform_y(nested.x, nested.y, block, insert),
                        scale_x: insert.scale_x * nested.scale_x,
                        scale_y: insert.scale_y * nested.scale_y,
                        rotation: insert.rotation + nested.rotation,
                    };
                    out.extend(transform_block_entities(child, &combined, by_name, depth + 1));
                }
            }
            DxfEntity::Line(line) => out.push(DxfEntity::Line(DxfLine {
                layer: line.layer.clone(),
                color: line.color,
                line_type: line.line_type.clone(),
                line_weight: line.line_weight,
                x1: transform_x(line.x1, line.y1, block, insert),
                y1: transform_y(line.x1, line.y1, block, insert),
                x2: transform_x(line.x2, line.y2, block, insert),
                y2: transform_y(line.x2, line.y2, block, insert),
            })),
            DxfEntity::Circle(circle) => out.push(DxfEntity::Circle(DxfCircle {
                layer: circle.layer.clone(),
                color: circle.color,
                line_type: circle.line_type.clone(),
                line_weight: circle.line_weight,
                center_x: transform_x(circle.center_x, circle.center_y, block, insert),
                center_y: transform_y(circle.center_x, circle.center_y, block, insert),
                radius: circle.radius * insert.scale_x.abs().max(insert.scale_y.abs()),
            })),
            DxfEntity::Arc(arc) => out.push(DxfEntity::Arc(DxfArc {
                layer: arc.layer.clone(),
                color: arc.color,
                line_type: arc.line_type.clone(),
                line_weight: arc.line_weight,
                center_x: transform_x(arc.center_x, arc.center_y, block, insert),
                center_y: transform_y(arc.center_x, arc.center_y, block, insert),
                radius: arc.radius * insert.scale_x.abs().max(insert.scale_y.abs()),
                start_angle: arc.start_angle + insert.rotation,
                end_angle: arc.end_angle + insert.rotation,
            })),
            DxfEntity::Text(text) => out.push(DxfEntity::Text(DxfText {
                layer: text.layer.clone(),
                color: text.color,
                line_type: text.line_type.clone(),
                x: transform_x(text.x, text.y, block, insert),
                y: transform_y(text.x, text.y, block, insert),
                end_x: transform_x(text.end_x, text.end_y, block, insert),
                end_y: transform_y(text.end_x, text.end_y, block, insert),
                height: text.height * insert.scale_y.abs(),
                width_factor: text.width_factor,
                rotation: text.rotation + insert.rotation,
                content: text.content.clone(),
                style: text.style.clone(),
            })),
            DxfEntity::Point(point) => out.push(DxfEntity::Point(DxfPoint {
                layer: point.layer.clone(),
                color: point.color,
                line_type: point.line_type.clone(),
                x: transform_x(point.x, point.y, block, insert),
                y: transform_y(point.x, point.y, block, insert),
            })),
            DxfEntity::Ellipse(_) | DxfEntity::Solid(_) | DxfEntity::FilledPolygon(_) => {}
        }
    }
    out
}

fn transform_x(x: f64, y: f64, block: &DxfBlock, insert: &DxfInsert) -> f64 {
    let (tx, _) = transform_point(x, y, block, insert);
    tx
}

fn transform_y(x: f64, y: f64, block: &DxfBlock, insert: &DxfInsert) -> f64 {
    let (_, ty) = transform_point(x, y, block, insert);
    ty
}

fn transform_point(x: f64, y: f64, block: &DxfBlock, insert: &DxfInsert) -> (f64, f64) {
    let px = (x - block.base_x) * insert.scale_x;
    let py = (y - block.base_y) * insert.scale_y;
    let rad = insert.rotation.to_radians();
    let cos = rad.cos();
    let sin = rad.sin();
    (px * cos - py * sin + insert.x, px * sin + py * cos + insert.y)
}

fn parse_f64(value: &str) -> f64 {
    value.parse().unwrap_or(0.0)
}

fn parse_i32(value: &str) -> i32 {
    value.parse().unwrap_or(0)
}
