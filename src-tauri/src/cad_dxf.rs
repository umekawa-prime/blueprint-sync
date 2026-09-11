use ezjww_core::dxf::{convert_document_with_options, ConvertOptions, DxfDocument};
use ezjww_core::format::{detect_format, CadFormat};
use ezjww_core::jwc::{convert_jwc_document, parse_jwc_document, JwcConvertOptions, JwcCoordinateSpace};
use ezjww_core::parser::parse_document;

const CONVERT: ConvertOptions = ConvertOptions {
    explode_inserts: true,
    max_block_nesting: 32,
    text_em_scale: 1.0,
};

pub fn cad_bytes_to_dxf(bytes: &[u8]) -> Result<DxfDocument, String> {
    match detect_format(bytes) {
        None => Err("JWW/JWCファイルではありません".to_string()),
        Some(CadFormat::Jww) => {
            let document = parse_document(bytes).map_err(|error| {
                format!("図面を読み込めませんでした: {error}")
            })?;
            Ok(convert_document_with_options(&document, CONVERT))
        }
        Some(CadFormat::Jwc) => {
            let document = parse_jwc_document(bytes).map_err(|error| {
                format!("図面を読み込めませんでした: {error}")
            })?;
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
    fn rejects_bytes_that_are_not_jww_or_jwc() {
        let error = cad_bytes_to_dxf(b"%PDF-1.4").unwrap_err();
        assert_eq!(error, "JWW/JWCファイルではありません");
    }

    #[test]
    fn rejects_a_truncated_jww_signature() {
        let error = cad_bytes_to_dxf(b"JwwData.").unwrap_err();
        assert!(
            error.starts_with("図面を読み込めませんでした"),
            "{error}"
        );
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
    }
}
