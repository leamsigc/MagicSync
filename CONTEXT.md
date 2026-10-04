# MagicSync domain language

The ubiquitous language for MagicSync. A term belongs here only once code depends on
its shape; when a deepened module introduces a new concept, add the term at the same
time as the interface, not after.

Architecture words (`module`, `interface`, `depth`, `seam`, `adapter`, `locality`)
are deliberately **not** domain terms. They come from `codebase-design` vocabulary and
mean something different.

## Scheduling

| Term | Meaning | Not to be confused with |
| --- | --- | --- |
| **Post** | One piece of content bound to one Platform and one Account, with its own publish state. The central record. | A route handler. |
| **Platform** | An external network such as Facebook or Bluesky. The unit that owns capability limits and rate limits. | An Account. |
| **Account** | One authenticated identity on a Platform, connected by a user. | A Business. |
| **Campaign** | A named group of Posts, often bulk-imported, sharing media and schedule. | A Post. |
| **Asset** | A stored media file plus its folder and ownership. Filesystem paths are never held by callers. | A URL. |
| **Folder** | A user-scoped grouping of Assets. | A directory path. |
| **Publish Detail** | The platform's own record of a published Post — external id, permalink, timestamps. Two shapes exist in circulation; see ADR-0002. | Publish state. |
| **Publish State** | MagicSync's own view of a Post's lifecycle: draft, scheduled, publishing, published, failed. | Publish Detail. |

## Automation

| Term | Meaning | Not to be confused with |
| --- | --- | --- |
| **Auto-Reply** | The scheduled-response feature that answers comments and mentions on connected Accounts. | A notification. |
| **Auto-Post** | The scheduled-publishing feature that dispatches due Posts to Platforms. | The scheduler route handler. |
| **Reply Target** | The comment or mention an Auto-Reply answers, resolved once at processing time. | A Post. |
| **Rate Limit** | Per-Platform request budget. Two mechanisms exist: a shared window and an ad-hoc sleep inside one adapter. | A Platform capability limit. |
| **Token Refresh** | Exchanging a stored Platform credential for a working one. Meta page tokens must refresh *before* publish. | Account linking. |

## AI and content

| Term | Meaning | Not to be confused with |
| --- | --- | --- |
| **Capability** | One registered AI operation with a declared input schema, approval gate and validated output. Addressed by string id. | A Skill. |
| **Skill** | A named bundle of Capabilities offered to the assistant. | A Capability. |
| **Inbox** | The user's queued agent requests awaiting processing. | An Auto-Reply. |
| **Content Chain** | A multi-step generated-content pipeline. | A Capability. |

## Tenancy

| Term | Meaning | Not to be confused with |
| --- | --- | --- |
| **Business** | A tenant. Every row owned by a user belongs to one. | A Business Profile field. |
| **Owner** | The user or Business whose row a module is permitted to touch. | The authenticated session. |
| **Scoped** | A read or write whose predicate includes ownership. | Unscoped. |

Ownership is an **invariant**, not a parameter convention. See
`docs/adr/0001-layer-placement.md` for why it is currently unenforced at 60%.