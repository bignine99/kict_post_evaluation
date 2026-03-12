import fitz
import os

base = r"c:\Users\cho\Desktop\Temp\05 Code\260310_post_evaluation"
path = os.path.join(base, ".013_report_case", "99. 1. 사후평가서(최종).pdf")

doc = fitz.open(path)
output = []
output.append(f"Total pages: {doc.page_count}")

for i in range(min(doc.page_count, 10)):
    text = doc[i].get_text("text")
    if text.strip():
        output.append(f"\n===== Page {i+1} =====")
        output.append(text[:3000])

doc.close()

out_path = os.path.join(base, "gt_output.txt")
with open(out_path, "w", encoding="utf-8") as f:
    f.write("\n".join(output))
print(f"Done. Output written to {out_path}")
