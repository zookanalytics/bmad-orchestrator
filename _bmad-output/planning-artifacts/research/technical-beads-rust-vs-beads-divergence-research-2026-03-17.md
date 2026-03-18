---
stepsCompleted: [1, 2, 3, 4, 5, 6]
inputDocuments: []
workflowType: 'research'
lastStep: 2
research_type: 'technical'
research_topic: 'Divergence between beads_rust (Dicklesworthstone/beads_rust) and steveyegge/beads'
research_goals: 'Understand how much the two projects have diverged, find commentary on sync efforts, and identify features added to core beads that might make it incompatible with the beads_rust fork'
user_name: 'Node'
date: '2026-03-17'
web_research_enabled: true
source_verification: true
---

# Two Beads, One Name: The Structural Divergence of steveyegge/beads and Dicklesworthstone/beads_rust

**Date:** 2026-03-17
**Author:** Node
**Research Type:** Technical Comparative Analysis

---

## Executive Summary

steveyegge/beads (`bd`) and Dicklesworthstone/beads_rust (`br`) are **not competing implementations of the same product**. They are architecturally irreconcilable projects that share a common conceptual ancestor. The divergence is intentional, endorsed by both authors, and structurally permanent.

**bd** (Go, ~276K LOC, 19K stars) has evolved from a simple issue tracker into a full **agent coordination platform** built on Dolt (a Git-native SQL database). It now powers GasTown, Yegge's multi-agent orchestration framework for 20-30 parallel AI agents. It supports multi-writer collaboration, cell-level merge, federation, and deep integration with external trackers (Jira, Linear, GitLab).

**br** (Rust, ~20K LOC, 738 stars) intentionally freezes the "classic" **SQLite + JSONL-over-git** architecture that bd abandoned in February 2026. It prioritizes simplicity, explicit control, and a small footprint (5-8 MB binary, no daemon). It faces significant stability challenges with its FrankenSQLite storage engine.

**Key Findings:**

1. **No sync efforts exist.** Zero cross-references from bd's issues to br. No shared spec, test suite, or compatibility matrix.
2. **The JSONL format is the only shared interface**, but it's degraded. bd removed JSONL sync (v0.56.0) and SQLite (v0.58.0). Round-tripping destroys 30+ GasTown fields.
3. **30+ fields in bd's data model have no br equivalent** -- molecules, gates, slots, rigs, agent state machines, memory compaction. These represent bd's evolution into an agent OS.
4. **Migration is possible but lossy** in both directions. Ongoing bidirectional sync is not feasible.
5. **br's primary risk is FrankenSQLite instability** (20+ corruption bugs, user data loss). bd's primary risk is complexity growth (~276K LOC, 83 releases in 5 months).

**Recommendations:**

- Use **bd** for multi-agent, team, or GasTown workflows
- Use **br** for single-agent, lightweight, explicit-control workflows
- Do not plan for cross-implementation portability -- pick one and commit
- If using br, maintain JSONL backups and avoid concurrent processes

---

## Table of Contents

1. [Research Methodology](#technical-research-scope-confirmation)
2. [Technology Stack Analysis](#technology-stack-analysis)
   - [The Relationship: Intentional Divergence](#the-relationship-intentional-divergence-not-a-maintained-fork)
   - [Project Comparison](#project-comparison-at-a-glance)
   - [Architecture Evolution Timeline](#architecture-evolution-timeline)
   - [Features That Break Compatibility](#features-added-to-core-beads-that-break-compatibility)
   - [Sync Efforts Between Projects](#sync-efforts-between-projects)
   - [Community Commentary](#community-commentary-on-the-divergence)
   - [beads_rust Technical Challenges](#beads_rusts-own-technical-challenges)
   - [Other Rust Implementations](#other-rust-implementations-for-context)
3. [Integration Patterns Analysis](#integration-patterns-analysis)
   - [JSONL Wire Format](#jsonl-wire-format-the-only-shared-interface)
   - [Field-Level Compatibility](#field-level-jsonl-compatibility)
   - [JSONL Round-Trip Issues](#jsonl-round-trip-issues-documented-in-beads_rust-issues)
   - [MCP Protocol Comparison](#mcp-protocol-comparison)
   - [CLI Interface Comparison](#cli-interface-comparison)
   - [Migration Pathways](#migration-pathways)
4. [Architectural Patterns and Design](#architectural-patterns-and-design)
   - [Divergent Design Philosophies](#divergent-design-philosophies)
   - [Storage Architecture](#storage-architecture-the-core-fork-point)
   - [Concurrency and Multi-Writer](#concurrency-and-multi-writer-architecture)
   - [Data Model Architecture](#data-model-architecture)
   - [The "Protocol Not Product" Vision](#the-protocol-not-product-vision)
   - [GasTown Architectural Layer](#the-gastown-architectural-layer)
   - [Risk Assessment](#architectural-risk-assessment)
5. [Implementation Approaches](#implementation-approaches-and-technology-adoption)
   - [Decision Framework](#decision-framework-when-to-use-which-tool)
   - [Adoption Strategies](#adoption-strategies)
   - [Migration Patterns](#migration-patterns)
   - [GasTown Adoption Context](#gastown-adoption-context)
   - [Risk Mitigation](#risk-mitigation-strategies)
6. [Technical Recommendations](#technical-research-recommendations)
7. [Research Conclusion](#technical-research-conclusion)
8. [Sources](#source-documentation)

---

## Research Overview

This research investigates the degree of divergence between Steve Yegge's original `steveyegge/beads` (Go, `bd` CLI) and Jeffrey Emanuel's `Dicklesworthstone/beads_rust` (Rust, `br` CLI). Data was gathered from GitHub APIs (repo metadata, commits, issues, releases), README files, web searches, social media commentary, and community discussions on Hacker News. All claims are cited with sources.

---

## Technical Research Scope Confirmation

**Research Topic:** Divergence between beads_rust (Dicklesworthstone/beads_rust) and steveyegge/beads
**Research Goals:** Understand how much the two projects have diverged, find commentary on sync efforts, and identify features added to core beads that might make it incompatible with the beads_rust fork

**Technical Research Scope:**

- Architecture Analysis - design patterns, frameworks, system architecture
- Implementation Approaches - development methodologies, coding patterns
- Technology Stack - languages, frameworks, tools, platforms
- Integration Patterns - APIs, protocols, interoperability
- Performance Considerations - scalability, optimization, patterns

**Research Methodology:**

- Current web data with rigorous source verification
- Multi-source validation for critical technical claims
- Confidence level framework for uncertain information
- Comprehensive technical coverage with architecture-specific insights

**Scope Confirmed:** 2026-03-17

---

## Technology Stack Analysis

### The Relationship: Intentional Divergence, Not a Maintained Fork

The single most important finding is that **beads_rust is not trying to stay in sync with beads**. It is an independent Rust reimplementation that intentionally freezes the "classic" pre-Dolt architecture. The divergence is by design, not by neglect.

Jeffrey Emanuel (beads_rust author), from the README:
> "As Steve continues evolving beads toward GasTown and beyond, our use cases have naturally diverged. The hybrid SQLite + JSONL-git architecture that I built my tooling around is being replaced with approaches better suited to Steve's vision. Rather than ask Steve to maintain a legacy mode for my niche use case, I created this Rust port that freezes the 'classic beads' architecture I depend on."

Steve Yegge endorsed this approach publicly:
> "@doodlestein has done the world a great service and created a minimalist port of Beads to Rust. My feeling is that Beads was a discovery, not an invention, and it is an interface/protocol, not a single implementation."
_Source: https://x.com/Steve_Yegge/status/2012974366188032144_

**Confidence: HIGH** -- Both authors have made explicit public statements confirming this is an intentional split.

### Project Comparison at a Glance

| Dimension | steveyegge/beads (`bd`) | Dicklesworthstone/beads_rust (`br`) |
|---|---|---|
| **Language** | Go (~276K lines, ~50% tests) | Rust (~20K lines) |
| **Primary Storage** | Dolt (Git-native SQL database) | SQLite (FrankenSQLite) |
| **Sync Mechanism** | Dolt push/pull (native Git remotes) | JSONL export/import over git |
| **Stars** | 19,245 | 738 |
| **Releases** | 83 (v0.9.1 to v0.61.0) | 14 (v0.1.7 to v0.1.28) |
| **Created** | 2025-10-12 | 2026-01-18 |
| **Binary Size** | ~41 MB | 5-8 MB |
| **Multi-writer** | Yes (Dolt cell-level merge) | No (single-writer) |
| **Federation** | Yes (cross-repo routing) | No |
| **Auto-sync** | Yes (5-min debounce) | No (explicit only) |
| **Git Hooks** | Yes (auto-installed) | No (never touches git) |
| **Daemon/Server** | Yes (Dolt server, idle monitor) | No |
| **MCP Protocol** | Yes (beads-mcp server) | Yes (added in v0.1.21+) |
| **External Integrations** | Jira, Linear, GitLab, Azure DevOps, GitHub Issues | None |
| **GasTown** | Deep integration | None |
| **License** | MIT | MIT + OpenAI/Anthropic Rider |

_Sources: GitHub API repos/steveyegge/beads, GitHub API repos/Dicklesworthstone/beads_rust, respective README files_

### Architecture Evolution Timeline

**Phase 1 (Oct-Nov 2025): "Classic Beads" -- SQLite + JSONL**
- Original architecture that both projects share as a common ancestor
- Local SQLite for queries, JSONL files checked into git for collaboration
- This is the architecture beads_rust preserves

**Phase 2 (Dec 2025-Jan 2026): Transition Period**
- beads begins experimenting with Dolt as a backend option
- JSONL sync pipeline still present
- beads_rust created (2026-01-18) specifically to freeze Phase 1

**Phase 3 (Feb 2026+): Dolt-Native Era**
- v0.50.0: Dolt becomes default backend
- v0.56.0: JSONL sync pipeline **removed** -- the very mechanism beads_rust depends on for interop
- v0.58.0: SQLite backend **removed entirely**
- Embedded Dolt mode removed, server-only Dolt required
- Binary size dropped from 168MB to 41MB by removing SQLite/embedded Dolt

**Phase 4 (Mar 2026): GasTown Integration**
- Multi-agent orchestration (GasTown)
- Federation with cross-repo routing
- External tracker sync (Jira, Linear, GitLab, Azure DevOps, GitHub Issues)
- Persistent agent memory system
- ~276K lines of Go, 450+ contributors

_Sources: steveyegge/beads CHANGELOG.md, release notes v0.50.0-v0.61.0_

### Features Added to Core Beads That Break Compatibility

The following features in `bd` have no equivalent in `br` and represent fundamental architectural incompatibilities:

**Storage Layer (CRITICAL -- complete incompatibility)**
- **Dolt backend** (v0.50.0+): Version-controlled SQL with cell-level merge, branching, push/pull. br uses SQLite.
- **JSONL sync removed** (v0.56.0): The JSONL export/import pipeline -- which is br's _only_ collaboration mechanism -- was removed from bd.
- **SQLite backend removed** (v0.58.0): bd no longer supports SQLite at all. There is no shared storage format.
- **Schema version 8** (v0.61.0): bd's database schema has evolved through 8 versions with migration paths that br cannot consume.

**Collaboration Model (HIGH -- architectural mismatch)**
- **Dolt push/pull**: bd syncs via Git-native Dolt remotes (DoltHub, S3, GCS, SSH). br syncs via JSONL files in git.
- **Multi-writer with cell-level merge**: bd supports concurrent writers with field-level conflict resolution. br is single-writer with no concurrent access support (SQLite corruption under concurrency is a major open bug -- issues #138, #171).
- **Federation/cross-repo routing**: bd supports prefix-based routing across repos. br has no federation.
- **Auto-sync with debounce**: bd auto-commits and auto-pushes on configurable intervals. br requires explicit `sync --flush-only` and `sync --import-only`.

**Data Model (MEDIUM -- feature gaps)**
- **Wisps** (ephemeral issues): bd has a `wisps` table (dolt_ignore'd) for throwaway agent notes. br has no wisps.
- **Molecules**: bd supports "molecule" formulas for aggregating issue data. br has no molecules.
- **Memory compaction**: bd implements semantic "memory decay" that summarizes closed tasks to preserve context. br has no compaction.
- **Persistent agent memory**: bd has a dedicated agent memory system (v0.58.0+). br has no equivalent.
- **Issue comments, events, metadata tables**: bd's schema includes `comments`, `events`, `metadata` tables with full audit trails. br's schema is simpler.

**Agent Integration (MEDIUM -- feature gaps)**
- **GasTown integration**: bd deeply integrates with Yegge's multi-agent orchestration framework. br has no GasTown awareness.
- **Claude Code plugin**: bd has a first-class Claude Code plugin with `bd prime` generating workflow context. br has a simpler agent instructions command.
- **Circuit breaker**: bd has circuit breaker protection against agent hangs. br has no equivalent.
- **BriefIssue/BriefDep models**: bd's MCP server uses 97% token-reduced models for efficiency. br's MCP is simpler.

_Sources: steveyegge/beads CHANGELOG.md, DeepWiki steveyegge/beads architecture, release notes, issue #182 on beads_rust_

### Sync Efforts Between Projects

**There are essentially no sync efforts.** The evidence:

1. **Zero cross-references in steveyegge/beads**: Scanning the 100 most recent issues/PRs in the original beads repo, there are zero mentions of beads_rust, Dicklesworthstone, Jeffrey Emanuel, or the Rust port.

2. **One-directional references in beads_rust**: Several beads_rust issues reference the Go implementation for behavioral comparison:
   - Issue #187: Links directly to Go source code (`beads.go#L43-L93`) asking whether a `.beads/redirect` behavioral divergence was intentional
   - Issue #182: Comprehensive 13-item feature gap analysis between br and bd
   - Issue #188: Bug with consuming JSONL produced by `bd` (mixed-prefix blocks)
   - Issue #5: JSON field naming incompatibility (`dep_type` vs `dependency_type`)
   - Issue #7: CLI flag differences between br and bd

3. **No shared tests, CI, or specification**: There is no shared test suite, compatibility matrix, or wire-format specification that both projects validate against.

4. **Migration is one-way and limited**: Users can migrate from "classic" bd (pre-v0.50) to br via JSONL import, but:
   - No migration path from Dolt-era bd (v0.50+) to br (Issue #125)
   - Database schema incompatibility requires delete-and-reimport (Issue #3)
   - Prefix handling differences cause import failures (Issues #184, #188)

_Sources: GitHub API issues for both repos, beads_rust issues #3, #5, #7, #125, #182, #187, #188_

### Community Commentary on the Divergence

**From community members:**

Numman Ali (@nummanali on X):
> "Beads Rust - the new Beads. The original beads is being moulded to suite the needs of Gas Town. I will be porting to this version."
_Source: https://x.com/nummanali/status/2012978728557498606_

Joe Devon (@joedevon on X):
> "Just discovered @doodlestein's Rust port of Beads & am so relieved. Got busy w/ other stuff & did little coding in Jan, but every time I did, beads grew and grew. The 'bloat' critique was not for nothing."
_Source: https://x.com/joedevon/status/2019605631351812358_

User "madanyang" (beads_rust Issue #171):
> "I ran away from beads getting out of control and considered beads rust as a safe haven, not getting in to git stuff, doing what a simple task/bug organizer does. But every br release is spending time to fix the database issues created with the upgrade..."
_Source: https://github.com/Dicklesworthstone/beads_rust/issues/171_

Hacker News commenter:
> "I started off with the original beads and it was definitely a nightmare" -- went on to create a single-file bash replacement
_Source: https://news.ycombinator.com/item?id=46969033_

Another HN commenter expressed shock at beads' ~240K lines of code for what they expected to be a lightweight issue tracker.
_Source: https://news.ycombinator.com/item?id=46669791_

**Confidence: HIGH** -- Multiple independent sources confirm the same narrative: users flee bd's complexity for br's simplicity.

### beads_rust's Own Technical Challenges

While br is intentionally simpler, it faces significant stability issues of its own:

**FrankenSQLite Corruption**: The dominant issue category. br switched from `rusqlite` (C SQLite bindings) to `frankensqlite` (a pure-Rust SQLite implementation by the same author). This has caused a cascade of database corruption bugs:
- Concurrent write corruption (Issues #138, #109, #155)
- B-tree index corruption (Issues #120, #140, #148)
- WAL corruption and checkpoint failures (Issues #108, #158)
- Database incompatible with standard `sqlite3` tool (Issue #156)
- User data loss (#171: "I just lost 250 bugs/task on a project I have a deadline in one week")

Dicklesworthstone's stated roadmap priority (from Issue #182):
> "Priority order: Stabilize FrankenSQLite -> Remote sync -> Auto-sync -> Atomic claim. I'm not putting a timeline on this because FrankenSQLite stability is the gating factor."
_Source: https://github.com/Dicklesworthstone/beads_rust/issues/182_

### Other Rust Implementations (for context)

beads_rust is not the only alternative Rust implementation:

- **fwindolf/beads-rs**: Keeps the `bd` CLI interface, uses embedded SQLite instead of Dolt. ~104 CLI commands, 202 tests.
- **delightful-ai/beads-rs** (crates.io): "Designed for swarms: one daemon per machine shares state across all clones instantly. No SQLite -- everything lives in git on `refs/heads/beads/store`."
- **mindreader/beads_rust**: Fork of Dicklesworthstone's version with modifications.

_Sources: GitHub repos, crates.io_

### Technology Adoption Trends

| Trend | Evidence |
|---|---|
| **AI-authored codebases** | Both projects are heavily co-authored by "Claude Opus 4.6". Nearly 100% of recent commits in both repos have AI co-author tags. |
| **Complexity backlash** | Multiple community members and HN commenters cite beads' growing complexity as motivation for alternatives (br, ticket.el, single-file bash scripts) |
| **"Protocol not product" framing** | Yegge's statement that beads is "an interface/protocol, not a single implementation" legitimizes the ecosystem approach |
| **Fragmentation risk** | With 3+ Rust implementations and the original Go version all diverging, there is no shared spec or compatibility guarantee |

---

## Integration Patterns Analysis

### JSONL Wire Format: The Only Shared Interface

The JSONL export/import format is the **sole interoperability surface** between bd and br. Both can produce and consume `issues.jsonl` files (stored in `.beads/issues.jsonl`), but the format has diverged significantly.

**Confidence: HIGH** -- Based on direct source code analysis of both `types.Issue` (Go) and `Issue` struct (Rust) serde attributes.

### Field-Level JSONL Compatibility

#### Compatible Core Fields (present and matching in both)

Both implementations share these JSON fields with compatible serialization:
`id`, `title`, `description`, `design`, `acceptance_criteria`, `notes`, `status`, `priority`, `issue_type`, `assignee`, `owner`, `estimated_minutes`, `created_at`, `created_by`, `updated_at`, `closed_at`, `close_reason`, `closed_by_session`, `due_at`, `defer_until`, `external_ref`, `source_system`, `compaction_level`, `compacted_at`, `compacted_at_commit`, `original_size`, `sender`, `ephemeral`, `pinned`, `is_template`, `labels`, `dependencies`, `comments`

#### Fields Present in bd But Missing From br (30+ GasTown fields)

| bd Field | Purpose | Impact on br Import |
|---|---|---|
| `spec_id` | Spec reference | Silently dropped by serde |
| `metadata` | Arbitrary JSON blob | Silently dropped |
| `no_history` | Wisp GC control | Silently dropped |
| `wisp_type` | TTL compaction classification | Silently dropped |
| `bonded_from` | Compound molecule lineage | Silently dropped |
| `creator` | Entity tracking (EntityRef) | Silently dropped |
| `validations` | Validation chain | Silently dropped |
| `quality_score` | Aggregate quality score | Silently dropped |
| `crystallizes` | CV weighting flag | Silently dropped |
| `await_type`, `await_id`, `timeout`, `waiters` | Gate coordination | Silently dropped |
| `holder` | Slot exclusive access | Silently dropped |
| `source_formula`, `source_location` | Formula cooking | Silently dropped |
| `hook_bead`, `role_bead` | Agent identity/role | Silently dropped |
| `agent_state` | Agent state machine | Silently dropped |
| `last_activity` | Agent timeout detection | Silently dropped |
| `role_type`, `rig` | Agent role/rig assignment | Silently dropped |
| `mol_type`, `work_type` | Molecule/assignment model | Silently dropped |
| `event_kind`, `actor`, `target`, `payload` | Operational events | Silently dropped |

**Impact**: br can import JSONL produced by bd -- unknown fields are silently ignored by Rust's serde deserializer. However, **round-tripping destroys data**: exporting from bd, importing into br, then exporting from br will strip all 30+ GasTown fields permanently.

#### Fields Present in br But Missing From bd's JSONL Export

| br Field | Notes |
|---|---|
| `source_repo` | bd has this field but tags it `json:"-"` (not exported). br exports it. |
| `deleted_at`, `deleted_by`, `delete_reason` | br-specific soft-delete tracking |
| `original_type` | br-specific type history |

**Impact**: bd's Go JSON unmarshaler silently ignores unknown fields, so br-produced JSONL imports fine into bd.

_Sources: steveyegge/beads `internal/types/types.go`, Dicklesworthstone/beads_rust `src/model/mod.rs`_

### Known Serialization Differences

| Aspect | bd (Go) | br (Rust) | Compatibility Issue |
|---|---|---|---|
| `compaction_level` | `omitempty` (omitted when 0) | Custom serializer (always outputs integer, 0 when None) | br always writes `"compaction_level":0`; bd may omit it. Minor. |
| `source_repo` | `json:"-"` (never exported) | Serialized when present | br JSONL may contain `source_repo` that bd ignores |
| Comment `id` type | `string` (UUID-based) | `i64` (autoincrement integer) | **Breaking**: comment IDs are incompatible across implementations |
| `content_hash` | `json:"-"` (excluded) | `#[serde(skip)]` (excluded) | Compatible -- both recompute on import |
| Dependency `type` field | `json:"type"` | `#[serde(rename = "type")]` from internal `dep_type` | Compatible at JSON level |

### JSONL Round-Trip Issues Documented in beads_rust Issues

| Issue | Problem | Status |
|---|---|---|
| [#188](https://github.com/Dicklesworthstone/beads_rust/issues/188) | Mixed-prefix JSONL (e.g., `bd-*` + `k-*` issues) blocks DB rebuild in br | OPEN |
| [#184](https://github.com/Dicklesworthstone/beads_rust/issues/184) | `--rename-prefix` and `--force` flags ignored during import, making bd-format JSONL unusable | OPEN |
| [#137](https://github.com/Dicklesworthstone/beads_rust/issues/137) | JSONL round-trip inserts NULL into NOT NULL columns (missing `design`, `acceptance_criteria` fields) causing WAL corruption | CLOSED |
| [#149](https://github.com/Dicklesworthstone/beads_rust/issues/149) | Single `dep add` silently rewrites unrelated issue records, dropping labels and dependencies | CLOSED |
| [#148](https://github.com/Dicklesworthstone/beads_rust/issues/148) | Bulk import of 600+ records corrupts SQLite B-tree index pages | CLOSED |
| [#147](https://github.com/Dicklesworthstone/beads_rust/issues/147) | `delete --hard` leaves tombstones in JSONL with bad prefixes, poisoning validation | CLOSED |
| [#132](https://github.com/Dicklesworthstone/beads_rust/issues/132) | Critical DB corruption forces fallback to JSONL-only (`no-db: true`) mode | CLOSED |
| [#169](https://github.com/Dicklesworthstone/beads_rust/issues/169) | `--no-db` mode silently overwrites prior JSONL writes using stale in-memory snapshot | CLOSED |
| [#159](https://github.com/Dicklesworthstone/beads_rust/issues/159) | Duplicate parent-child dependencies in JSONL crash `get_parent_id()` | CLOSED |
| [#111](https://github.com/Dicklesworthstone/beads_rust/issues/111) | Import produces DB with corrupt page-count header (fsqlite bug) | CLOSED |

_Sources: GitHub issues on Dicklesworthstone/beads_rust_

### MCP Protocol Comparison

Both projects implement MCP servers but with fundamentally different architectures:

| Aspect | bd (`beads-mcp`) | br (`br serve`) |
|---|---|---|
| **Implementation** | Separate Python process (PyPI package) | Built into Rust binary (feature-gated) |
| **Framework** | FastMCP (Python) | fastmcp_rust (Rust) |
| **Communication** | Shells out to `bd` CLI via subprocess | Direct SQLite access in-process |
| **Tool count** | 15+ tools + 2 discovery meta-tools | 7 tools (design ceiling per MCP best practice) |
| **MCP Resources** | 1 (`beads://quickstart`) | 11 (project info, schema, labels, ready, blocked, in_progress, events, deferred, graph health, bottlenecks, individual issues) |
| **MCP Prompts** | 0 | 4 (triage, status_report, plan_next_work, polish_backlog) |
| **Multi-project** | Yes (workspace_root routing, connection pool) | No (single workspace per server instance) |
| **Input coercion** | Relies on CLI validation | "Forgive by Default" -- auto-corrects aliases ("wip" -> `in_progress`, "urgent" -> `critical`) |
| **Error recovery** | Standard errors | Structured errors with `suggested_tool_calls`, fuzzy ID matching |
| **Placeholder detection** | None | Detects 30+ known placeholder strings agents hallucinate |
| **Token optimization** | BriefIssue/BriefDep (97% token reduction) | `--format toon` (token-optimized notation via `tru` crate) |

**MCP Tool Name Differences**: Even where both provide equivalent functionality, tool names differ (`list` vs `list_issues`, `show` vs `show_issue`, `dep` vs `manage_dependencies`). An agent configured for one MCP server cannot use the other without reconfiguration.

_Sources: steveyegge/beads `integrations/beads-mcp/`, Dicklesworthstone/beads_rust `src/mcp/`, DeepWiki for both repos_

### CLI Interface Comparison

#### Commands in bd but NOT in br (18 commands)

| bd Command | Purpose | Architectural Reason for Absence |
|---|---|---|
| `bd dolt push/pull/start/stop` | Dolt server management | No Dolt support |
| `bd hooks install/uninstall/status` | Git hook management | No hook support by design |
| `bd prime` | Generate agent workflow context | No equivalent |
| `bd mol` | Molecule/wisp lifecycle | No molecule support |
| `bd gate` | Gate-based coordination | No gate support |
| `bd epic` | Epic management commands | Use `--type epic` on create |
| `bd template` | Issue templates | No template support |
| `bd workflow` | Workflow management | No workflow support |
| `bd decision` | Decision records | No decision support |
| `bd rename-prefix` | Atomic prefix rename | No equivalent |
| `bd duplicates` | Duplicate detection/merge | No duplicate detection |
| `bd compact` | Semantic summarization | No compaction support |
| `bd audit` | Audit trail | No audit trail |
| `bd query` | Direct SQL access | No equivalent |
| `bd deleted/restore` | View/restore deleted | No equivalent |
| `bd migrate` | Schema migration | Automatic (no CLI) |

#### Commands in br but NOT in bd (8 commands)

| br Command | Purpose |
|---|---|
| `br q` | Quick capture (minimal output, ID only) |
| `br stale` | Find stale issues by age |
| `br count` | Count issues with grouping |
| `br orphans` | Find issues without dependencies |
| `br upgrade` | Self-update binary from GitHub releases |
| `br agents` | Install/update AGENTS.md |
| `br serve` | Run native MCP server on stdio |
| `br label list-all` | List all labels across project |

_Sources: bd CLI reference docs, br README_

### Agent Integration Patterns

| Aspect | bd | br |
|---|---|---|
| **Primary agent interface** | CLI + SessionStart hook (`bd prime`) | CLI + `--json` / `--format toon` |
| **Claude Code plugin** | Full plugin (`.claude-plugin/plugin.json`, commands, skills, agents, hooks) | `AGENTS.md` file via `br agents --add` |
| **Git automation** | Auto-commit, auto-push, hook installation | Never (explicit user control only) |
| **Circuit breaker** | Yes (protects against Dolt connection failures, 5 failures in 60s -> open) | No (direct SQLite, no network) |
| **Multi-project MCP** | Yes (ContextVar-based per-request routing) | No (single workspace) |

### Migration Pathways

| Direction | Feasibility | Method | Blockers |
|---|---|---|---|
| Classic bd (pre-v0.50) -> br | **Possible with friction** | JSONL export -> `br sync --import-only` | Prefix mismatches ([#184](https://github.com/Dicklesworthstone/beads_rust/issues/184)), schema differences ([#3](https://github.com/Dicklesworthstone/beads_rust/issues/3)) |
| Modern bd (v0.50+) -> br | **Possible via export** | `bd export -o backup.jsonl` -> `br sync --import-only` | GasTown fields silently lost, mixed-prefix issues ([#188](https://github.com/Dicklesworthstone/beads_rust/issues/188)) |
| br -> bd | **Possible** | `br sync --flush-only` -> `bd import -i issues.jsonl` | br-specific fields (`source_repo`, `deleted_*`) silently dropped by bd |
| br -> modern bd (ongoing sync) | **Not feasible** | N/A | bd uses Dolt, not JSONL, for day-to-day operations. No shared sync mechanism. |

_Sources: beads_rust issues #3, #125, #182, #184, #188; bd CHANGELOG.md_

### Content Hash Computation

Both use SHA256 hashing for issue IDs but with subtle differences:

- **bd**: `SHA256(prefix + "|" + title + "|" + description)` truncated to 6 hex characters
- **br**: SHA256 of "only classic fields while preserving the same order and separator rules so that legacy and Rust hashes agree"

**Confidence: MEDIUM** -- br claims compatibility but this has not been independently verified with a shared test suite.

_Sources: bd `internal/types/types.go`, br `EXISTING_BEADS_STRUCTURE_AND_ARCHITECTURE.md`_

---

## Architectural Patterns and Design

### Divergent Design Philosophies

The two projects embody fundamentally opposed architectural philosophies, making their divergence structural rather than incidental.

| Philosophy | bd (beads) | br (beads_rust) |
|---|---|---|
| **Scope** | Platform -- issue tracker + multi-agent orchestration + federation | Tool -- focused issue tracker |
| **Complexity budget** | ~276K lines, growing rapidly | ~20K lines, intentionally constrained |
| **Storage philosophy** | "Git for databases" (Dolt) | "Database for git" (SQLite + JSONL) |
| **Automation stance** | Implicit (auto-commit, auto-push, auto-hooks) | Explicit (user controls all git operations) |
| **Collaboration model** | Server-based multi-writer | Single-writer with file-based sync |
| **Evolution model** | Rapid feature accretion | Architectural freeze |

**Confidence: HIGH** -- Based on direct README statements from both authors and observed commit patterns.

### Storage Architecture: The Core Fork Point

The storage layer is the single decision that makes these projects architecturally irreconcilable.

#### bd: Dolt-Native Architecture

bd chose Dolt -- a MySQL-compatible database engine that version-controls data using Git's object model -- as its sole storage backend. Key design properties:

- **Two-phase commit**: SQL transaction `BEGIN...COMMIT` followed by `DOLT_COMMIT` for versioned snapshots of permanent tables only
- **Dual-table architecture**: Permanent `issues` table + ephemeral `wisps` table (dolt_ignore'd to prevent history bloat)
- **Cell-level merge**: Conflict resolution at the individual field level, not line-level. Rules: last-write-wins by `updated_at` for scalars; union-merge-with-dedup for arrays; `closed > in_progress > open` for status; higher priority wins for priority
- **Server mode**: Dolt runs as a MySQL-compatible SQL server (`dolt sql-server`), with idle auto-shutdown via IdleMonitor and connection protection via CircuitBreaker (opens after 5 consecutive failures in 60s, half-open after 5s cooldown)
- **Remote sync**: Native push/pull to DoltHub, S3, GCS, SSH, or any Git remote
- **Schema evolution**: 8 schema versions with forward migration paths, managed via `bd migrate`

**Architectural rationale** (from Yegge's articles and CHANGELOG):
- Git-level merging of JSONL produced unresolvable conflicts in multi-agent scenarios
- SQLite's single-writer model couldn't support concurrent agents
- Dolt provides the "all the power of a database and all the resilience of git" combination
- Cell-level merge eliminates the class of merge conflicts that plagued JSONL-over-git

_Sources: DeepWiki steveyegge/beads architecture, steveyegge/beads CHANGELOG.md, steveyegge/beads `internal/storage/dolt/store.go`_

#### br: SQLite + JSONL Hybrid Architecture

br freezes the "classic" architecture that bd abandoned, with one significant variation: FrankenSQLite instead of standard SQLite.

- **SQLite as query engine**: Local `.beads/beads.db` for fast queries. WAL mode for read concurrency (but single-writer).
- **JSONL as collaboration surface**: `.beads/issues.jsonl` checked into git for multi-user sync. One JSON object per line, tombstones preserved for sync.
- **Explicit sync**: `br sync --flush-only` (DB -> JSONL), `br sync --import-only` (JSONL -> DB). No automatic operations.
- **Dirty tracking**: `dirty_issues` table marks locally-changed records for incremental export. `export_hashes` table provides content-based idempotent export.
- **Three-way merge**: `merge_issue()` combines line-based git merges with SQLite-internal merge logic via `metadata.json` sync base snapshots.
- **No server mode**: Direct file-level SQLite access. No daemon, no background processes.

**FrankenSQLite decision** (from issue discussions):
- Emanuel chose `frankensqlite` (his own pure-Rust SQLite implementation) over `rusqlite` (C FFI bindings) to eliminate the C dependency chain
- This enables fully static Rust binaries with no system SQLite dependency
- The trade-off has been severe: 20+ issues related to B-tree corruption, WAL corruption, concurrent write failures, and incompatibility with standard sqlite3 tools (Issues #108-#171)
- br is pinned to a specific fsqlite commit and periodically falls behind upstream fixes

_Sources: Dicklesworthstone/beads_rust README, beads_rust issues #111, #138, #148, #156, #171, #182_

### Concurrency and Multi-Writer Architecture

| Aspect | bd | br |
|---|---|---|
| **Concurrent writers** | Yes -- Dolt SQL server handles multiple connections | No -- SQLite single-writer, concurrent access corrupts DB (Issue #138) |
| **Conflict resolution** | Cell-level merge with deterministic rules | Line-level git merge of JSONL (prone to conflicts) |
| **Atomic operations** | `DOLT_COMMIT` provides atomic multi-table snapshots | SQLite transactions, but JSONL flush is not atomic with DB writes |
| **Agent coordination** | CircuitBreaker prevents hangs; slot system provides exclusive access (`holder` field) | No coordination primitives; agents must self-coordinate |
| **Planned br improvement** | N/A | FrankenSQLite MVCC (in development, gating factor for all concurrency work) |

The concurrency gap is br's most critical architectural limitation. Dicklesworthstone acknowledges this (Issue #182): "FrankenSQLite MVCC is the foundation for multi-writer support... I'm not putting a timeline on this because FrankenSQLite stability is the gating factor."

_Sources: beads_rust Issue #182, DeepWiki steveyegge/beads CircuitBreaker architecture_

### Data Model Architecture

bd's data model has grown far beyond issue tracking into a full agent coordination platform:

```
bd Data Model (v0.61.0)                    br Data Model (v0.1.28)
──────────────────────                     ──────────────────────
issues (permanent)                         issues
wisps (ephemeral, dolt_ignore'd)           (no wisps)
dependencies                               dependencies
labels                                     labels
comments                                   comments
events (audit trail)                       events
metadata (key-value runtime state)         (no metadata table)
molecules (async workflow units)           (no molecules)
gates (coordination primitives)            (no gates)
bonds (molecule lineage)                   (no bonds)
slots (exclusive access tokens)            (no slots)
agent_state (state machine per agent)      (no agent state)
```

bd's `Issue` struct has grown to 50+ fields to support GasTown's multi-agent orchestration. br's `Issue` struct has ~35 fields, frozen at the classic set plus soft-delete tracking.

_Sources: bd `internal/types/types.go`, br `src/model/mod.rs`, bd `internal/storage/dolt/schema.go`_

### Deployment Architecture

| Aspect | bd | br |
|---|---|---|
| **Binary size** | ~41 MB (was 168MB before SQLite/embedded Dolt removal) | 5-8 MB |
| **Dependencies** | Dolt SQL server (bundled or external) | None (statically linked, pure Rust) |
| **Platforms** | macOS, Linux, Windows, Android/Termux, FreeBSD | macOS, Linux, Windows |
| **Installation** | npm, Homebrew, Go install, curl script, PowerShell | curl script, cargo install, build from source (requires Rust nightly) |
| **Server requirements** | Dolt server must be running (auto-started by bd, auto-shutdown on idle) | None (direct file access) |
| **Git integration** | 4 git hooks auto-installed (pre-commit, post-merge, pre-push, post-checkout) | Zero git integration (by design) |
| **Config env vars** | `BEADS_*` | `BD_*`, `BR_*`, `BEADS_*` |

br's deployment simplicity is its primary selling point. A single static binary with no daemon and no git hooks makes it trivially adoptable. bd's Dolt server requirement adds operational complexity but enables multi-writer collaboration.

_Sources: respective README files, release assets on GitHub_

### The "Protocol Not Product" Vision

Yegge's statement that beads is "an interface/protocol, not a single implementation" frames the divergence as intentional ecosystem design rather than a fork conflict. However, in practice:

**What exists as "protocol":**
- JSONL format (loosely defined, no formal spec, field set diverging)
- `.beads/` directory convention
- Issue ID format (`prefix-hash`, SHA256-based)
- Core issue fields (title, description, status, priority, type)
- Dependency types (blocks, parent-child, relates-to, etc.)

**What does NOT exist:**
- Formal wire-format specification document
- Shared conformance test suite
- Version negotiation or capability advertisement
- Backward compatibility guarantees between implementations
- Cross-implementation interoperability testing

The "protocol" is effectively defined by bd's implementation, and br approximates it. There is no independent specification that either could validate against. This makes the "protocol not product" framing aspirational rather than operational.

**Confidence: HIGH** -- Based on examination of both repos, neither contains a formal specification document or shared test suite.

### The GasTown Architectural Layer

GasTown is Yegge's multi-agent orchestration framework built on top of beads. It introduces architectural concepts that have no br equivalent:

- **Molecules**: Async workflow units with lifecycle states (pour/wisp/bond/squash/burn/distill). Molecules aggregate issue data via formulas.
- **Gates**: Coordination primitives with `await_type`, `await_id`, `timeout`, and `waiters` fields. Enable agent synchronization without polling.
- **Slots**: Exclusive access tokens via the `holder` field. Prevent concurrent modification of critical resources.
- **Rigs**: Named agent workstations with role assignments (`role_bead`, `role_type`, `rig` fields).
- **Agent State Machine**: Per-agent state tracking via `agent_state` field and `last_activity` for timeout detection.
- **Memory Compaction**: Semantic "memory decay" that summarizes closed tasks to preserve context while reducing storage.
- **Federation**: Cross-repo routing via prefix-based namespacing. Contributor/maintainer workflows with namespace isolation.

GasTown represents bd's evolution from "issue tracker" to "agent operating system." br explicitly does not follow this path -- Emanuel's use case is focused issue tracking for his Agent Flywheel tooling, not multi-agent orchestration.

_Sources: Yegge's "Welcome to Gas Town" (Medium), bd `internal/types/types.go`, DoltHub blog "A Day in Gas Town"_

### Architectural Risk Assessment

| Risk | bd | br |
|---|---|---|
| **Complexity growth** | HIGH -- 276K LOC growing rapidly, feature accretion, 83 releases in 5 months | LOW -- intentionally frozen architecture |
| **Storage stability** | LOW -- Dolt is mature, backed by DoltHub team contributing directly | HIGH -- FrankenSQLite corruption is dominant issue category, 20+ related bugs |
| **Ecosystem lock-in** | MEDIUM -- deep Dolt dependency, GasTown coupling | LOW -- standard SQLite + plain JSONL |
| **Bus factor** | LOW -- 450+ contributors, DoltHub team, active community | HIGH -- single maintainer + AI co-author, unconventional PR policy |
| **Data portability** | MEDIUM -- JSONL export available but loses wisps/molecules; Dolt can push to standard Git remotes | HIGH -- JSONL is the primary format, standard SQLite (when not using fsqlite) |

---

## Implementation Approaches and Technology Adoption

### Decision Framework: When to Use Which Tool

Based on the research findings, the choice between bd and br is determined by use case, not quality:

| Use Case | Recommendation | Rationale |
|---|---|---|
| **Single developer, single agent** | **br** | Simpler, smaller binary, no daemon, explicit control |
| **Multi-agent workflows (GasTown)** | **bd** | Multi-writer, federation, agent state machine, gate coordination |
| **Team collaboration** | **bd** | Dolt push/pull, cell-level merge, auto-sync |
| **Non-git VCS (Sapling, Jujutsu, Piper)** | **bd** | `BEADS_DIR` env var + `no-git-ops: true` bypasses git |
| **Minimal footprint / air-gapped** | **br** | 5-8 MB static binary, no network dependencies |
| **Agent Flywheel / MCP Agent Mail** | **br** | Purpose-built for Emanuel's tooling ecosystem |
| **Enterprise with Jira/Linear/GitLab** | **bd** | External tracker sync via SyncEngine |
| **Avoiding complexity / "just a TODO list"** | **br** (or neither) | br is 14x less code; some users prefer even simpler alternatives |

**Confidence: HIGH** -- Based on stated design goals from both authors and documented use cases.

### Adoption Strategies

#### Adopting bd (beads)

**Prerequisites:**
- Dolt installed (bundled with bd binary or available via `brew install dolt`)
- Git repository (or `BEADS_DIR` for non-git environments)
- Willingness to accept auto-installed git hooks and background Dolt server

**Adoption path:**
1. `npm install -g @beads/bd` or `brew install beads` or `go install`
2. `bd init` in project root (auto-starts Dolt server, installs hooks)
3. `bd prime` generates agent workflow context for Claude Code
4. For multi-agent: install Claude Code plugin from `claude-plugin/` directory
5. For team: configure Dolt remote (`bd dolt remote add`) and enable auto-push

**Risk: Rapid version churn.** 83 releases in 5 months means frequent upgrades with potential breaking changes. Schema migrations are automated but have caused issues (Issue #2634: schema upgrade path can miss columns).

_Source: https://github.com/steveyegge/beads README, installation docs_

#### Adopting br (beads_rust)

**Prerequisites:**
- Rust nightly (for building from source) or use pre-built binary
- Git repository
- Tolerance for FrankenSQLite stability issues

**Adoption path:**
1. `curl -fsSL https://raw.githubusercontent.com/Dicklesworthstone/beads_rust/main/install.sh | bash`
2. `br init` in project root (creates `.beads/` directory, no hooks, no daemon)
3. `br agents --add` generates AGENTS.md for AI coding agents
4. Manual `br sync` + `git commit` for collaboration
5. Optional: `br serve` for MCP server integration

**Risk: FrankenSQLite instability.** The dominant issue category is database corruption under concurrent access, bulk imports, and WAL operations. Users report data loss. Workaround: regular JSONL backups via `br sync --flush-only`.

**Critical note on FrankenSQLite:** Web search reveals that FrankenSQLite's README "describes the target end-state architecture" -- many advertised features (MVCC, RaptorQ self-healing, SSI) are aspirational/roadmap items, not fully implemented. Hacker News commenters noted: "If you're not running against the SQLite test suite, then you haven't written a viable SQLite replacement."

_Sources: https://github.com/Dicklesworthstone/beads_rust README, https://frankensqlite.com/, https://news.ycombinator.com/item?id=47176209_

### Migration Patterns

#### bd -> br Migration

**When:** Users fleeing bd complexity who need a simpler tool.

**Process:**
1. `bd export -o backup.jsonl` (from current bd version)
2. Install br
3. `br init` in project root
4. Copy `backup.jsonl` to `.beads/issues.jsonl`
5. `br sync --import-only`

**Known blockers:**
- Mixed-prefix JSONL fails (Issue #188 -- OPEN)
- `--rename-prefix` flag ignored during import (Issue #184 -- OPEN)
- 30+ GasTown fields silently lost
- Comment ID type incompatibility (UUID string vs autoincrement integer)
- Schema differences may require manual JSONL cleanup

**Confidence: MEDIUM** -- Process works for simple cases but has documented failure modes for real-world data.

#### br -> bd Migration

**When:** Users needing multi-agent/team collaboration features.

**Process:**
1. `br sync --flush-only` (ensure JSONL is current)
2. Install bd
3. `bd init` in project root
4. `bd import -i .beads/issues.jsonl`
5. Configure Dolt remote for team sync

**Known issues:**
- br-specific fields (`source_repo`, `deleted_*`, `original_type`) silently dropped
- Comment ID format change (integer -> UUID)
- No ongoing bidirectional sync possible

### Development Workflow Comparison

| Workflow | bd | br |
|---|---|---|
| **Agent starts work** | `bd prime` injects context via SessionStart hook | Agent reads AGENTS.md or uses MCP |
| **Create task** | `bd create --type task "..."` | `br create --type task "..."` or `br q "..."` |
| **Claim work** | `bd claim <id>` (atomic CAS operation) | `br update <id> --claim` (non-atomic) |
| **Track dependencies** | `bd dep add <a> blocks <b>` | `br dep add <a> blocks <b>` |
| **Find ready work** | `bd ready` | `br ready` |
| **Sync with team** | Automatic (Dolt auto-commit + auto-push) | Manual (`br sync` + `git add` + `git commit` + `git push`) |
| **Resolve conflicts** | Cell-level merge (automatic) | Line-level JSONL merge in git (manual) |
| **Review audit trail** | `bd audit` | No equivalent |
| **Compact old issues** | `bd compact` (semantic summarization) | No equivalent |

### GasTown Adoption Context

GasTown is Yegge's multi-agent orchestration framework that runs 20-30 parallel AI agents. As of March 2026:

- **Status**: Experimental, not consumer-ready. Used by some Fortune 100 companies but requires advanced users.
- **Cost**: ~$100/hour burn rate for full agent colonies.
- **Architecture**: Mayor orchestrates, Polecats execute in parallel worktrees, Witness/Deacon monitor health, Refinery manages merges. All workers have persistent identities as Agent Beads.
- **bd is required**: GasTown depends on bd's Dolt backend, multi-writer support, federation, and agent state machine. br cannot be used with GasTown.
- **Community reaction**: "Gas Town's chaos is real... For most developers, vanilla approach still wins. Gas Town is for a specific ambition level."

_Sources: https://softwareengineeringdaily.com/2026/02/12/gas-town-beads-and-the-rise-of-agentic-development-with-steve-yegge/, https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04, https://paddo.dev/blog/gastown-two-kinds-of-multi-agent/_

### The Broader Ecosystem

Beyond bd and br, the beads ecosystem includes multiple alternative implementations:

| Project | Approach | Status |
|---|---|---|
| **fwindolf/beads-rs** | Rust, keeps `bd` CLI, embedded SQLite | Active, 104 CLI commands |
| **delightful-ai/beads-rs** | Rust, daemon-based, git refs storage, no SQLite | Active on crates.io |
| **mindreader/beads_rust** | Fork of Dicklesworthstone's br | Active |
| **wedow/ticket** | Single-file bash script replacement | Created by frustrated ex-beads user |
| **Julio Merino's ticket.el** | Emacs-based alternative | Documented on blogsystem5.substack.com |

This fragmentation reinforces the finding that **there is no shared specification** governing interoperability. Each implementation makes its own compatibility decisions.

_Sources: GitHub repos, crates.io, https://news.ycombinator.com/item?id=46969033_

### Risk Mitigation Strategies

| Risk | Mitigation |
|---|---|
| **bd version churn** | Pin to a specific version; read CHANGELOG before upgrading; test in isolated worktree first |
| **br FrankenSQLite corruption** | Regular JSONL backups (`br sync --flush-only`); keep JSONL as source of truth; avoid concurrent `br` processes |
| **Data loss during migration** | Export JSONL before any migration; verify issue count and field integrity after import; keep original backup |
| **Ecosystem fragmentation** | Choose one implementation and commit; don't plan for cross-implementation sync |
| **GasTown cost** | Start with single-agent bd before scaling to full GasTown colonies; monitor API costs closely |
| **br bus factor** | PRs are reviewed by AI, not the maintainer; fork if maintainer becomes inactive; JSONL data is portable |

## Technical Research Recommendations

### For Users Evaluating Both Tools

1. **If you need multi-agent or team collaboration**: Use bd. The Dolt backend, cell-level merge, and auto-sync are architecturally necessary for concurrent workflows. br cannot provide this.

2. **If you need a simple, lightweight task tracker for a single agent**: Use br. Its explicit-over-implicit philosophy, 5-8 MB binary, and zero git automation make it ideal for focused workflows. But be prepared for SQLite stability issues.

3. **If you're already on bd and considering switching to br**: Only do so if you're willing to lose GasTown fields, accept FrankenSQLite risks, and don't need team sync. The migration path has documented blockers (#184, #188).

4. **If you're building tooling that integrates with beads**: Target bd's MCP server (`beads-mcp`) for maximum ecosystem compatibility, or br's MCP server (`br serve`) for simpler integration. Do not assume cross-compatibility.

### Key Insight: These Are Different Products

The most important conclusion is that **bd and br are not competing implementations of the same thing**. They are different products that share a common ancestor. bd is an agent coordination platform evolving toward GasTown. br is a focused issue tracker frozen at the classic architecture. The "protocol not product" framing is aspirational -- in practice, the divergence is structural and permanent.

---

## Technical Research Conclusion

### Summary of Key Findings

1. **The divergence is massive, intentional, and permanent.** beads_rust freezes the "classic" SQLite+JSONL architecture from October-December 2025. beads has since migrated to Dolt, removed SQLite and JSONL sync, and evolved into a multi-agent coordination platform (GasTown). Both authors publicly endorse this split.

2. **There are zero sync efforts between projects.** No cross-references from bd issues to br. No shared specification, test suite, or compatibility matrix. References flow one-way only (br issues referencing bd for behavioral comparison).

3. **The JSONL wire format is the sole interoperability surface**, but it's severely degraded. bd's Issue struct has 50+ fields; br's has ~35. Round-tripping through br destroys 30+ GasTown fields. Comment IDs are type-incompatible (UUID vs integer). Active bugs block import of real-world bd-exported JSONL (#184, #188).

4. **Core beads features that break compatibility include:** Dolt storage backend (v0.50.0+), JSONL sync pipeline removal (v0.56.0), SQLite backend removal (v0.58.0), multi-writer with cell-level merge, federation, GasTown's molecules/gates/slots/rigs/agent state machines, memory compaction, and external tracker sync.

5. **Each project faces distinct risks.** bd: complexity growth (276K LOC, 83 releases in 5 months). br: FrankenSQLite corruption (20+ bugs, user data loss, aspirational MVCC roadmap with no timeline).

6. **The "protocol not product" framing is aspirational.** No formal specification exists. The JSONL format is implicitly defined by bd's implementation and approximated by br with known incompatibilities.

### Strategic Impact Assessment

The beads ecosystem is fragmenting -- 3+ Rust implementations plus the Go original, all diverging without a shared spec. For tool builders and users, the practical implication is: **choose one implementation based on your use case and commit to it**. Cross-implementation portability is not achievable today and unlikely to improve given the architectural trajectories.

### Answers to Original Research Questions

**Q: How much have beads_rust and beads diverged?**
A: Fundamentally. Different languages (Go vs Rust), different storage (Dolt vs SQLite), different collaboration models (multi-writer server vs single-writer file), different data models (50+ fields vs ~35), different scope (agent coordination platform vs focused issue tracker). The only shared surface is a loosely-compatible JSONL format that bd no longer uses for day-to-day operations.

**Q: Any commentary on how much they are trying to stay in sync?**
A: They are explicitly **not** trying to stay in sync. Emanuel created br specifically to freeze the architecture bd was abandoning. Yegge endorsed this, framing beads as "a protocol, not an implementation." There are no shared maintainers, no sync PRs, and no compatibility testing between the projects.

**Q: What features have been added to core beads that might make it incompatible with beads_rust?**
A: The single biggest incompatibility is the **storage backend migration** (SQLite -> Dolt, with SQLite subsequently removed). Beyond that: JSONL sync pipeline removal, 30+ new Issue fields for GasTown (molecules, gates, slots, rigs, agent state, memory compaction), federation, external tracker sync, comment UUID IDs, schema version 8, and auto-installed git hooks. Any of these individually would create friction; together they make the projects architecturally irreconcilable.

---

## Source Documentation

### Primary Sources

- [steveyegge/beads GitHub Repository](https://github.com/steveyegge/beads)
- [Dicklesworthstone/beads_rust GitHub Repository](https://github.com/Dicklesworthstone/beads_rust)
- [DeepWiki: steveyegge/beads Architecture](https://deepwiki.com/steveyegge/beads)
- [DeepWiki: Dicklesworthstone/beads_rust Architecture](https://deepwiki.com/Dicklesworthstone/beads_rust)
- [steveyegge/beads CHANGELOG.md](https://github.com/steveyegge/beads/blob/main/CHANGELOG.md)
- [beads_rust EXISTING_BEADS_STRUCTURE_AND_ARCHITECTURE.md](https://github.com/Dicklesworthstone/beads_rust/blob/main/EXISTING_BEADS_STRUCTURE_AND_ARCHITECTURE.md)

### Author Statements

- [Steve Yegge endorsement tweet](https://x.com/Steve_Yegge/status/2012974366188032144)
- [Jeffrey Emanuel announcement tweet](https://x.com/doodlestein/status/2012972038332260744)
- [Steve Yegge LinkedIn endorsement](https://www.linkedin.com/posts/steveyegge_github-steveyeggebeads-beads-a-memory-activity-7418745364104622080-a4II)

### Key GitHub Issues

- [beads_rust #182: Roadmap for multi-user/multi-agent feature parity with bd](https://github.com/Dicklesworthstone/beads_rust/issues/182)
- [beads_rust #187: Redirect path comparison with Go implementation](https://github.com/Dicklesworthstone/beads_rust/issues/187)
- [beads_rust #188: Mixed-prefix JSONL blocks DB rebuild](https://github.com/Dicklesworthstone/beads_rust/issues/188)
- [beads_rust #184: --rename-prefix ignored during import](https://github.com/Dicklesworthstone/beads_rust/issues/184)
- [beads_rust #171: User frustration with SQLite problems](https://github.com/Dicklesworthstone/beads_rust/issues/171)
- [beads_rust #138: Concurrent SQLite corruption](https://github.com/Dicklesworthstone/beads_rust/issues/138)
- [beads_rust #125: Migration from non-classic bd](https://github.com/Dicklesworthstone/beads_rust/issues/125)
- [beads_rust #3: Migration experience report](https://github.com/Dicklesworthstone/beads_rust/issues/3)

### Articles and Blog Posts

- [Steve Yegge: "Welcome to Gas Town" (Medium)](https://steve-yegge.medium.com/welcome-to-gas-town-4f25ee16dd04)
- [Steve Yegge: "Introducing Beads" (Medium)](https://steve-yegge.medium.com/introducing-beads-a-coding-agent-memory-system-637d7d92514a)
- [Software Engineering Daily: Gas Town, Beads, and Agentic Development](https://softwareengineeringdaily.com/2026/02/12/gas-town-beads-and-the-rise-of-agentic-development-with-steve-yegge/)
- [DoltHub: "A Day in Gas Town"](https://www.dolthub.com/blog/2026-01-15-a-day-in-gas-town/)
- [Paddo: "GasTown and the Two Kinds of Multi-Agent"](https://paddo.dev/blog/gastown-two-kinds-of-multi-agent/)

### Community Discussion

- [Numman Ali on beads_rust](https://x.com/nummanali/status/2012978728557498606)
- [Joe Devon on beads_rust](https://x.com/joedevon/status/2019605631351812358)
- [HN: "A fast Rust port of Steve Yegge's beads"](https://news.ycombinator.com/item?id=46674515)
- [HN: Beads codebase size discussion](https://news.ycombinator.com/item?id=46669791)
- [HN: FrankenSQLite discussion](https://news.ycombinator.com/item?id=47176209)
- [FrankenSQLite website](https://frankensqlite.com/)

### Source Code References

- bd `internal/types/types.go` -- Issue struct definition
- bd `internal/storage/dolt/schema.go` -- Dolt database schema
- br `src/model/mod.rs` -- Issue struct definition
- br `src/storage/schema.rs` -- SQLite schema
- br `src/mcp/` -- MCP server implementation
- bd `integrations/beads-mcp/` -- MCP server implementation

### Additional Sources (Post-Synthesis Discussion)

- [beads MOLECULES.md -- Layering Model](https://github.com/steveyegge/beads/blob/main/docs/MOLECULES.md)
- [beads FAQ](https://steveyegge.github.io/beads/reference/faq)
- [Ian Bull: "Beads - Memory for your Agent"](https://ianbull.com/posts/beads/)
- [Paddo: "From Beads to Tasks: Anthropic Productizes Agent Memory"](https://paddo.dev/blog/from-beads-to-tasks/)

---

## Addendum: The Monolithic Data Model Question

*Added after formal research workflow based on follow-up analysis.*

### Is bd becoming a GasTown substrate rather than a generic beads tool?

**Finding: Yes, architecturally, but Yegge has not explicitly discussed this decision.**

bd's `MOLECULES.md` defines a layering model (Issues → Epics → Molecules → Protos → Formulas) and states "most users only need the bottom two layers." However, this layering is **conceptual, not architectural**:

- All 50+ fields live on a single `Issue` struct -- molecules, wisps, gates, slots, rigs, and agent state are all just issues with specific fields set
- All users migrate to schema version 8 regardless of whether they use GasTown features
- There is no feature flag, compile-time option, or "beads lite" mode

**The implicit rationale** (never explicitly stated by Yegge): "everything is an issue" simplifies agent graph traversal. Agents don't need to understand a type hierarchy -- they just follow dependency edges. This eliminates the need for a separate workflow engine.

**What Yegge has NOT said**: No public statement found defending why GasTown primitives are in beads vs. a separate layer, acknowledging complexity costs for non-GasTown users, or discussing a core-vs-extensions architecture.

**Practical impact**: The complexity is trending from inert (unused null fields) toward active (GasTown-driven schema changes causing migration bugs). Users who want beads-the-concept without GasTown-the-substrate may find br or alternative implementations better aligned with their needs.

---

**Technical Research Completion Date:** 2026-03-18
**Research Period:** Comprehensive technical analysis using current data
**Source Verification:** All technical facts cited with current sources
**Confidence Level:** High -- based on multiple authoritative sources including direct source code analysis, GitHub API data, author statements, and community discussion

_This technical research document serves as an authoritative reference on the divergence between steveyegge/beads and Dicklesworthstone/beads_rust, providing strategic insights for users evaluating or building on either implementation._
