import sys
import json
from services.docx_generator import build_docx_from_notes

def main():
    try:
        input_data = json.load(sys.stdin)
        markdown_text = input_data.get("markdown", "")
        title = input_data.get("title", "NotebookLM Notes")
        font = input_data.get("font", "Times New Roman")
        accent = input_data.get("accent", "#1A365D")

        buf = build_docx_from_notes(
            markdown_text=markdown_text,
            title=title,
            font_name=font,
            accent_hex=accent
        )
        sys.stdout.buffer.write(buf.read())
        sys.stdout.buffer.flush()
    except Exception as e:
        sys.stderr.write(f"Python docx generation error: {str(e)}\n")
        sys.exit(1)

if __name__ == "__main__":
    main()
