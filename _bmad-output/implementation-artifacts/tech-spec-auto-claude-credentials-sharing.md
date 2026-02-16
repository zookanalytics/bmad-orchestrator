---
title: 'Automatic Claude Credentials Sharing Across Instances'
slug: 'auto-claude-credentials-sharing'
created: '2026-02-16'
status: 'implementation-complete'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['bash', 'docker', 'devcontainer', 'bats-testing']
files_to_modify: ['image/scripts/setup-instance-isolation.sh', 'image/scripts/__tests__/setup-instance-isolation.bats']
code_patterns: ['atomic-file-writes', 'symlink-sharing', 'flock-concurrency', 'discovery-pattern', 'validation-on-startup']
test_patterns: ['bats-framework', 'temp-isolation', 'concurrent-safety', 'happy-and-failure-paths']
---

# Tech-Spec: Automatic Claude Credentials Sharing Across Instances

**Created:** 2026-02-16

## Overview

### Problem Statement

Every new devcontainer instance requires Claude authentication, even though we have instance isolation infrastructure (`setup-instance-isolation.sh`) that attempts to share credentials via `/shared-data/claude/credentials.json`. The sharing fails because Claude replaces the credentials file entirely during auth (safety feature to avoid corrupting existing file), which breaks the symlink. First instance auth works but stays local; future instances still point to the empty bootstrap file.

### Solution

**Always-symlink with discovery-based promotion and validation on every start**:
- **Goal**: Credentials are ALWAYS a symlink to `/shared-data/claude/credentials.json`
- Don't pre-create empty credentials in `setup-instance-isolation.sh`
- First instance: Claude creates local file during auth (not a symlink yet, that's fine)
- Every instance on startup validates and self-heals:
  - If shared credentials exist → remove local file, create fresh symlink to shared
  - If no shared → discover most recent from instance dirs → promote to shared → symlink
  - If no shared and no instances have credentials → do nothing (first auth will create local)
- Self-healing on every start: fixes broken symlinks, local files, any inconsistent state
- If shared is deleted, any instance rediscovers and rebuilds it

### Scope

**In Scope:**
- Automatic credential promotion after first authentication
- Seamless auth persistence across all new instances
- Solution that works with current instance isolation architecture
- Handle edge cases (concurrent promotion, backward compatibility)

**Out of Scope:**
- Multi-account support (future enhancement)
- Replacing entire instance isolation system
- Complex validation (if Claude wrote it, it's valid)

## Context for Development

### Codebase Patterns

**Current Instance Isolation Architecture:**

The project uses a sophisticated instance isolation system (`image/scripts/setup-instance-isolation.sh`) that:
- Runs during devcontainer post-create (called from `image/scripts/post-create.sh` at step 4/13)
- Shares credentials/config via `/shared-data/claude/` (credentials.json, settings.json, config.json, inner-config.json)
- Isolates per-instance data via `/shared-data/instance/$INSTANCE_ID/claude/` (history, projects, todos)
- Currently bootstraps empty `{}` files in shared locations (lines 323-363 - TO BE REMOVED)
- Has comprehensive rollback support (tracks created symlinks/dirs, restores on failure)
- Uses error codes E001-E008 for different failure modes

**Standard Patterns in Scripts:**

1. **Atomic File Operations**: `mv` for atomic moves (vs `cp` which can be interrupted)
2. **Concurrent Safety**: flock for mutual exclusion
3. **Idempotent Updates**: Check current state before modifying
4. **Error Handling**: Explicit error codes with descriptive messages

**Key Insight from Simplified Approach:**

- No complex validation needed - if Claude created the file, it's valid
- Discovery pattern: scan instance dirs for most recent, promote to shared
- Natural convergence: everyone ends up with symlinks to shared
- Self-healing: if shared deleted, rediscovery rebuilds it

### Files to Reference

| File | Purpose | Modification Type |
| ---- | ------- | ----------------- |
| `image/scripts/setup-instance-isolation.sh` | Bootstrap symlinks for instance isolation (543 lines, steps 0-12) | **MODIFY** - Remove bootstrap (lines 323-363), add discovery/promotion |
| `image/scripts/setup-claude-auth-sharing.sh` | Manual migration script (114 lines) | **REFERENCE** - flock pattern only |
| `image/scripts/__tests__/setup-instance-isolation.bats` | Bats tests for isolation script (100+ lines) | **UPDATE** - Add discovery/promotion tests |

### Technical Decisions

**Approach: Discovery-Based Promotion**

Rationale:
- Dramatically simpler than validation-based migration
- Self-healing: any instance can rebuild shared from instance dirs
- Natural mtime ordering: most recent = most likely current
- First-write-wins acceptable (same account across instances)

**Design Principles:**
- Validate and fix on EVERY instance start (self-healing is core design)
- If shared exists → remove local, create fresh symlink (ensures consistency)
- If no shared → discover from instances, promote, symlink (bootstrap path)
- flock prevents concurrent promotion conflicts
- No credential validation needed (trust Claude's files)
- Simple invariant: if shared exists, all instances MUST have symlinks to it

## Implementation Plan

### Tasks

**Phase 1: Modify Credential Bootstrap Logic**

- [x] Task 1: Remove empty credential file bootstrap in setup-instance-isolation.sh
  - File: `image/scripts/setup-instance-isolation.sh`
  - Action: Remove lines 323-363 (Step 7: Symlink Claude credentials)
  - Rationale: Don't pre-create empty credentials - let Claude create them naturally
  - Notes: Keep directory creation (`mkdir -p "$HOME/.claude"`), only skip credential file operations

**Phase 2: Add Discovery and Promotion Logic**

- [x] Task 2: Add credential discovery function
  - File: `image/scripts/setup-instance-isolation.sh`
  - Action: Add `discover_most_recent_credentials()` function after line 441
  - Logic:
    ```bash
    # Find most recent credentials - uses find's printf for safe sorting
    find "$SHARED_DATA/instance" -mindepth 3 -maxdepth 3 -type f -name ".credentials.json" \
      -path "*/claude/.credentials.json" -printf '%T@ %p\n' 2>/dev/null | \
      sort -rn | head -1 | cut -d' ' -f2-
    ```
  - Return: Path to most recent credentials file, or empty if none found or on error
  - Notes: Uses find's %T@ (mtime as timestamp) for reliable sorting; handles paths with spaces

- [x] Task 3: Add credential promotion function
  - File: `image/scripts/setup-instance-isolation.sh`
  - Action: Add `promote_credentials_to_shared()` function
  - Function signature: Takes discovered credentials path as argument
  - Logic:
    - Ensure lock directory exists: `mkdir -p "$SHARED_DATA/claude"`
    - Acquire flock with 30s timeout: `flock -w 30 200` on `$SHARED_DATA/claude/.credentials-sharing.lock`
    - Check if shared already exists (another instance won the race): if yes, return 0
    - Move to shared: `mv "$discovered_path" "$SHARED_DATA/claude/credentials.json" || return 1`
    - Set permissions BEFORE making visible: `chmod 644 "$SHARED_DATA/claude/credentials.json" || return 1`
    - Create symlink back at original location: `ln -sf "$SHARED_DATA/claude/credentials.json" "$discovered_path" || return 1`
  - Return: 0 if successful, 1 if failed
  - Error handling: Return 1 on mv/chmod/ln failure; calling code checks if shared exists anyway
  - Notes: chmod before symlink prevents read failures; 30s flock timeout prevents infinite hangs

- [x] Task 4: Add validation and symlink creation step
  - File: `image/scripts/setup-instance-isolation.sh`
  - Action: Add new Step 7 (replacing removed bootstrap) after Step 6
  - Logic flow:
    ```
    echo "  [Step 7] Validating Claude credentials sharing..."

    IF shared credentials exist:
      echo "    Shared credentials found, ensuring symlink..."
      rm -f "$HOME/.claude/.credentials.json"
      ln -sf "$SHARED_DATA/claude/credentials.json" "$HOME/.claude/.credentials.json"
      # Verify readable - if not, fail the step
      [ -r "$HOME/.claude/.credentials.json" ] || { echo "ERROR: Symlink not readable"; exit E008; }
      echo "    ✓ Credentials symlinked to shared"
    ELSE:
      discovered=$(discover_most_recent_credentials)
      IF [ -n "$discovered" ]:
        echo "    No shared credentials, discovering from instances..."
        echo "    Found credentials: $discovered"
        promote_credentials_to_shared "$discovered"
        # Check if promotion succeeded (shared now exists)
        IF [ -f "$SHARED_DATA/claude/credentials.json" ]:
          rm -f "$HOME/.claude/.credentials.json"
          ln -sf "$SHARED_DATA/claude/credentials.json" "$HOME/.claude/.credentials.json"
          [ -r "$HOME/.claude/.credentials.json" ] || { echo "ERROR: Symlink not readable"; exit E008; }
          echo "    ✓ Credentials promoted and symlinked"
        ELSE:
          echo "    Promotion failed, credentials remain local"
      ELSE:
        echo "    No credentials found - first instance will create on auth"
    ```
  - Error handling: Fail script (exit E008) if symlink verification fails; continue if no credentials found
  - Logging: Clear messages at each decision point for debugging
  - Notes: Runs on EVERY instance start - validates and self-heals all credential state

**Phase 3: Tests**

- [x] Task 5: Test first-instance scenario (no shared, no other instances)
  - File: `image/scripts/__tests__/setup-instance-isolation.bats`
  - Expected: Script completes, no shared created, no symlink created, no errors

- [x] Task 6: Test second-instance scenario (shared exists)
  - File: `image/scripts/__tests__/setup-instance-isolation.bats`
  - Expected: Symlink created to shared, readable

- [x] Task 7: Test discovery scenario (instance A has local, no shared)
  - File: `image/scripts/__tests__/setup-instance-isolation.bats`
  - Expected: Credentials discovered, promoted to shared, symlink created

- [x] Task 8: Test multi-instance discovery (picks most recent by mtime)
  - File: `image/scripts/__tests__/setup-instance-isolation.bats`
  - Expected: Most recent credentials selected and promoted

- [x] Task 9: Test concurrent promotion safety (flock)
  - File: `image/scripts/__tests__/setup-instance-isolation.bats`
  - Expected: First promotes, second sees shared exists and skips

**Phase 4: Documentation**

- [x] Task 10: Update setup-claude-auth-sharing.sh with deprecation note
  - File: `image/scripts/setup-claude-auth-sharing.sh`
  - Action: Add comment header noting automatic discovery now happens in setup-instance-isolation.sh
  - Notes: Keep script available for manual use if needed

### Acceptance Criteria

**Happy Path:**

- [x] AC1: Given a fresh devcontainer with no credentials anywhere, when the first instance starts, then Step 7 completes with message "No credentials found - first instance will create on auth" and no files exist at `$SHARED_DATA/claude/credentials.json` or `~/.claude/.credentials.json`
- [x] AC2: Given first instance authenticated (file exists at `/shared-data/instance/A/claude/.credentials.json`), when second instance starts, then Step 7 outputs "Found credentials" and "Credentials promoted and symlinked", and verify: (1) `/shared-data/claude/credentials.json` exists, (2) `~/.claude/.credentials.json` is a symlink to shared, (3) both readable
- [x] AC3: Given shared credentials exist, when a new instance starts, then Step 7 outputs "Shared credentials found" and verify `~/.claude/.credentials.json` is a symlink to `/shared-data/claude/credentials.json` and readable
- [x] AC4: Given instance A has credentials (mtime: older) and instance B has credentials (mtime: newer), when discovery runs, then it returns the path to instance B's credentials and promotion succeeds

**Concurrent Safety:**

- [x] AC5: Given two instances start simultaneously and both call promote_credentials_to_shared, when they compete for flock, then verify: (1) only one mv succeeds, (2) both instances end with readable symlinks to `/shared-data/claude/credentials.json`, (3) no error messages in logs

**Backward Compatibility:**

- [x] AC6: Given `/shared-data/claude/credentials.json` already exists (from manual setup-claude-auth-sharing.sh), when a new instance starts, then Step 7 outputs "Shared credentials found" and creates symlink without running discovery
- [x] AC7: Given `~/.claude/.credentials.json` is already a symlink to shared, when isolation script runs again, then Step 7 removes and recreates the symlink (verify symlink still points to shared and is readable)

**Edge Cases:**

- [x] AC8: Given `$SHARED_DATA_DIR` is not set, when isolation mode detection runs, then it sets `ISOLATION_MODE=false` and Step 7 does not execute
- [x] AC9: Given `/shared-data/claude/credentials.json` is deleted but instance A still has `/shared-data/instance/A/claude/.credentials.json`, when instance B starts, then verify: (1) discovery finds instance A's file, (2) promotion recreates shared, (3) both instances have working symlinks
- [x] AC10: Given `~/.claude/.credentials.json` is a regular file (not symlink) and `/shared-data/claude/credentials.json` exists, when that instance starts, then Step 7 removes the local file and creates a symlink to shared
- [x] AC11: Given instance A has a symlink and instance B has a regular file, when instance B starts, then Step 7 removes the regular file and creates a symlink to shared (each instance validates independently)

## Additional Context

### Dependencies

**External Dependencies:**
- None - uses standard bash utilities (find, ls, mv, ln, chmod, flock)

**Internal Dependencies:**
- `image/scripts/setup-instance-isolation.sh` runs during post-create (step 4/13)
- `/shared-data` volume mounted and writable
- `AGENT_INSTANCE` environment variable set

### Testing Strategy

**Unit Tests (Bats Framework):**

1. **Discovery Tests**
   - No credentials anywhere → returns empty
   - One instance has credentials → returns that path
   - Multiple instances → returns most recent by mtime

2. **Promotion Tests**
   - Promote succeeds → credentials in shared, permissions correct
   - Concurrent promotion → only one promotes via flock
   - Promotion while another completes → skips gracefully

3. **Lazy Init Flow Tests**
   - First instance (no creds anywhere) → completes without error
   - Second instance (shared exists) → creates symlink
   - Second instance (discovers from instance A) → promotes and symlinks
   - Already symlinked → idempotent (skips)

**Integration Tests (Manual):**

1. **Multi-Instance Flow:**
   - Start instance A, authenticate
   - Start instance B → verify auto-promotion
   - Start instance C → verify uses shared
   - All instances: `claude` works without re-auth

2. **Self-Healing:**
   - Delete `/shared-data/claude/credentials.json`
   - Start new instance → rediscovers and promotes

**Test Execution:**
```bash
bats image/scripts/__tests__/setup-instance-isolation.bats
```

### Notes

**User Context:**
- Expert skill level
- Shared devcontainer setup with `/shared-data` volume
- Current workaround: manually run `setup-claude-auth-sharing.sh`
- Future: multi-account support (out of scope)

**Why This Approach is Better:**
- No complex validation (if Claude wrote it, it's valid)
- Self-healing on EVERY startup - validates all instances have proper symlinks
- Any broken state (local files, broken symlinks, missing shared) automatically fixed on next start
- Simpler concurrency (flock on promotion only)
- Natural convergence (everyone gets symlinks)
- First instance "just works" - gets fixed immediately when second instance promotes (move + immediate symlink back ensures no downtime)
- Robust against edge cases: no assumptions about token refresh, permissions, or file state

**Known Limitations:**
- Only single account (multi-account future enhancement)
- `~/.config/claude-code/auth.json` not managed (SDK auth, out of scope)
- Brief window between auth in first instance and startup of second instance where credentials are local only (self-heals on next instance start)

**Future Considerations:**
- Multi-account: Profile selection before promotion
- Refresh detection: Proactive re-promotion on local changes
- Cross-device sync: Cloud backup integration

## Review Notes

- Adversarial review completed
- Findings: 12 total, 4 fixed, 8 skipped (noise/undecided)
- Resolution approach: auto-fix
- Fixed: F1 (set -e subshell handling), F2 (atomic symlink creation), F3 (ln error checking), F4 (test name accuracy)
