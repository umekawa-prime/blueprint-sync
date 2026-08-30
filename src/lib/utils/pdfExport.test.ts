import { describe, expect, it } from "vitest";
import { suggestedExportName } from "./pdfExport";

describe("suggestedExportName", () => {
  it("appends -annotated before the pdf extension", () => {
    expect(suggestedExportName("floor-plan.pdf")).toBe(
      "floor-plan-annotated.pdf",
    );
  });

  it("still adds a suffix when the name has no extension", () => {
    expect(suggestedExportName("図面")).toBe("図面-annotated.pdf");
  });
});
