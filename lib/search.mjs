/** Full-text lookup over the supplied book, with Vietnamese accent folding. */
export function normalizeText(value) {
  return String(value ?? '').replace(/[đĐ]/g, 'd').normalize('NFKD')
    .replace(/\p{M}+/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ')
    .trim().replace(/\s+/g, ' ');
}

const list = value => Array.isArray(value) ? value : [];
const joined = values => values.filter(value => value != null && value !== '').join(' ');
const phraseIn = (text, phrase) => phrase !== '' && (` ${text} `).includes(` ${phrase} `);

export function parseQuery(value) {
  const raw = String(value ?? '');
  const phrases = [];
  const remainder = raw.replace(/["“]([^"”]*)["”]/g, (_, value) => {
    const phrase = normalizeText(value);
    if (phrase) phrases.push(phrase);
    return ' ';
  });
  const tokens = [...new Set(normalizeText(remainder).split(' ').filter(Boolean))];
  return {tokens, phrases:[...new Set(phrases)], fullText:normalizeText(raw)};
}

export function createSearchIndex(book = {}) {
  const parts = new Map(list(book.parts).map(part => [part.id, part]));
  const articles = new Map(list(book.articles).map(article => [article.id, article]));
  const byId = new Map(list(book.entries).map(entry => [entry.id, entry]));
  const records = list(book.entries).map((entry, position) => {
    const parentTitles = [];
    const seen = new Set([entry.id]);
    let parent = byId.get(entry.parentId);
    while (parent && !seen.has(parent.id)) {
      seen.add(parent.id);
      parentTitles.unshift(parent.title);
      parent = byId.get(parent.parentId);
    }
    const title = normalizeText(joined([entry.number, entry.title]));
    const context = normalizeText(joined([parts.get(entry.partId)?.title, articles.get(entry.articleId)?.title, ...parentTitles]));
    const body = normalizeText(joined([
      entry.sourceText,
      ...list(entry.blocks).map(block => block.text || list(block.rows).map(row => list(row).join(' ')).join(' ')),
    ]));
    const numericOrder = Number(entry.order);
    return {entry, position, order:Number.isFinite(numericOrder) ? numericOrder : position,
      title, context, body, all:joined([title, context, body])};
  });
  return {records};
}

/** All unquoted terms must occur; quoted phrases must be contiguous words. */
export function searchEntries(index, options = {}) {
  const settings = options ?? {};
  const mode = settings.mode === 'title' ? 'title' : 'all';
  const query = parseQuery(settings.query);
  const favorites = settings.favoriteIds instanceof Set ? settings.favoriteIds
    : Array.isArray(settings.favoriteIds) ? new Set(settings.favoriteIds) : null;
  const results = [];
  for (const record of list(index?.records)) {
    const entry = record.entry;
    if (settings.partId && entry.partId !== settings.partId) continue;
    if (settings.articleId && entry.articleId !== settings.articleId) continue;
    if (favorites && !favorites.has(entry.id)) continue;
    const haystack = record[mode];
    if (!query.tokens.every(token => haystack.includes(token)) ||
        !query.phrases.every(phrase => phraseIn(haystack, phrase))) continue;
    let score = 0;
    if (query.fullText) {
      if (record.title === query.fullText) score += 500;
      if (phraseIn(record.title, query.fullText)) score += 250;
      if (phraseIn(record.body, query.fullText)) score += 70;
      if (phraseIn(record.context, query.fullText)) score += 20;
      for (const token of [...query.tokens, ...query.phrases]) {
        if (phraseIn(record.title, token)) score += 20;
        else if (record.title.includes(token)) score += 12;
        if (record.body.includes(token)) score += 4;
      }
    }
    results.push({record, score});
  }
  results.sort((a,b) => settings.sort === 'book'
    ? a.record.order - b.record.order || a.record.position - b.record.position
    : b.score - a.score || a.record.order - b.record.order || a.record.position - b.record.position);
  return results.map(({record}) => record.entry);
}
