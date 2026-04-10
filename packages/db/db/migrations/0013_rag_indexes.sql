-- Add database indexes for RAG and chat tables to improve query performance
-- Indexes for document_chunks, documents, chat_messages, and chat_threads tables

-- document_chunks indexes
CREATE INDEX `idx_document_chunks_document` ON `document_chunks`(`document_id`);
CREATE INDEX `idx_document_chunks_user` ON `document_chunks`(`user_id`);

-- documents indexes  
CREATE INDEX `idx_documents_user` ON `documents`(`user_id`);
CREATE INDEX `idx_documents_status` ON `documents`(`status`);

-- chat_messages indexes for thread queries
CREATE INDEX `idx_chat_messages_thread` ON `chat_messages`(`thread_id`);
CREATE INDEX `idx_chat_messages_created` ON `chat_messages`(`created_at`);

-- chat_threads indexes
CREATE INDEX `idx_chat_threads_user` ON `chat_threads`(`user_id`);
CREATE INDEX `idx_chat_threads_last_message` ON `chat_threads`(`last_message_at`);