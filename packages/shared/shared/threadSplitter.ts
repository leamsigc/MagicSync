/**
 * Shared utility for splitting long post content into platform-sized chunks (threads).
 * Pure functions - no Vue/AI dependencies. Used by the composer UI to build
 * platform overrides where content = first chunk and comments = remaining chunks.
 *
 * @author Ismael Garcia <leamsigc@leamsigc.com>
 * @version 0.0.1
 */

/**
 * Splits text into chunks that each fit within maxLength.
 * Strategy: paragraphs -> sentences -> words -> hard slice.
 * Never returns empty chunks; preserves original wording (no truncation ellipsis).
 */
export function splitTextIntoChunks(content: string, maxLength: number): string[] {
  const trimmed = content.trim();
  if (!trimmed) return [];
  if (maxLength <= 0) return [trimmed];
  if (trimmed.length <= maxLength) return [trimmed];

  const paragraphs = trimmed.split(/\n{2,}/);
  const chunks: string[] = [];
  let current = '';

  const flush = () => {
    if (current.trim()) {
      chunks.push(current.trim());
    }
    current = '';
  };

  const fits = (text: string, base: string) =>
    !base ? text.length <= maxLength : `${base}\n\n${text}`.length <= maxLength;

  for (const paragraph of paragraphs) {
    const p = paragraph.trim();
    if (!p) continue;

    if (fits(p, current)) {
      current = current ? `${current}\n\n${p}` : p;
      continue;
    }

    // Paragraph alone does not fit the remaining space
    if (p.length <= maxLength) {
      flush();
      current = p;
      continue;
    }

    // Paragraph itself is longer than a whole chunk: break into sentences
    for (const sentence of splitIntoSentences(p)) {
      if (fits(sentence, current)) {
        current = current ? `${current} ${sentence}` : sentence;
        continue;
      }
      if (sentence.length <= maxLength) {
        flush();
        current = sentence;
        continue;
      }
      // Sentence longer than a chunk: break into words
      for (const piece of splitIntoWords(sentence, maxLength)) {
        if (fits(piece, current)) {
          current = current ? `${current} ${piece}` : piece;
        } else {
          flush();
          current = piece;
        }
      }
    }
  }
  flush();

  return chunks.length > 0 ? chunks : [trimmed];
}

function splitIntoSentences(text: string): string[] {
  const parts = text.split(/(?<=[.!?…])\s+/).filter(s => s.trim());
  return parts.length > 0 ? parts : [text];
}

function splitIntoWords(text: string, maxLength: number): string[] {
  const pieces: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    if (!word) continue;
    if (!current) {
      current = word;
    } else if (`${current} ${word}`.length <= maxLength) {
      current = `${current} ${word}`;
    } else {
      pieces.push(current);
      current = word;
    }
    // Hard-slice single words that exceed maxLength (e.g. long URLs)
    while (current.length > maxLength) {
      pieces.push(current.slice(0, maxLength));
      current = current.slice(maxLength);
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

export interface PlatformThreadResult {
  /** true when content fits within maxPostLength as a single post */
  fits: boolean;
  /** first chunk becomes the main post content */
  content: string;
  /** remaining chunks become thread replies / comments */
  comments: string[];
}

/**
 * Builds a platform split for a given limit:
 * master content stays untouched when it fits; otherwise it is split so the
 * first chunk is the post and the rest become comments (thread).
 */
export function buildPlatformSplit(content: string, maxLength: number): PlatformThreadResult {
  const trimmed = content.trim();
  if (!trimmed || maxLength <= 0 || trimmed.length <= maxLength) {
    return { fits: true, content: trimmed, comments: [] };
  }
  const chunks = splitTextIntoChunks(trimmed, maxLength);
  return {
    fits: false,
    content: chunks[0],
    comments: chunks.slice(1),
  };
}
