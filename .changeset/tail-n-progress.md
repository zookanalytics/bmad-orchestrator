---
"@zookanalytics/agent-env": minor
---

Replace the single-line rebuild progress display with a fixed-height tail window (default 5 lines), redrawn in place via cursor-up + erase-line. Recent subprocess output stays visible during long steps without flooding the terminal. First-update output is bit-for-bit identical, so existing single-line behaviour is preserved when only one line has been seen.
