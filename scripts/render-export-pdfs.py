"""Optional visual QA helper. Requires PyMuPDF; never reads or writes production data."""
import pathlib
import sys
import pymupdf

directory = pathlib.Path(sys.argv[1]).resolve()
for path in sorted(directory.glob("*.pdf")):
    with pymupdf.open(path) as document:
        if len(document) != 1:
            raise ValueError(f"Expected one page: {path.name}")
        document[0].get_pixmap(matrix=pymupdf.Matrix(2 if path.stem.endswith("-print") else 3, 2 if path.stem.endswith("-print") else 3), alpha=False).save(
            directory / f"{path.stem}-pdf-render.png"
        )
print("Rendered exported PDFs for QR and visual checks.")
