use ezjww_core::dxf::{convert_document_with_options, ConvertOptions, DxfDocument};
use ezjww_core::format::{detect_format, CadFormat};
use ezjww_core::jwc::{
    convert_jwc_document, parse_jwc_document, JwcConvertOptions, JwcCoordinateSpace,
};
use ezjww_core::parser::parse_document;

const CONVERT: ConvertOptions = ConvertOptions {
    explode_inserts: true,
    max_block_nesting: 32,
    text_em_scale: 1.0,
};

pub fn cad_bytes_to_dxf(bytes: &[u8]) -> Result<DxfDocument, String> {
    match detect_format(bytes) {
        Some(CadFormat::Jww) => {
            let document = parse_document(bytes)
                .map_err(|error| format!("図面を読み込めませんでした: {error}"))?;
            Ok(convert_document_with_options(&document, CONVERT))
        }
        Some(CadFormat::Jwc) => {
            let document = parse_jwc_document(bytes)
                .map_err(|error| format!("図面を読み込めませんでした: {error}"))?;
            let converted = convert_jwc_document(
                &document,
                JwcConvertOptions {
                    coordinates: JwcCoordinateSpace::PaperMillimeters,
                    dxf: CONVERT,
                },
            )
            .map_err(|error| format!("図面を読み込めませんでした: {error}"))?;
            Ok(converted.document)
        }
        None if crate::dxf_read::is_binary_dxf(bytes) => {
            Err("バイナリDXFには未対応です".to_string())
        }
        None if crate::dxf_read::looks_like_ascii_dxf(bytes) => crate::dxf_read::parse_ascii_dxf(bytes),
        None => Err("JWW/JWC/DXFファイルではありません".to_string()),
    }
}

pub fn cad_bytes_to_dxf_json(bytes: &[u8]) -> Result<serde_json::Value, String> {
    let document = cad_bytes_to_dxf(bytes)?;
    serde_json::to_value(&document).map_err(|error| error.to_string())
}

pub fn cad_bytes_to_pdf(bytes: &[u8]) -> Result<Vec<u8>, String> {
    let document = cad_bytes_to_dxf(bytes)?;
    crate::cad_pdf::dxf_document_to_pdf(&document)
}

#[cfg(test)]
mod tests {
    use super::{cad_bytes_to_dxf, cad_bytes_to_pdf};

    #[test]
    fn rejects_bytes_that_are_not_cad() {
        let error = cad_bytes_to_dxf(b"%PDF-1.4").unwrap_err();
        assert_eq!(error, "JWW/JWC/DXFファイルではありません");
    }

    fn sample_line_dxf() -> Vec<u8> {
        b"  0\nSECTION\n  2\nENTITIES\n  0\nLINE\n  8\n0\n 10\n0.0\n 20\n0.0\n 11\n100.0\n 21\n50.0\n  0\nENDSEC\n  0\nEOF\n".to_vec()
    }

    #[test]
    fn parses_an_ascii_dxf_line() {
        let document = cad_bytes_to_dxf(&sample_line_dxf()).expect("ascii dxf should parse");
        assert_eq!(document.entities.len(), 1);
        match &document.entities[0] {
            ezjww_core::dxf::DxfEntity::Line(line) => {
                assert_eq!((line.x1, line.y1, line.x2, line.y2), (0.0, 0.0, 100.0, 50.0));
            }
            other => panic!("expected a line, got {other:?}"),
        }
    }

    #[test]
    fn converts_an_ascii_dxf_to_a_pdf() {
        let pdf = cad_bytes_to_pdf(&sample_line_dxf()).expect("ascii dxf should convert to pdf");
        assert!(
            pdf.starts_with(b"%PDF"),
            "expected a pdf header, got {:?}",
            pdf.get(..8)
        );
    }

    #[test]
    fn rejects_binary_dxf() {
        let error = cad_bytes_to_dxf(b"AutoCAD Binary DXF\r\n\x1a\x00").unwrap_err();
        assert!(error.contains("バイナリ"), "{error}");
    }

    #[test]
    fn rejects_a_truncated_jww_signature() {
        let error = cad_bytes_to_dxf(b"JwwData.").unwrap_err();
        assert!(error.starts_with("図面を読み込めませんでした"), "{error}");
    }

    #[test]
    fn parses_the_sample_floor_plan_jww() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../sample/03_平面図0829_配布用.jww");
        let bytes = std::fs::read(&path).unwrap_or_else(|error| panic!("read {path:?}: {error}"));
        let document = cad_bytes_to_dxf(&bytes).expect("sample jww should parse");
        assert!(
            !document.entities.is_empty(),
            "expected drawing entities, got none"
        );
    }

    #[test]
    fn converts_the_sample_floor_plan_jww_to_a_pdf() {
        let path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
            .join("../sample/03_平面図0829_配布用.jww");
        let bytes = std::fs::read(&path).unwrap_or_else(|error| panic!("read {path:?}: {error}"));
        let pdf = cad_bytes_to_pdf(&bytes).expect("sample jww should convert to pdf");
        assert!(
            pdf.starts_with(b"%PDF"),
            "expected a pdf header, got {:?}",
            pdf.get(..8)
        );
        assert!(
            pdf.len() > 10_000,
            "expected drawing content, got {} bytes",
            pdf.len()
        );
        let as_text = String::from_utf8_lossy(&pdf);
        assert!(
            !as_text.contains("(???"),
            "CAD Japanese text was replaced with question marks"
        );
    }
}
