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

#[cfg(test)]
mod tests {
    use super::cad_bytes_to_dxf;

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
}
