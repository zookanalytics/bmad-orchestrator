# TODO: Retro Followup

Development roadmap for bmm-workflow-retro-followup module.

---

## Workflows to Build

- [ ] **retro-followup**
  - Use: `/bmad-bmb-workflow` (workflow-builder)
  - Spec: `workflows/retro-followup/retro-followup.spec.md`
  - Design: `_bmad-output/planning-artifacts/bmm-retrospective-module/2026-01-29-retro-followup-design.md`

- [ ] **retro-item-execute**
  - Use: `/bmad-bmb-workflow` (workflow-builder)
  - Spec: `workflows/retro-item-execute/retro-item-execute.spec.md`

---

## Testing

- [ ] Test `retro-followup` with simple table format retro
- [ ] Test `retro-followup` with detailed spec format retro
- [ ] Test `retro-item-execute` with BMM workflow routing
- [ ] Test `retro-item-execute` with `bash` routing
- [ ] Test `retro-item-execute` with `human` routing
- [ ] Test edge cases (empty retro, all done, etc.)

---

## Installation Testing

- [ ] Test module installation via `bmad install`
- [ ] Verify workflows appear in BMM menu
- [ ] Test in fresh project

---

## Future Enhancements (V2)

- [ ] Source retro status sync (update original retro file)
- [ ] Batch execution mode
- [ ] Keystone CLI integration
- [ ] Auto-detection of retro format

---

## Next Steps

1. Build `retro-followup` workflow using workflow-builder
2. Build `retro-item-execute` workflow using workflow-builder
3. Test end-to-end with a real retrospective
4. Install and verify in target project

---

_Last updated: 2026-01-29_
