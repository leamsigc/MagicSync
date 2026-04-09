import logging
import json
from app.services.llm import llm_service

logger = logging.getLogger(__name__)


class KnowledgeBaseTools:
    """Filesystem-like tools for knowledge base navigation."""

    def __init__(self, user_id: str):
        self.user_id = user_id

    async def kb_ls(self, folder_path: str | None = None) -> dict:
        """List documents and subfolders in a knowledge folder.
        
        Args:
            folder_path: Path to the folder (e.g., '/marketing' or '/'). 
                         If None, lists root level.
        
        Returns:
            dict with folders and documents lists
        """
        from app.core.db import get_db_pool
        
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                # Get folder by path
                folder_id = None
                if folder_path and folder_path != '/':
                    result = await conn.execute(
                        "SELECT id FROM knowledge_folders WHERE user_id = ? AND path = ?",
                        (self.user_id, folder_path)
                    )
                    row = result.one_or_none()
                    if row:
                        folder_id = row[0]

                # Get subfolders
                if folder_id:
                    folders_result = await conn.execute(
                        """SELECT id, name, path FROM knowledge_folders 
                           WHERE user_id = ? AND parent_id = ? ORDER BY name""",
                        (self.user_id, folder_id)
                    )
                else:
                    folders_result = await conn.execute(
                        """SELECT id, name, path FROM knowledge_folders 
                           WHERE user_id = ? AND parent_id IS NULL ORDER BY name""",
                        (self.user_id,)
                    )
                
                folders = [dict(row) for row in folders_result.fetchall()]
                
                # Get documents in this folder
                if folder_id:
                    docs_result = await conn.execute(
                        """SELECT id, filename, original_name, mime_type, size, created_at 
                           FROM documents WHERE user_id = ? AND folder_id = ? ORDER BY filename""",
                        (self.user_id, folder_id)
                    )
                else:
                    docs_result = await conn.execute(
                        """SELECT id, filename, original_name, mime_type, size, created_at 
                           FROM documents WHERE user_id = ? AND folder_id IS NULL ORDER BY filename""",
                        (self.user_id,)
                    )
                
                documents = [dict(row) for row in docs_result.fetchall()]
                
                return {
                    "folder_path": folder_path or "/",
                    "folders": folders,
                    "documents": documents
                }
        except Exception as e:
            logger.error(f"kb_ls failed: {e}")
            return {"error": str(e), "folders": [], "documents": []}

    async def kb_tree(self, folder_path: str | None = None) -> dict:
        """Show full hierarchical tree of knowledge base.
        
        Args:
            folder_path: Starting path (if None, shows from root)
        
        Returns:
            dict with tree structure
        """
        from app.core.db import get_db_pool
        
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                # Get all folders for user
                folders_result = await conn.execute(
                    """SELECT id, name, parent_id, path FROM knowledge_folders 
                       WHERE user_id = ? ORDER BY path""",
                    (self.user_id,)
                )
                folders = [dict(row) for row in folders_result.fetchall()]
                
                # Get all documents
                docs_result = await conn.execute(
                    """SELECT id, filename, folder_id FROM documents 
                       WHERE user_id = ? ORDER BY filename""",
                    (self.user_id,)
                )
                documents = [dict(row) for row in docs_result.fetchall()]
                
                # Build tree structure
                tree = self._build_tree(folders, documents, folder_path)
                return {"tree": tree}
        except Exception as e:
            logger.error(f"kb_tree failed: {e}")
            return {"error": str(e), "tree": {}}

    def _build_tree(self, folders: list, documents: list, start_path: str | None = None) -> dict:
        """Build tree structure from flat folder/document lists."""
        # Create lookup maps
        folder_map = {f['id']: {**f, 'children': [], 'documents': []} for f in folders}
        doc_map = {d['folder_id']: [] for d in documents if d.get('folder_id')}
        
        for doc in documents:
            fid = doc.get('folder_id')
            if fid:
                doc_map[fid].append(doc)
        
        # Assign documents to folders
        for fid, docs in doc_map.items():
            if fid in folder_map:
                folder_map[fid]['documents'] = docs
        
        # Handle root documents (no folder)
        root_docs = [d for d in documents if not d.get('folder_id')]
        
        # Build hierarchy
        root = {'name': 'root', 'path': '/', 'children': [], 'documents': root_docs}
        
        for f in folders:
            if not f.get('parent_id'):
                folder_map[f['id']]['children'] = []
                root['children'].append(folder_map[f['id']])
        
        # Add child folders
        for f in folders:
            pid = f.get('parent_id')
            if pid and pid in folder_map:
                folder_map[pid]['children'].append(folder_map[f['id']])
        
        # Filter to starting path if provided
        if start_path and start_path != '/':
            for f in root['children']:
                if f.get('path') == start_path:
                    return f
            return {"error": f"Folder not found: {start_path}"}
        
        return root

    async def kb_grep(self, pattern: str, folder_path: str | None = None, limit: int = 10) -> dict:
        """Search for pattern within folder documents.
        
        Args:
            pattern: Search pattern (regex supported)
            folder_path: Scope to specific folder (optional)
            limit: Max results
        
        Returns:
            dict with matching chunks
        """
        import re
        from app.core.db import get_db_pool
        
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                # Get document IDs in folder scope
                if folder_path:
                    folder_result = await conn.execute(
                        "SELECT id FROM knowledge_folders WHERE user_id = ? AND path = ?",
                        (self.user_id, folder_path)
                    )
                    folder_row = folder_result.one_or_none()
                    if not folder_row:
                        return {"error": f"Folder not found: {folder_path}", "matches": []}
                    
                    folder_id = folder_row[0]
                    # Get all descendant folder IDs
                    folder_ids = await self._get_descendant_folder_ids(conn, folder_id)
                    folder_ids.append(folder_id)
                    
                    placeholders = ','.join(['?' for _ in folder_ids])
                    docs_result = await conn.execute(
                        f"SELECT id FROM documents WHERE user_id = ? AND folder_id IN ({placeholders})",
                        (self.user_id, *folder_ids)
                    )
                else:
                    docs_result = await conn.execute(
                        "SELECT id FROM documents WHERE user_id = ?",
                        (self.user_id,)
                    )
                
                doc_ids = [row[0] for row in docs_result.fetchall()]
                
                if not doc_ids:
                    return {"matches": []}
                
                # Search in chunks using FTS
                placeholders = ','.join(['?' for _ in doc_ids])
                search_query = f"%{pattern}%"
                
                results = await conn.execute(
                    f"""SELECT dc.content, dc.metadata, dc.document_id, d.filename 
                        FROM document_chunks dc
                        JOIN documents d ON dc.document_id = d.id
                        WHERE dc.document_id IN ({placeholders}) AND dc.content LIKE ?
                        LIMIT ?""",
                    (*doc_ids, search_query, limit)
                )
                
                matches = []
                for row in results.fetchall():
                    metadata = row[2]
                    if metadata:
                        try:
                            metadata = json.loads(metadata)
                        except:
                            metadata = {}
                    
                    # Highlight pattern in content
                    content = row[0]
                    try:
                        regex = re.compile(pattern, re.IGNORECASE)
                        highlighted = regex.sub(f"**{pattern.upper()}**", content)
                    except:
                        highlighted = content
                    
                    matches.append({
                        "content": highlighted[:500],
                        "document_id": row[2],
                        "filename": row[3],
                        "metadata": metadata
                    })
                
                return {"pattern": pattern, "folder_path": folder_path, "matches": matches}
        except Exception as e:
            logger.error(f"kb_grep failed: {e}")
            return {"error": str(e), "matches": []}

    async def _get_descendant_folder_ids(self, conn, folder_id: str) -> list:
        """Recursively get all descendant folder IDs."""
        ids = []
        
        async def get_children(parent_id: str):
            result = await conn.execute(
                "SELECT id FROM knowledge_folders WHERE parent_id = ?",
                (parent_id,)
            )
            for row in result.fetchall():
                child_id = row[0]
                ids.append(child_id)
                await get_children(child_id)
        
        await get_children(folder_id)
        return ids

    async def kb_glob(self, pattern: str) -> dict:
        """Find documents matching filename pattern.
        
        Args:
            pattern: Glob pattern (e.g., '*.pdf', 'report*')
        
        Returns:
            dict with matching documents
        """
        from app.core.db import get_db_pool
        import fnmatch
        
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                result = await conn.execute(
                    """SELECT id, filename, original_name, mime_type, size, folder_id
                       FROM documents WHERE user_id = ? ORDER BY filename""",
                    (self.user_id,)
                )
                
                all_docs = [dict(row) for row in result.fetchall()]
                
                # Filter by pattern
                matching = [d for d in all_docs if fnmatch.fnmatch(d['filename'], pattern)]
                
                return {
                    "pattern": pattern,
                    "matches": matching
                }
        except Exception as e:
            logger.error(f"kb_glob failed: {e}")
            return {"error": str(e), "matches": []}

    async def kb_read(self, document_id: str) -> dict:
        """Read full content of a specific document.
        
        Args:
            document_id: ID of the document to read
        
        Returns:
            dict with document metadata and all chunks concatenated
        """
        from app.core.db import get_db_pool
        import os
        
        try:
            pool = await get_db_pool()
            async with pool.acquire() as conn:
                # Get document metadata
                doc_result = await conn.execute(
                    """SELECT id, filename, original_name, mime_type, storage_path, metadata, folder_id
                       FROM documents WHERE id = ? AND user_id = ?""",
                    (document_id, self.user_id)
                )
                
                doc_row = doc_result.one_or_none()
                if not doc_row:
                    return {"error": "Document not found", "document": None}
                
                document = {
                    "id": doc_row[0],
                    "filename": doc_row[1],
                    "original_name": doc_row[2],
                    "mime_type": doc_row[3],
                    "storage_path": doc_row[4],
                    "metadata": doc_row[5],
                    "folder_id": doc_row[6]
                }
                
                # Parse metadata JSON
                if document.get('metadata'):
                    try:
                        document['metadata'] = json.loads(document['metadata'])
                    except:
                        pass
                
                # Get all chunks
                chunks_result = await conn.execute(
                    """SELECT content, chunk_index, metadata FROM document_chunks 
                       WHERE document_id = ? ORDER BY chunk_index""",
                    (document_id,)
                )
                
                chunks = []
                full_content_parts = []
                
                for row in chunks_result.fetchall():
                    chunk = {
                        "content": row[0],
                        "chunk_index": row[1],
                        "metadata": row[2]
                    }
                    chunks.append(chunk)
                    full_content_parts.append(row[0])
                
                return {
                    "document": document,
                    "chunks": chunks,
                    "full_content": "\n\n---\n\n".join(full_content_parts)
                }
        except Exception as e:
            logger.error(f"kb_read failed: {e}")
            return {"error": str(e), "document": None}


# Tool definitions for LLM function calling
KB_TOOLS = [
    {
        "name": "kb_ls",
        "description": "List documents and subfolders in a knowledge folder. Use to explore what's in a specific folder or at the root level.",
        "parameters": {
            "type": "object",
            "properties": {
                "folder_path": {
                    "type": "string",
                    "description": "Path to the folder (e.g., '/marketing' or '/'). If not provided, lists root level."
                }
            }
        }
    },
    {
        "name": "kb_tree",
        "description": "Show full hierarchical tree of knowledge base. Use to get an overview of the entire folder structure.",
        "parameters": {
            "type": "object",
            "properties": {
                "folder_path": {
                    "type": "string",
                    "description": "Starting path for tree (optional, defaults to root)"
                }
            }
        }
    },
    {
        "name": "kb_grep",
        "description": "Search for a pattern within folder documents. Use to find specific content across documents in a folder.",
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Search pattern (supports regex)"
                },
                "folder_path": {
                    "type": "string",
                    "description": "Scope search to specific folder (optional)"
                },
                "limit": {
                    "type": "integer",
                    "description": "Maximum number of matches",
                    "default": 10
                }
            },
            "required": ["pattern"]
        }
    },
    {
        "name": "kb_glob",
        "description": "Find documents matching filename pattern. Use to quickly locate files by name patterns.",
        "parameters": {
            "type": "object",
            "properties": {
                "pattern": {
                    "type": "string",
                    "description": "Glob pattern (e.g., '*.pdf', 'report*')"
                }
            },
            "required": ["pattern"]
        }
    },
    {
        "name": "kb_read",
        "description": "Read full content of a specific document. Use to get the complete text of a document after finding it with ls, tree, or glob.",
        "parameters": {
            "type": "object",
            "properties": {
                "document_id": {
                    "type": "string",
                    "description": "ID of the document to read"
                }
            },
            "required": ["document_id"]
        }
    }
]
