"""Install pdfplumber and extract ground truth from the post-evaluation PDF."""
import subprocess
import sys
import os

# Install pdfplumber using the current Python interpreter
print("Installing pdfplumber...")
subprocess.check_call([sys.executable, "-m", "pip", "install", "pdfplumber", "-q"])
print("pdfplumber installed successfully.")

import pdfplumber

base = r"c:\Users\cho\Desktop\Temp\05 Code\260310_post_evaluation"
pdf_path = os.path.join(base, ".013_report_case", "99. 1. 사후평가서(최종).pdf")
output_path = os.path.join(base, "gt_output.txt")

print(f"Opening PDF: {pdf_path}")
print(f"File size: {os.path.getsize(pdf_path) / 1024 / 1024:.1f} MB")

output_lines = []

try:
    with pdfplumber.open(pdf_path) as pdf:
        total_pages = len(pdf.pages)
        output_lines.append(f"Total pages: {total_pages}")
        print(f"Total pages: {total_pages}")
        
        for i, page in enumerate(pdf.pages):
            text = page.extract_text()
            if text and text.strip():
                output_lines.append(f"\n===== Page {i+1} =====")
                output_lines.append(text)
                print(f"  Page {i+1}: {len(text)} chars extracted")
            else:
                # Try extracting tables
                tables = page.extract_tables()
                if tables:
                    output_lines.append(f"\n===== Page {i+1} (tables) =====")
                    for t_idx, table in enumerate(tables):
                        output_lines.append(f"--- Table {t_idx+1} ---")
                        for row in table:
                            row_str = " | ".join([str(cell) if cell else "" for cell in row])
                            output_lines.append(row_str)
                    print(f"  Page {i+1}: {len(tables)} tables extracted")
                else:
                    print(f"  Page {i+1}: empty (no text, no tables)")

    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(output_lines))
    
    print(f"\nDone! Output written to: {output_path}")
    print(f"Total output: {len(output_lines)} lines")

except Exception as e:
    print(f"Error with pdfplumber: {e}")
    print("Trying pypdf as fallback...")
    
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "pypdf", "-q"])
        from pypdf import PdfReader
        
        reader = PdfReader(pdf_path)
        output_lines = [f"Total pages: {len(reader.pages)}"]
        print(f"Total pages (pypdf): {len(reader.pages)}")
        
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            if text and text.strip():
                output_lines.append(f"\n===== Page {i+1} =====")
                output_lines.append(text)
                print(f"  Page {i+1}: {len(text)} chars")
        
        with open(output_path, "w", encoding="utf-8") as f:
            f.write("\n".join(output_lines))
        
        print(f"\nDone (pypdf)! Output written to: {output_path}")
    except Exception as e2:
        print(f"pypdf also failed: {e2}")
