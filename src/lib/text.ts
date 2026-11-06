import { marked } from 'marked';

const escape = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Inline formatting used across the admin: **bold**, _italic_, ((oval)), line breaks. */
export function inline(src?: string | null): string {
  if (!src) return '';
  let s = escape(src.trim());
  s = s.replace(/\(\((.+?)\)\)/g, '<span class="oval">$1</span>');
  s = marked.parseInline(s, { breaks: true }) as string;
  s = s.replace(/\n/g, '<br>');
  return s;
}

/** Multi-paragraph text: empty line = new paragraph. */
export function paragraphs(src?: string | null): string {
  if (!src) return '';
  return src
    .trim()
    .split(/\n\s*\n/)
    .map((p) => `<p>${inline(p)}</p>`)
    .join('');
}

export const lines = (src?: string | null) => (src ? src.split('\n').filter(Boolean) : []);
