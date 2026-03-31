-- RAG table indexes for production query performance
CREATE INDEX IF NOT EXISTS `idx_documents_user_id` ON `documents` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_documents_user_content_hash` ON `documents` (`user_id`, `content_hash`);
CREATE INDEX IF NOT EXISTS `idx_documents_status` ON `documents` (`status`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chunks_document_id` ON `document_chunks` (`document_id`);
CREATE INDEX IF NOT EXISTS `idx_chunks_user_id` ON `document_chunks` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_chunks_user_document` ON `document_chunks` (`user_id`, `document_id`);
CREATE INDEX IF NOT EXISTS `idx_chunks_content_hash` ON `document_chunks` (`content_hash`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chat_threads_user_id` ON `chat_threads` (`user_id`);
CREATE INDEX IF NOT EXISTS `idx_chat_threads_last_message` ON `chat_threads` (`user_id`, `last_message_at`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `idx_chat_messages_thread_id` ON `chat_messages` (`thread_id`);
CREATE INDEX IF NOT EXISTS `idx_chat_messages_thread_created` ON `chat_messages` (`thread_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `idx_chat_messages_user_id` ON `chat_messages` (`user_id`);
--> statement-breakpoint
-- FTS5 virtual table for keyword search (BM25)
CREATE VIRTUAL TABLE IF NOT EXISTS `document_chunks_fts` USING fts5(
  `content`,
  content=`document_chunks`,
  content_rowid=`rowid`
);
--> statement-breakpoint
-- Triggers to keep FTS index in sync with document_chunks
CREATE TRIGGER IF NOT EXISTS `document_chunks_ai` AFTER INSERT ON `document_chunks` BEGIN
  INSERT INTO `document_chunks_fts`(rowid, `content`) VALUES (new.rowid, new.`content`);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `document_chunks_ad` AFTER DELETE ON `document_chunks` BEGIN
  INSERT INTO `document_chunks_fts`(`document_chunks_fts`, rowid, `content`) VALUES ('delete', old.rowid, old.`content`);
END;
--> statement-breakpoint
CREATE TRIGGER IF NOT EXISTS `document_chunks_au` AFTER UPDATE ON `document_chunks` BEGIN
  INSERT INTO `document_chunks_fts`(`document_chunks_fts`, rowid, `content`) VALUES ('delete', old.rowid, old.`content`);
  INSERT INTO `document_chunks_fts`(rowid, `content`) VALUES (new.rowid, new.`content`);
END;
