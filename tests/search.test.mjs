import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {createSearchIndex,searchEntries,normalizeText} from '../lib/search.mjs';

const book = JSON.parse(await fs.readFile(new URL('../data/book.json',import.meta.url),'utf8'));
const index = createSearchIndex(book);
const ids = values => values.map(value => value.id);

test('Vietnamese accented and unaccented queries return identical book results', () => {
  for (const [accented,plain] of [['giấc ngủ trưa','giac ngu trua'],['đồng hồ sinh học','dong ho sinh hoc'],['cà phê','ca phe'],['người già','nguoi gia']]) {
    const results = searchEntries(index,{query:accented});
    assert.ok(results.length,accented);
    assert.deepEqual(ids(results),ids(searchEntries(index,{query:plain})));
  }
  assert.equal(normalizeText('ĐỒNG HỒ — 13.4'),'dong ho 13 4');
});

test('title mode matches only the selected heading and prioritizes direct title matches', () => {
  const query='dong ho sinh hoc';
  const all=searchEntries(index,{query});
  assert.match(normalizeText(all[0].title),/dong ho sinh hoc/);
  const title=searchEntries(index,{query,mode:'title'});
  assert.ok(title.length);
  assert.ok(title.every(entry=>normalizeText(entry.title).includes(query)));
});

test('AND terms, phrases, part/article filters and source ordering compose correctly', () => {
  const part=book.parts[2];
  const results=searchEntries(index,{query:'giac ngu',partId:part.id,sort:'book'});
  assert.ok(results.length);
  assert.ok(results.every(entry=>entry.partId===part.id));
  assert.ok(results.every((entry,i)=>!i||results[i-1].order<entry.order));
  const article=book.articles.find(article=>article.partId===part.id);
  const selected=searchEntries(index,{articleId:article.id});
  assert.deepEqual(ids(selected),article.entryIds);
  assert.deepEqual(searchEntries(index,{query:'giac ngu qzxnonexistent'}),[]);
  const quoted=searchEntries(index,{query:'“đồng hồ sinh học”'});
  assert.ok(quoted.length);
  assert.deepEqual(ids(quoted),ids(searchEntries(index,{query:'"dong ho sinh hoc"'})));
  assert.deepEqual(searchEntries(index,{query:'"sinh dong hoc ho"'}),[]);
});

test('favorite filtering, empty input and original object identities remain stable', () => {
  assert.deepEqual(searchEntries(index,{favoriteIds:[]}),[]);
  const target=book.entries[41];
  assert.equal(searchEntries(index,{favoriteIds:new Set([target.id])})[0],target);
  assert.equal(searchEntries(index,{}).length,355);
  assert.equal(searchEntries(index,{query:'   ',sort:'book'})[0],book.entries[0]);
  assert.deepEqual(searchEntries(null),[]);
});

test('book links and source completeness metadata remain internally consistent', () => {
  assert.equal(book.parts.length,5);
  assert.equal(book.articles.length,58);
  assert.equal(book.entries.length,355);
  assert.equal(book.meta.sourceNonemptyParagraphCount,500);
  const entryMap=new Map(book.entries.map(entry=>[entry.id,entry]));
  assert.equal(entryMap.size,book.entries.length);
  for(const article of book.articles) {
    assert.equal(entryMap.get(article.rootEntryId).level,1);
    assert.ok(Number.isInteger(article.printedPage));
    assert.ok(article.entryIds.every(id=>entryMap.get(id)?.articleId===article.id));
  }
  for(const entry of book.entries) {
    assert.ok(entry.title && entry.sourceText);
    assert.ok(entry.blocks.length || entry.children.length);
    if(entry.parentId) assert.ok(entryMap.get(entry.parentId)?.children.includes(entry.id));
    assert.ok(entry.children.every(id=>entryMap.get(id)?.parentId===entry.id));
  }
});
