/**
 * WhatsApp-style `_chat.txt` parser.
 *
 * Handles the iOS bracketed form and the Android dash form, multi-line messages,
 * system notices without a sender, and attachment references. Directional marks
 * that real exports embed are stripped before matching but the original text is
 * what gets cited.
 *
 * A reconstructed archive is labelled as reconstructed. The format role in the
 * filename (Mom / Dad / Family) is NOT evidence of who authored the underlying
 * recollection; the real attribution travels in the evidence root.
 */

const INVISIBLE = /[‎‏‪-‮﻿]/g;

// [12/03/2024, 10:04:11] Sender: text      (iOS)
const IOS = /^\[(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+([0-9:]{4,8}(?:\s*[APap][Mm])?)\]\s*([^:]{1,80}?):\s?([\s\S]*)$/;
// 12/03/2024, 10:04 - Sender: text         (Android)
const ANDROID = /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+([0-9:]{4,8}(?:\s*[APap][Mm])?)\s+-\s+([^:]{1,80}?):\s?([\s\S]*)$/;
// same two shapes without a sender (system notices)
const IOS_SYS = /^\[(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+([0-9:]{4,8}(?:\s*[APap][Mm])?)\]\s*([\s\S]*)$/;
const ANDROID_SYS = /^(\d{1,4}[./-]\d{1,2}[./-]\d{1,4}),?\s+([0-9:]{4,8}(?:\s*[APap][Mm])?)\s+-\s+([\s\S]*)$/;

const ATTACHMENT = [
  /<attached:\s*([^>]+)>/i,
  /^([\w\-. ]+\.(?:jpe?g|png|gif|webp|pdf|mp4|m4a|opus|ogg|txt|docx?))\s*\(file attached\)/i,
];

function startsMessage(line) {
  const l = line.replace(INVISIBLE, '');
  return IOS.test(l) || ANDROID.test(l) || IOS_SYS.test(l) || ANDROID_SYS.test(l);
}

function splitHead(line) {
  const l = line.replace(INVISIBLE, '');
  for (const re of [IOS, ANDROID]) {
    const m = re.exec(l);
    if (m) return { date: m[1], time: m[2], sender: m[3].trim(), text: m[4] };
  }
  for (const re of [IOS_SYS, ANDROID_SYS]) {
    const m = re.exec(l);
    if (m) return { date: m[1], time: m[2], sender: null, text: m[3] };
  }
  return null;
}

function findAttachment(text) {
  for (const re of ATTACHMENT) {
    const m = re.exec(text);
    if (m) return m[1].trim();
  }
  return null;
}

/**
 * @param {string} text  decoded UTF-8 `_chat.txt`
 * @param {object} [options] {archiveName, chatEntryName}
 * @returns {{messages: Array, warnings: string[], format: string}}
 */
export function parseChatTranscript(text, options = {}) {
  const archiveName = options.archiveName || 'archive.zip';
  const entryName = options.chatEntryName || '_chat.txt';
  const warnings = [];
  const lines = String(text).split(/\r\n|\r|\n/);

  const blocks = [];
  let current = null;
  let startLine = 1;
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (startsMessage(line)) {
      if (current) blocks.push({ ...current, endLine: i });
      current = { raw: line, startLine: i + 1 };
      startLine = i + 1;
    } else if (current) {
      current.raw += `\n${line}`;                 // multi-line continuation
    } else if (line.trim()) {
      warnings.push(`Line ${i + 1} precedes the first recognised message and was skipped.`);
    }
  }
  if (current) blocks.push({ ...current, endLine: lines.length });

  if (!blocks.length) {
    return { messages: [], warnings: [...warnings, 'No messages matched a supported WhatsApp export layout.'], format: 'unrecognised' };
  }

  let format = 'unknown';
  const messages = [];
  for (let i = 0; i < blocks.length; i += 1) {
    const b = blocks[i];
    const head = splitHead(b.raw.split('\n')[0]);
    if (!head) continue;
    if (format === 'unknown') {
      const first = b.raw.split('\n')[0].replace(INVISIBLE, '');
      format = IOS.test(first) || IOS_SYS.test(first) ? 'whatsapp-ios' : 'whatsapp-android';
    }
    const rest = b.raw.split('\n').slice(1).join('\n');
    const body = (head.text + (rest ? `\n${rest}` : '')).trim();
    const attachment = findAttachment(body);
    messages.push({
      index: i + 1,
      // Locator resolves inside the archive, then inside the transcript.
      locator: `${archiveName}!${entryName}#msg:${i + 1}`,
      lineRange: `L${b.startLine}-L${b.endLine}`,
      declaredDate: head.date,
      declaredTime: head.time,
      speakerRole: head.sender,          // a format role, not a verified author
      text: body,
      attachmentName: attachment,
      isSystemNotice: head.sender == null,
      lineCount: b.raw.split('\n').length,
    });
  }

  const systemCount = messages.filter((m) => m.isSystemNotice).length;
  if (systemCount) warnings.push(`${systemCount} system notice(s) retained without a sender.`);
  return { messages, warnings, format };
}

/** Find the transcript entry inside an extracted archive listing. */
export function findChatEntry(entries) {
  const extracted = entries.filter((e) => e.status === 'extracted');
  return extracted.find((e) => /(^|\/)_chat\.txt$/i.test(e.name))
    || extracted.find((e) => /\.txt$/i.test(e.name))
    || null;
}
