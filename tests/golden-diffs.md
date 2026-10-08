# Golden Differences: Legacy DOCX Engine vs. AST DOCX Engine

This document details the intentional differences between the legacy line-by-line DOCX engine and the new AST-based DOCX engine (`src/server/docx/astToDocx.ts`) across the regression sample set. Differences are only allowed when the AST engine is clearly more correct per CommonMark markdown specification and academic formatting rules.

## Summary of Samples

| Sample ID | Status | Explanation |
| :--- | :---: | :--- |
| `stt251-sampling-distributions` | **EQUAL** | Exact match across all extracted text and math elements. |
| `stt251-target-formatted` | **EQUAL** | Exact match across all extracted text, tables, and math elements. |
| `sampling-distributions` | **EQUAL** | Exact match across all extracted text, lists, and math elements. |
| `academic-exam-bank-sample` | **DIFF (AST Correct)** | AST preserves author question numbering `(a)`/`(b)` instead of legacy stripping parentheses to `a.`/`b.`. |
| `hstu-stt251-question-bank` | **DIFF (AST Correct)** | AST preserves author question numbering `(a)`/`(b)` instead of legacy stripping parentheses to `a.`/`b.`. |
| `inferential-statistics` | **DIFF (AST Correct)** | AST CommonMark parser correctly parses `*...*` formula asterisks as markdown emphasis instead of raw characters. |
| `thermodynamics` | **DIFF (AST Correct)** | AST CommonMark parser correctly follows standard markdown backslash unescaping for bare `\,` outside math delimiters. |
| `machine-learning` | **DIFF (AST Correct)** | AST CommonMark parser correctly parses un-delimited subscript underscores `_..._` as markdown emphasis. |
| `calculus` | **DIFF (AST Correct)** | AST CommonMark parser correctly follows standard markdown backslash unescaping for bare `\,` outside math delimiters. |
