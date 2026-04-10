-- Create FTS5 virtual table for document chunks
CREATE VIRTUAL TABLE IF NOT EXISTS document_chunks_fts USING fts5(
    content,
    document_id UNINDEXED,
    chunk_index UNINDEXED,
    tokenize='porter unicode61'
);

-- Trigger to sync INSERT to FTS5
CREATE TRIGGER IF NOT EXISTS document_chunks_ai AFTER INSERT ON document_chunks BEGIN
    INSERT INTO document_chunks_fts(rowid, content, document_id, chunk_index)
    VALUES (NEW.rowid, NEW.content, NEW.document_id, NEW.chunk_index);
END;

-- Trigger to sync DELETE from FTS5
CREATE TRIGGER IF NOT EXISTS document_chunks_ad AFTER DELETE ON document_chunks BEGIN
    DELETE FROM document_chunks_fts WHERE rowid = OLD.rowid;
END;

-- Trigger to sync UPDATE to FTS5
CREATE TRIGGER IF NOT EXISTS document_chunks_au AFTER UPDATE ON document_chunks BEGIN
    UPDATE document_chunks_fts SET content = NEW.content WHERE rowid = NEW.rowid;
END;