# Aether Drive — implementation and parity ledger

Jonathan authorized Drive on 2026-10-03 and requested every stage in the proposed
build order. Drive is the Studio file experience; core/host remains the server,
products own their document semantics, and core/ui supplies shared presentation.
No parallel copy of editor documents is introduced.

The reference is Microsoft OneDrive's browser file management and organization /
shared-library behavior. Native OS Files On-Demand, Microsoft Office web editing,
enterprise compliance and Microsoft's hosted infrastructure are separate integrations,
not implied by a Drive-shaped UI. References:
https://learn.microsoft.com/en-us/sharepoint/deploy-file-collaboration
https://learn.microsoft.com/en-us/sharepoint/onedrive-overview

Implemented and verified on 2026-10-03 (evidence in STATUS):

- Organizations, workspace membership, shared ownership, inherited file grants.
- Existing IDs/bytes/history migrated in place; legacy scope permissions preserved.
- One mixed-type library, folders, recent files, favorites, search/filter/sort/grid.
- Shared app-home format, Drive branding, launcher registration and app links.
- Create, upload, download, rename, copy/move, recycle/restore/permanent deletion.
- Specific-person sharing, expiring organization links, revocation enforced by editors.
- Type-based launching, native creation into a selected Drive destination.
- Existing versions/branches, comments, notes and tasks attached to the same file IDs.
- Resumable uploads, immutable external blobs, streamed downloads/ranges, backup restore.
- Optional Python desktop folder sync with conflicts, stable-ID renames, revocation,
  safe filenames, deletion/recovery and account/destination guards; real HTTP test.
- Folder upload/ZIP download and small text editing, native upload type recognition.

Jonathan narrowed the milestone to internal on-site teams on 2026-10-03. External
guests and native Files On-Demand are not required. See [on-site deployment](Aether_Studio_Onsite.md).

Beyond the current scope: Office browser
editors, malware/ransomware classification, compliance retention/eDiscovery, high
availability/object-store deployment and production scale certification.

Operational bounds: 512 MB general uploads; existing native editor save cap 6 MB;
20 GB backup restore cap; no blob garbage collection or organization storage quota
yet. The sync companion requires a Studio installation and Python; no user folder
was enrolled automatically. Real-time concurrent document coediting is not provided.
OneDrive-equivalent public SaaS operations, integrations and platform certification
remain roadmap work; the shipped local Drive should not be described as full
Microsoft OneDrive parity.

### Home roadmap cards — 2026-10-12

User-requested future cards: simultaneous supported-document editing and presence; integrated desktop sync, offline and files on demand; document-content search; workspace-wide point-in-time recovery. Cards describe intent only, without dates or shipped status.
