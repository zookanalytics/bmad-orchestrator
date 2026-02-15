---
"@zookanalytics/keystone-workflows": patch
---

Improve core workflows for better reliability, security, and user experience

- Standardize step naming to camelCase
- Replace hardcoded temp file paths with dynamic `mktemp` generated paths
- Add existence checks before unlinking temp files in script steps
- Remove redundant "Final Evaluation" and "Final Sign-off" steps from epic workflow
- Sequential auto-fixes enabled for both Gemini and Claude reviews
- Add comprehensive documentation in `packages/keystone-workflows/README.md`
- Add `@zookanalytics/keystone-workflows` to the root `README.md`
- Add `use_tea` input to epic workflows to enable Test-Evidence-Architecture steps
