use std::fmt::Write as _;
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

use ttf_parser::{Face, OutlineBuilder};

pub struct CjkFont {
    data: Vec<u8>,
    index: u32,
}

impl CjkFont {
    pub fn face(&self) -> Option<Face<'_>> {
        Face::parse(&self.data, self.index).ok()
    }
}

fn candidate_font_paths() -> Vec<PathBuf> {
    let mut paths = Vec::new();
    let font_dirs = [
        std::env::var("WINDIR")
            .ok()
            .map(|windir| PathBuf::from(windir).join("Fonts")),
        Some(PathBuf::from(r"C:\Windows\Fonts")),
    ];
    for fonts in font_dirs.into_iter().flatten() {
        paths.extend([
            fonts.join("msgothic.ttc"),
            fonts.join("meiryo.ttc"),
            fonts.join("YuGothR.ttc"),
            fonts.join("yugothr.ttc"),
            fonts.join("BIZ-UDGothicR.ttc"),
            fonts.join("msmincho.ttc"),
        ]);
    }
    paths.extend([
        PathBuf::from("/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc"),
        PathBuf::from("/usr/share/fonts/opentype/noto/NotoSansCJKjp-Regular.otf"),
        PathBuf::from("/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"),
        PathBuf::from("/System/Library/Fonts/Hiragino Sans GB.ttc"),
    ]);
    paths
}

fn load_first_usable_font(paths: &[PathBuf]) -> Option<CjkFont> {
    for path in paths {
        if let Some(font) = load_font_path(path) {
            return Some(font);
        }
    }
    None
}

fn load_font_path(path: &Path) -> Option<CjkFont> {
    let data = std::fs::read(path).ok()?;
    let face_count = ttf_parser::fonts_in_collection(&data).unwrap_or(1);
    let mut chosen = None;
    for index in 0..face_count {
        let Ok(face) = Face::parse(&data, index) else {
            continue;
        };
        if face.glyph_index('あ').is_some() || face.glyph_index('平').is_some() {
            chosen = Some(index);
            break;
        }
    }
    chosen.map(|index| CjkFont { data, index })
}

pub fn system_cjk_font() -> Option<&'static CjkFont> {
    static FONT: OnceLock<Option<CjkFont>> = OnceLock::new();
    FONT.get_or_init(|| load_first_usable_font(&candidate_font_paths()))
        .as_ref()
}

pub fn loaded_cjk_face() -> Option<Face<'static>> {
    system_cjk_font()?.face()
}

struct PathSink<'a> {
    out: &'a mut String,
    origin_x: f64,
    origin_y: f64,
    pen_x: f64,
    pen_y: f64,
    scale: f64,
    width_factor: f64,
    cos: f64,
    sin: f64,
    last_x: f32,
    last_y: f32,
}

impl PathSink<'_> {
    fn map(&self, gx: f32, gy: f32) -> (f64, f64) {
        let local_x = self.pen_x + f64::from(gx) * self.scale * self.width_factor;
        let local_y = self.pen_y + f64::from(gy) * self.scale;
        let dx = local_x - self.origin_x;
        let dy = local_y - self.origin_y;
        (
            self.origin_x + dx * self.cos - dy * self.sin,
            self.origin_y + dx * self.sin + dy * self.cos,
        )
    }

    fn write_op(&mut self, op: &str, gx: f32, gy: f32) {
        let (x, y) = self.map(gx, gy);
        let _ = writeln!(self.out, "{:.4} {:.4} {op}", x, y);
        self.last_x = gx;
        self.last_y = gy;
    }
}

impl OutlineBuilder for PathSink<'_> {
    fn move_to(&mut self, x: f32, y: f32) {
        self.write_op("m", x, y);
    }

    fn line_to(&mut self, x: f32, y: f32) {
        self.write_op("l", x, y);
    }

    fn quad_to(&mut self, x1: f32, y1: f32, x: f32, y: f32) {
        let cx = self.last_x + (2.0 / 3.0) * (x1 - self.last_x);
        let cy = self.last_y + (2.0 / 3.0) * (y1 - self.last_y);
        let dx = x + (2.0 / 3.0) * (x1 - x);
        let dy = y + (2.0 / 3.0) * (y1 - y);
        let (x1p, y1p) = self.map(cx, cy);
        let (x2p, y2p) = self.map(dx, dy);
        let (x3p, y3p) = self.map(x, y);
        let _ = writeln!(
            self.out,
            "{:.4} {:.4} {:.4} {:.4} {:.4} {:.4} c",
            x1p, y1p, x2p, y2p, x3p, y3p
        );
        self.last_x = x;
        self.last_y = y;
    }

    fn curve_to(&mut self, x1: f32, y1: f32, x2: f32, y2: f32, x: f32, y: f32) {
        let (x1p, y1p) = self.map(x1, y1);
        let (x2p, y2p) = self.map(x2, y2);
        let (x3p, y3p) = self.map(x, y);
        let _ = writeln!(
            self.out,
            "{:.4} {:.4} {:.4} {:.4} {:.4} {:.4} c",
            x1p, y1p, x2p, y2p, x3p, y3p
        );
        self.last_x = x;
        self.last_y = y;
    }

    fn close(&mut self) {
        self.out.push_str("h\n");
    }
}

pub fn append_text_outlines(
    out: &mut String,
    face: &Face<'_>,
    text: &str,
    origin_x: f64,
    origin_y: f64,
    em_size: f64,
    width_factor: f64,
    rotation_deg: f64,
) -> bool {
    let units = f64::from(face.units_per_em());
    if units <= 0.0 || em_size <= 0.0 || text.is_empty() {
        return false;
    }
    let scale = em_size / units;
    let factor = if width_factor.is_finite() && width_factor > 0.0 {
        width_factor
    } else {
        1.0
    };
    let rad = rotation_deg * std::f64::consts::PI / 180.0;
    let mut sink = PathSink {
        out,
        origin_x,
        origin_y,
        pen_x: origin_x,
        pen_y: origin_y,
        scale,
        width_factor: factor,
        cos: rad.cos(),
        sin: rad.sin(),
        last_x: 0.0,
        last_y: 0.0,
    };
    let mut drew = false;
    for ch in text.chars() {
        if ch == '\n' || ch == '\r' {
            continue;
        }
        let Some(glyph_id) = face.glyph_index(ch) else {
            sink.pen_x += em_size * factor;
            continue;
        };
        if face.outline_glyph(glyph_id, &mut sink).is_some() {
            drew = true;
            sink.out.push_str("f\n");
        }
        let advance = face
            .glyph_hor_advance(glyph_id)
            .map(f64::from)
            .unwrap_or(units);
        sink.pen_x += advance * scale * factor;
    }
    drew
}

#[cfg(test)]
mod tests {
    use super::{append_text_outlines, loaded_cjk_face};

    #[test]
    fn japanese_glyphs_become_pdf_paths_not_question_marks() {
        let Some(face) = loaded_cjk_face() else {
            panic!("Windows CJK font (msgothic/meiryo/Yu Gothic) was not found");
        };
        let mut out = String::new();
        assert!(append_text_outlines(
            &mut out, &face, "平面", 10.0, 20.0, 12.0, 1.0, 0.0
        ));
        assert!(!out.contains('?'));
        assert!(out.contains(" m\n"), "{out}");
        assert!(out.contains("\nf\n"), "{out}");
    }
}
