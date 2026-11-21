import { createSearchIndex, searchEntries } from './lib/search.mjs';
import { createUserStore } from './lib/storage.mjs';

const $ = (id) => document.getElementById(id);
const escapeHTML = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name) => '<svg class="icon" aria-hidden="true"><use href="#i-' + name + '"></use></svg>';
const titleOf = (value) => { const text = String(value || ''); return text === text.toLocaleUpperCase('vi') ? text.charAt(0) + text.slice(1).toLocaleLowerCase('vi') : text; };
const PAGE_SIZE = 24;
const systemTheme = window.matchMedia('(prefers-color-scheme: dark)');
let book, searchIndex, userStore, entriesById, articlesById, partsById;
let searchState = {query:'',partId:'',articleId:'',mode:'all',sort:'relevance'};
let activeView = 'search', savedTab = 'favorites', resultLimit = PAGE_SIZE;
let currentEntryId = null, currentArticleId = null, fullArticle = false;
let lastBaseHash = '#/search', previousHash = '', canCloseWithBack = false;
let searchTimer, noteTimer, toastTimer, pendingNote = null;
let dataLoading = false, eventsBound = false, deferredInstall = null;
let serviceWorkerRegistration = null, offlineReady = false, sourceDocxCached = false, offlineError = '', reloadForUpdate = false;

function toast(message, duration = 3800) {
  clearTimeout(toastTimer);
  $('toast').textContent = message;
  $('toast').hidden = false;
  ($('entryDialog').open ? $('entryDialog') : document.body).appendChild($('toast'));
  toastTimer = setTimeout(() => { $('toast').hidden = true; },duration);
}
function reportPersistence(result) {
  if (result?.persisted === false) toast('Chưa lưu được lâu dài trên thiết bị. Hãy xuất bản sao để giữ ghi chú và dấu trang.',6000);
}
function safeUserAction(action) {
  try { return action(); } catch (error) { toast(error.message || 'Chưa thực hiện được thao tác này.',6000); return null; }
}
function applyPreferences() {
  if (!userStore) return;
  const settings = userStore.state.settings;
  const dark = settings.theme === 'dark' || (settings.theme === 'system' && systemTheme.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  document.documentElement.style.setProperty('--reading-size',settings.fontSize + 'px');
  document.querySelector('meta[name="theme-color"]').content = dark ? '#101827' : '#182544';
  $('themeSelect').value = settings.theme;
  $('fontValue').textContent = settings.fontSize;
  $('fontSmaller').disabled = settings.fontSize <= 16;
  $('fontLarger').disabled = settings.fontSize >= 26;
}
function sourceURL() {
  const path = window.SLEEP_SOURCE_DOCX_URL || book?.meta?.sourceDocx || '/source/Giac_Ngu_Nguon.docx';
  return location.protocol === 'file:' && path.startsWith('/') ? '.' + path : path;
}
function buildSearchHash(options = searchState) {
  const p = new URLSearchParams();
  if (options.query) p.set('q',options.query);
  if (options.partId) p.set('phan',options.partId);
  if (options.articleId) p.set('muc',options.articleId);
  if (options.mode === 'title') p.set('tim','title');
  if (options.sort === 'book') p.set('sapxep','book');
  return '#/search' + (p.size ? '?' + p.toString() : '');
}
function entryURL(id) { return '#/entry/' + encodeURIComponent(id); }
function articleURL(id, at) { return '#/article/' + encodeURIComponent(id) + (at ? '?at=' + encodeURIComponent(at) : ''); }
function rememberSearchURL() {
  if (activeView !== 'search' || currentEntryId) return;
  const hash = buildSearchHash();
  history.replaceState(null,'',hash);
  previousHash = lastBaseHash = hash;
}
function sourceLabel(entry) {
  const part = partsById.get(entry.partId);
  return (part?.label || 'Phần sách') + ' · Mục ' + (entry.number || '');
}
function entryCard(entry, withNote = false) {
  const part = partsById.get(entry.partId), article = articlesById.get(entry.articleId);
  const saved = userStore.state.favorites.includes(entry.id);
  const note = withNote ? userStore.state.notes[entry.id] : '';
  const childCount = (entry.children || []).length;
  const excerpt = entry.excerpt || (childCount ? childCount + ' tiểu mục. Mở để chọn nội dung hoặc đọc trọn mục chính.' : 'Mở để đọc nội dung theo sách.');
  return '<article class="entry-card"><button type="button" class="icon-button card-save" data-save="' + escapeHTML(entry.id) + '" aria-pressed="' + saved + '" aria-label="' + (saved ? 'Bỏ đánh dấu ' : 'Đánh dấu ') + escapeHTML(titleOf(entry.title) + ', ' + sourceLabel(entry)) + '">' + icon('save') + '</button>' +
    '<a class="entry-card-link" href="' + entryURL(entry.id) + '"><div class="card-meta"><span class="part-pill">' + escapeHTML(part?.label || 'Nội dung sách') + '</span><span class="section-ref">Mục ' + escapeHTML(entry.number) + '</span></div><h3>' + escapeHTML(titleOf(entry.title)) + '</h3><p class="card-excerpt">' + escapeHTML(excerpt) + '</p>' +
    '<p class="card-context" title="' + escapeHTML(titleOf(article?.title || part?.title)) + '">' + icon('book') + escapeHTML(titleOf(entry.parentId ? article?.title : part?.title)) + '</p>' +
    (note ? '<p class="card-note">' + escapeHTML(note.slice(0,200)) + '</p>' : '') + '</a></article>';
}
function emptyState(title,message,buttonText,href) {
  return '<div class="empty-state">' + icon('book') + '<h3>' + escapeHTML(title) + '</h3><p>' + escapeHTML(message) + '</p>' + (buttonText ? '<a class="button button-primary" href="' + href + '">' + escapeHTML(buttonText) + '</a>' : '') + '</div>';
}
function refreshSaveButtons() {
  const favorites = new Set(userStore.state.favorites);
  $('savedBadge').textContent = favorites.size;
  $('savedBadge').hidden = !favorites.size;
  document.querySelectorAll('[data-save]').forEach((button) => {
    const saved = favorites.has(button.dataset.save), entry = entriesById.get(button.dataset.save);
    button.setAttribute('aria-pressed',String(saved));
    if (entry) button.setAttribute('aria-label',(saved ? 'Bỏ đánh dấu ' : 'Đánh dấu ') + titleOf(entry.title) + ', ' + sourceLabel(entry));
  });
  if (currentEntryId) {
    const saved = favorites.has(currentEntryId);
    $('detailSave').setAttribute('aria-pressed',String(saved));
    $('detailSave').setAttribute('aria-label',saved ? 'Bỏ đánh dấu mục này' : 'Đánh dấu mục này');
  }
}
function refreshFilters() {
  $('partFilter').value = searchState.partId;
  const articles = book.articles.filter((item) => item.partId === searchState.partId);
  $('articleWrap').hidden = !articles.length;
  $('articleFilter').innerHTML = '<option value="">Tất cả mục chính</option>' + articles.map((item) => '<option value="' + escapeHTML(item.id) + '">' + escapeHTML(item.number + '. ' + titleOf(item.title)) + '</option>').join('');
  if (!articles.some((item) => item.id === searchState.articleId)) searchState.articleId = '';
  $('articleFilter').value = searchState.articleId;
  $('sortFilter').value = searchState.sort;
  $('clearSearch').hidden = !searchState.query;
  $('examples').hidden = !!searchState.query;
  $('resetFilters').hidden = !(searchState.query || searchState.partId || searchState.articleId || searchState.mode !== 'all');
  document.querySelectorAll('[data-mode]').forEach((button) => { const active = button.dataset.mode === searchState.mode; button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active)); });
}
function renderSearch(resetLimit = true) {
  if (!book) return;
  if (resetLimit) resultLimit = PAGE_SIZE;
  refreshFilters();
  const results = searchEntries(searchIndex,searchState);
  $('resultCount').textContent = results.length + (searchState.query ? ' kết quả cho “' + searchState.query + '”' : ' mục tra cứu');
  $('results').innerHTML = results.length ? results.slice(0,resultLimit).map((entry) => entryCard(entry)).join('') : emptyState('Chưa tìm thấy nội dung phù hợp','Thử từ khóa ngắn hơn, tìm toàn bộ nội dung hoặc bỏ bộ lọc phần và mục.','Xem toàn bộ sách','#/search');
  $('loadMore').hidden = resultLimit >= results.length;
  $('loadMore').textContent = 'Xem thêm ' + Math.min(PAGE_SIZE,Math.max(0,results.length-resultLimit)) + ' mục';
  refreshSaveButtons();
}
function renderTable(rows,caption = '') {
  const cells = (row) => (Array.isArray(row) ? row : row.cells || []).map((cell) => typeof cell === 'object' && cell !== null ? cell.text || '' : cell);
  return '<div class="table-scroll"><table class="reading-table">' + (caption ? '<caption class="table-caption">' + escapeHTML(caption) + '</caption>' : '') + '<tbody>' + (rows || []).map((row,index) => '<tr>' + cells(row).map((cell) => '<' + (index === 0 ? 'th scope="col"' : 'td') + '>' + escapeHTML(cell) + '</' + (index === 0 ? 'th' : 'td') + '>').join('') + '</tr>').join('') + '</tbody></table></div>';
}
function renderContents() {
  $('contentsList').innerHTML = book.parts.map((part,index) => {
    const articles = book.articles.filter((item) => item.partId === part.id);
    return '<details class="contents-part"' + (index === 0 ? ' open' : '') + '><summary><span class="part-number">' + escapeHTML(part.number) + '</span><span class="part-summary"><strong>' + escapeHTML(titleOf(part.title)) + '</strong><small>' + articles.length + ' mục chính · ' + book.entries.filter((entry) => entry.partId === part.id).length + ' mục tra cứu</small></span><span class="part-chevron" aria-hidden="true"></span></summary><ol class="article-list">' + articles.map((article) => '<li><a href="' + articleURL(article.id) + '"><span class="article-number">' + escapeHTML(article.number) + '.</span><span class="article-label">' + escapeHTML(titleOf(article.title)) + '</span><span class="article-subcount">' + Math.max(0,article.entryIds.length-1) + ' tiểu mục</span></a></li>').join('') + '</ol></details>';
  }).join('');
  const toc = book.meta.sourceAppendix?.toc;
  if (toc?.rows?.length) $('contentsList').insertAdjacentHTML('beforeend','<details class="source-appendix"><summary>Mục lục theo trang sách gốc</summary><p class="muted small">Số trang được chép từ mục lục trong tài liệu Word; không phải số trang hiển thị của ứng dụng.</p>' + renderTable(toc.rows) + '</details>');
}
function renderSaved() {
  const state = userStore.state;
  const entries = savedTab === 'recent' ? state.recent.map((id) => entriesById.get(id)).filter(Boolean) : savedTab === 'notes' ? book.entries.filter((entry) => state.notes[entry.id]?.trim()) : book.entries.filter((entry) => state.favorites.includes(entry.id));
  document.querySelectorAll('[data-saved-tab]').forEach((button) => { const active = button.dataset.savedTab === savedTab;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active)); });
  $('savedCount').textContent = entries.length + ' mục ' + (savedTab === 'recent' ? 'vừa xem' : savedTab === 'notes' ? 'có ghi chú' : 'đã đánh dấu');
  $('savedResults').innerHTML = entries.length ? entries.map((entry) => entryCard(entry,savedTab === 'notes')).join('') : emptyState(savedTab === 'favorites' ? 'Chưa có mục đã đánh dấu' : savedTab === 'notes' ? 'Chưa có ghi chú' : 'Chưa có mục vừa xem',savedTab === 'favorites' ? 'Chạm biểu tượng đánh dấu trên một mục để tìm lại ở đây.' : savedTab === 'notes' ? 'Mở một mục và viết vào ô Ghi chú riêng ở cuối nội dung.' : 'Các mục bạn mở gần đây sẽ xuất hiện ở đây.','Mở sách','#/search');
  refreshSaveButtons();
}
function showView(view) {
  activeView = view;
  document.querySelectorAll('.view').forEach((section) => { section.hidden = section.id !== 'view-' + view; });
  document.querySelectorAll('.nav-item').forEach((link) => { const active = link.dataset.view === view;link.classList.toggle('active',active);if (active) link.setAttribute('aria-current','page');else link.removeAttribute('aria-current'); });
  if (view === 'search') { $('searchInput').value = searchState.query;renderSearch(); }
  if (view === 'contents') renderContents();
  if (view === 'saved') renderSaved();
  if (view === 'settings') { applyPreferences();refreshOfflineStatus(); }
  document.title = ({search:'Tra cứu',contents:'Mục lục',saved:'Đã lưu',settings:'Tùy chọn'}[view] || 'Tra cứu') + ' · Giấc ngủ';
}
function flushNote() {
  clearTimeout(noteTimer);
  if (!pendingNote || !userStore) return;
  const draft = pendingNote;
  pendingNote = null;
  try {
    const result = userStore.setNote(draft.id,draft.text);
    if (currentEntryId === draft.id) $('noteStatus').textContent = result.persisted ? 'Đã lưu' : 'Tạm lưu trong phiên này';
    reportPersistence(result);
  } catch (error) {
    pendingNote = draft;
    $('noteStatus').textContent = 'Chưa lưu được';
    toast(error.message || 'Hãy giữ lại nội dung ghi chú trước khi đóng.',6000);
  }
}
function blockHTML(block) {
  if (block.type === 'table') return renderTable(block.rows,block.caption);
  if (block.type === 'list') return '<ul>' + (block.items || []).map((item) => '<li>' + escapeHTML(typeof item === 'string' ? item : item.text) + '</li>').join('') + '</ul>';
  return block.text ? '<p>' + escapeHTML(block.text) + '</p>' : '';
}
function ownContent(entry) { return (entry.blocks || []).map(blockHTML).join(''); }
function childLinks(entry) {
  const children = (entry.children || []).map((id) => entriesById.get(id)).filter(Boolean);
  return children.length ? '<section class="child-sections"><h2>Các tiểu mục</h2><ul>' + children.map((child) => '<li><a href="' + entryURL(child.id) + '"><span class="child-number">' + escapeHTML(child.number) + '</span>' + escapeHTML(titleOf(child.title)) + '</a></li>').join('') + '</ul></section>' : '';
}
function openDetail(entry, readWhole = false) {
  if (currentEntryId !== entry.id) flushNote();
  if (pendingNote) return false;
  currentEntryId = entry.id;
  currentArticleId = entry.articleId;
  fullArticle = readWhole;
  const article = articlesById.get(entry.articleId), part = partsById.get(entry.partId);
  const parent = entriesById.get(entry.parentId);
  const root = entriesById.get(article?.rootEntryId) || entry;
  const articleEntries = (article?.entryIds || [entry.id]).map((id) => entriesById.get(id)).filter(Boolean);
  const breadcrumb = '<a href="' + buildSearchHash({partId:entry.partId,sort:'book'}) + '">' + escapeHTML(part?.label || 'Nội dung sách') + '</a><span class="breadcrumb-separator">/</span><a href="' + articleURL(entry.articleId) + '">Mục ' + escapeHTML(article?.number || entry.number) + '</a>' + (parent && parent.id !== root.id && !readWhole ? '<span class="breadcrumb-separator">/</span><a href="' + entryURL(parent.id) + '">Tiểu mục ' + escapeHTML(parent.number) + '</a>' : '');
  const content = readWhole ? articleEntries.map((item) => '<section class="reading-section depth-' + Math.min(4,item.level || 1) + (item.id === entry.id && item.id !== root.id ? ' targeted' : '') + '" id="read-' + escapeHTML(item.id) + '" tabindex="-1">' + (item.id !== root.id ? '<h2><a class="section-title-link" href="' + entryURL(item.id) + '">' + escapeHTML(item.number + '. ' + titleOf(item.title)) + '</a></h2>' : '') + ownContent(item) + '</section>').join('') : ownContent(entry);
  $('detailContent').innerHTML = '<nav class="detail-breadcrumb" aria-label="Vị trí trong sách">' + breadcrumb + '</nav><h1 id="detailTitle">' + escapeHTML((readWhole ? article.number : entry.number) + '. ' + titleOf(readWhole ? article.title : entry.title)) + '</h1>' +
    '<div class="source-reference"><span>' + icon('book') + 'Nội dung theo sách</span><span>' + escapeHTML(part?.label || '') + '</span>' + (article?.printedPage ? '<span>Mục chính bắt đầu ở trang ' + escapeHTML(article.printedPage) + ' (theo mục lục)</span>' : '') + '</div>' +
    '<div class="context-actions">' + (!readWhole ? '<a class="button" href="' + articleURL(entry.articleId,entry.id) + '">' + icon('book') + 'Đọc trọn mục chính</a>' : '<a class="button" href="' + entryURL(entry.id) + '">Xem riêng mục ' + escapeHTML(entry.number) + '</a>') + (parent && !readWhole ? '<a class="button" href="' + entryURL(parent.id) + '">Mục cha ' + escapeHTML(parent.number) + '</a>' : '') + '</div>' +
    (readWhole ? '<div class="full-reading-label">Đang đọc trọn mục ' + escapeHTML(article.number) + ' cùng ' + Math.max(0,articleEntries.length-1) + ' tiểu mục.</div>' : '') + '<div class="reading-body">' + (content || '<p class="empty-parent">Chọn tiểu mục bên dưới hoặc mở trọn mục chính để đọc.</p>') + '</div>' + (!readWhole ? childLinks(entry) : '');
  $('entryNote').value = userStore.state.notes[entry.id] || '';
  $('noteStatus').textContent = $('entryNote').value ? (userStore.persistent ? 'Đã lưu trên thiết bị' : 'Tạm lưu trong phiên này') : '';
  $('noteContext').textContent = 'Gắn với mục ' + entry.number + ': ' + titleOf(entry.title);
  const sequence = readWhole ? book.articles : book.entries;
  const position = sequence.findIndex((item) => item.id === (readWhole ? article.id : entry.id));
  $('previousEntry').disabled = position <= 0;
  $('nextEntry').disabled = position >= sequence.length-1;
  $('previousEntry').textContent = readWhole ? 'Mục chính trước' : 'Mục trước';
  $('nextEntry').textContent = readWhole ? 'Mục chính tiếp' : 'Mục tiếp';
  if (!$('entryDialog').open) $('entryDialog').showModal();
  $('entryDialog').scrollTop = 0;
  document.body.style.overflow = 'hidden';
  document.title = titleOf(readWhole ? article.title : entry.title) + ' · Giấc ngủ';
  safeUserAction(() => userStore.addRecent(entry.id));
  refreshSaveButtons();
  if (readWhole && entry.id !== root.id) requestAnimationFrame(() => { $('read-' + entry.id)?.scrollIntoView({block:'start',behavior:'instant'}); });
  return true;
}
function closeDetail() {
  flushNote();
  if (pendingNote) return;
  if (canCloseWithBack) history.back();
  else location.replace(lastBaseHash || '#/search');
}
function route() {
  if (!book) return;
  clearTimeout(searchTimer);
  flushNote();
  if (pendingNote) { history.replaceState(null,'',previousHash || entryURL(currentEntryId));canCloseWithBack = false;return; }
  const hash = location.hash || '#/search';
  const [path,qs=''] = hash.replace(/^#\/?/,'').split('?');
  const params = new URLSearchParams(qs), segments = path.split('/');
  if (['entry','article'].includes(segments[0])) {
    let id;
    try { id = decodeURIComponent(segments[1] || ''); } catch { id = ''; }
    const article = segments[0] === 'article' ? articlesById.get(id) : null;
    const requested = article && params.get('at') ? entriesById.get(params.get('at')) : null;
    const entry = article ? (requested?.articleId === article.id ? requested : entriesById.get(article.rootEntryId)) : entriesById.get(id);
    if (!entry) { toast('Không tìm thấy mục này trong sách.');location.replace('#/search');return; }
    if (!previousHash) { showView('search');canCloseWithBack = false; }
    else if (!/^#\/(entry|article)\//.test(previousHash)) { lastBaseHash = previousHash;canCloseWithBack = true; }
    else canCloseWithBack = false;
    openDetail(entry,!!article);
  } else {
    const wasDetail = !!currentEntryId;
    currentEntryId = currentArticleId = null;
    if ($('entryDialog').open) $('entryDialog').close();
    document.body.style.overflow = '';
    document.body.appendChild($('toast'));
    const view = ['search','contents','saved','settings'].includes(segments[0]) ? segments[0] : 'search';
    if (view === 'search') searchState = {query:(params.get('q') || '').slice(0,180),partId:partsById.has(params.get('phan')) ? params.get('phan') : '',articleId:params.get('muc') || '',mode:params.get('tim') === 'title' ? 'title' : 'all',sort:params.get('sapxep') === 'book' ? 'book' : 'relevance'};
    showView(view);
    lastBaseHash = hash;
    canCloseWithBack = false;
    if (!wasDetail) window.scrollTo({top:0,behavior:'instant'});
  }
  previousHash = hash;
}
function setSearch(update) { Object.assign(searchState,update);$('searchInput').value = searchState.query;renderSearch();rememberSearchURL(); }

function showInstallHelp() {
  const standalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  $('installHelp').innerHTML = window.SLEEP_EMBEDDED_BOOK ? '<p>Bạn đang dùng bản tra cứu trực tiếp từ tệp. Để cài biểu tượng trên điện thoại, hãy mở đường dẫn web của ứng dụng sau khi đưa gói lên Vercel.</p><p>Bản tệp vẫn dùng được để đọc và tìm kiếm mà không cần mạng.</p>' : standalone ? '<p>Ứng dụng đang mở từ màn hình chính. Bạn có thể mở lại biểu tượng này để tra cứu nhanh.</p>' : ios ? '<p>Mở đường dẫn bằng <strong>Safari</strong>, chạm <strong>Chia sẻ</strong>, chọn <strong>Thêm vào Màn hình chính</strong> rồi <strong>Thêm</strong>.</p><p>Nếu có lựa chọn “Mở dưới dạng ứng dụng web”, hãy bật lựa chọn đó.</p>' : '<p>Trong <strong>Chrome</strong>, mở menu <strong>⋮</strong>, chọn <strong>Cài đặt và tạo lối tắt</strong> rồi <strong>Cài đặt</strong>. Tên mục có thể là “Cài ứng dụng” hoặc “Thêm vào màn hình chính”.</p><p>Nếu đang mở trong ứng dụng nhắn tin, hãy mở đường dẫn bằng Chrome trước.</p>';
  $('installDialog').showModal();
}
async function installApp() {
  if (!deferredInstall) { showInstallHelp();return; }
  try { await deferredInstall.prompt();const result = await deferredInstall.userChoice;deferredInstall = null;$('installTop').hidden = true;if (result.outcome === 'accepted') toast('Đã gửi yêu cầu cài ứng dụng.'); } catch { showInstallHelp(); }
}
function updateNetworkUI() {
  const badge = $('networkBadge');
  if (window.SLEEP_EMBEDDED_BOOK) {
    badge.textContent = 'Bản đọc ngoại tuyến';badge.classList.add('ready');
    $('offlineStatus').textContent = 'Nội dung đã có sẵn trong tệp này. Bạn có thể đọc và tìm kiếm khi không có mạng.';
    $('sourceCacheStatus').textContent = 'Tệp Word nguồn được nhúng sẵn trong bản này. Dùng nút Tải tệp Word nguồn để lưu ra thiết bị.';
    $('cacheSource').disabled = true;$('checkUpdate').disabled = true;return;
  }
  badge.classList.toggle('ready',offlineReady && navigator.onLine);
  badge.classList.toggle('offline',!navigator.onLine);
  badge.textContent = !navigator.onLine ? (offlineReady ? 'Đang dùng ngoại tuyến' : 'Không có mạng') : offlineReady ? 'Sẵn sàng ngoại tuyến' : book ? 'Sách đã mở' : 'Đang mở sách';
  $('offlineStatus').textContent = offlineError || (offlineReady ? 'Nội dung sách đã lưu xong trên thiết bị. Bạn có thể tìm kiếm và đọc khi không có mạng.' : 'serviceWorker' in navigator ? 'Chờ tải hoàn tất ở lần mở đầu để dùng ngoại tuyến.' : 'Trình duyệt này chưa hỗ trợ lưu ngoại tuyến.');
  $('sourceCacheStatus').textContent = sourceDocxCached ? 'Tệp Word nguồn cũng đã có bản lưu ngoại tuyến.' : 'Bạn có thể lưu tệp Word nguồn để đối chiếu khi cần.';
  $('cacheSource').textContent = sourceDocxCached ? 'Làm mới tệp Word nguồn' : 'Lưu tệp Word nguồn';
}
async function workerMessage(message,timeoutMs = 10000) {
  const worker = navigator.serviceWorker?.controller || serviceWorkerRegistration?.active;
  if (!worker) return null;
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timeout = setTimeout(() => { channel.port1.close();resolve(null); },timeoutMs);
    channel.port1.onmessage = (event) => { clearTimeout(timeout);channel.port1.close();resolve(event.data); };
    worker.postMessage(message,[channel.port2]);
  });
}
async function refreshOfflineStatus() {
  if (window.SLEEP_EMBEDDED_BOOK || !('serviceWorker' in navigator)) { updateNetworkUI();return; }
  try {
    const status = await workerMessage({type:'GET_CACHE_STATUS'},2500);
    if (status?.type === 'CACHE_STATUS') { offlineReady = !!status.offlineReady;sourceDocxCached = !!status.sourceDocxCached;if (offlineReady) offlineError = ''; }
  } catch { /* Worker might be updating. */ }
  updateNetworkUI();
}
function updateAvailable() { if (serviceWorkerRegistration?.waiting) $('updateBar').hidden = false; }
async function setupOffline() {
  if (window.SLEEP_EMBEDDED_BOOK || location.protocol === 'file:' || !('serviceWorker' in navigator) || !window.isSecureContext) { updateNetworkUI();return; }
  if (serviceWorkerRegistration) { await refreshOfflineStatus();return; }
  try {
    serviceWorkerRegistration = await navigator.serviceWorker.register('/sw.js',{scope:'/'});
    updateAvailable();
    serviceWorkerRegistration.addEventListener('updatefound',() => { const worker = serviceWorkerRegistration.installing;worker?.addEventListener('statechange',() => { if (worker.state === 'installed') { if (navigator.serviceWorker.controller) updateAvailable();refreshOfflineStatus(); } }); });
    navigator.serviceWorker.addEventListener('controllerchange',() => { if (reloadForUpdate) { reloadForUpdate = false;location.reload(); } else refreshOfflineStatus(); });
    navigator.serviceWorker.addEventListener('message',(event) => { if (event.data?.type === 'CACHE_READY') refreshOfflineStatus(); });
    await navigator.serviceWorker.ready;
    await refreshOfflineStatus();
  } catch { offlineError = 'Chưa lưu được chế độ ngoại tuyến. Giữ kết nối và mở lại ứng dụng để thử lại.';updateNetworkUI(); }
}
async function cacheSource() {
  if (!navigator.onLine) { toast('Cần có mạng để làm mới tệp Word nguồn.');return; }
  $('cacheSource').disabled = true;$('cacheSource').textContent = 'Đang lưu tệp Word…';
  try {
    const result = await workerMessage({type:'CACHE_SOURCE'},30000);
    if (!result?.success) throw new Error(result?.error || 'Chờ ứng dụng sẵn sàng ngoại tuyến, sau đó thử lại.');
    await refreshOfflineStatus();toast('Đã lưu tệp Word nguồn để đối chiếu ngoại tuyến.');
  } catch (error) { toast(error.message || 'Chưa lưu được tệp Word.'); }
  finally { $('cacheSource').disabled = false;updateNetworkUI(); }
}
async function shareEntry() {
  const entry = entriesById.get(currentEntryId);
  if (!entry) return;
  const title = titleOf(entry.title) + ' · Giấc ngủ';
  try {
    if (location.protocol === 'file:') {
      const text = title + ' — ' + sourceLabel(entry);
      if (navigator.share) await navigator.share({title,text});else { await navigator.clipboard.writeText(text);toast('Đã sao chép tên mục và vị trí trong sách.'); }
    } else {
      const url = location.origin + location.pathname + entryURL(entry.id);
      if (navigator.share) await navigator.share({title,url});else { await navigator.clipboard.writeText(url);toast('Đã sao chép liên kết mục.'); }
    }
  } catch (error) { if (error.name !== 'AbortError') toast('Bạn có thể sao chép liên kết đang hiển thị trên thanh địa chỉ.',5000); }
}
function downloadBackup() {
  flushNote();if (pendingNote) return;
  safeUserAction(() => {
    const url = URL.createObjectURL(new Blob([userStore.exportBackup()],{type:'application/json;charset=utf-8'}));
    const a = document.createElement('a');a.href = url;
    const now = new Date(), date = now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
    a.download = 'Giac_Ngu_Sao_Luu_' + date + '.json';document.body.appendChild(a);a.click();a.remove();setTimeout(() => URL.revokeObjectURL(url),30000);toast('Đã tạo tệp sao lưu dấu trang và ghi chú.');
  });
}
async function importBackup(file) {
  if (!file) return;
  if (file.size > 1024*1024) { toast('Tệp sao lưu lớn hơn 1 MB. Hãy chọn bản sao do ứng dụng xuất.');return; }
  try {
    const result = userStore.importBackup(await file.text());refreshSaveButtons();applyPreferences();if (activeView === 'saved') renderSaved();
    toast('Đã gộp bản sao: thêm ' + result.favoritesAdded + ' dấu trang, ' + result.notesAdded + ' ghi chú; gộp ' + result.notesMerged + ' ghi chú đang có.',6000);reportPersistence(result);
  } catch (error) { toast(error.message || 'Tệp không phải bản sao lưu phù hợp.',6000); }
}
function bindEvents() {
  if (eventsBound) return;eventsBound = true;
  document.querySelector('.skip-link').addEventListener('click',(event) => { event.preventDefault();$('main').focus();$('main').scrollIntoView({block:'start'}); });
  $('searchInput').addEventListener('input',(event) => { clearTimeout(searchTimer);searchState.query = event.target.value;$('clearSearch').hidden = !searchState.query;searchTimer = setTimeout(() => { renderSearch();rememberSearchURL(); },130); });
  $('searchForm').addEventListener('submit',(event) => { event.preventDefault();clearTimeout(searchTimer);renderSearch();rememberSearchURL();$('searchInput').blur(); });
  $('clearSearch').addEventListener('click',() => { setSearch({query:''});$('searchInput').focus(); });
  $('partFilter').addEventListener('change',(event) => setSearch({partId:event.target.value,articleId:''}));
  $('articleFilter').addEventListener('change',(event) => setSearch({articleId:event.target.value}));
  $('sortFilter').addEventListener('change',(event) => setSearch({sort:event.target.value}));
  $('resetFilters').addEventListener('click',() => setSearch({query:'',partId:'',articleId:'',mode:'all',sort:'relevance'}));
  $('loadMore').addEventListener('click',() => { resultLimit += PAGE_SIZE;renderSearch(false); });
  document.addEventListener('click',(event) => {
    const button = event.target.closest('button');if (!button || !userStore) return;
    if (button.dataset.save) { event.preventDefault();const result = safeUserAction(() => userStore.toggleFavorite(button.dataset.save));if (result) { refreshSaveButtons();if (activeView === 'saved' && savedTab === 'favorites') renderSaved();toast(result.saved ? 'Đã thêm vào mục Đã lưu.' : 'Đã bỏ đánh dấu.');reportPersistence(result); } }
    if (button.dataset.mode) setSearch({mode:button.dataset.mode});
    if (button.dataset.query) setSearch({query:button.dataset.query,mode:'all'});
    if (button.dataset.savedTab) { savedTab = button.dataset.savedTab;renderSaved(); }
  });
  $('closeDetail').addEventListener('click',closeDetail);
  $('entryDialog').addEventListener('cancel',(event) => { event.preventDefault();closeDetail(); });
  $('entryDialog').addEventListener('click',(event) => { if (event.target !== $('entryDialog')) return;const box = $('entryDialog').getBoundingClientRect();if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) closeDetail(); });
  $('detailSave').addEventListener('click',() => { if (!currentEntryId) return;const result = safeUserAction(() => userStore.toggleFavorite(currentEntryId));if (result) { refreshSaveButtons();toast(result.saved ? 'Đã thêm vào mục Đã lưu.' : 'Đã bỏ đánh dấu.');reportPersistence(result); } });
  $('detailShare').addEventListener('click',shareEntry);
  $('detailPrint').addEventListener('click',() => window.print());
  $('entryNote').addEventListener('input',(event) => { pendingNote = {id:currentEntryId,text:event.target.value};$('noteStatus').textContent = 'Đang lưu…';clearTimeout(noteTimer);noteTimer = setTimeout(flushNote,450); });
  for (const [id,direction] of [['previousEntry',-1],['nextEntry',1]]) $(id).addEventListener('click',() => { flushNote();if (pendingNote) return;const list = fullArticle ? book.articles : book.entries;const position = list.findIndex((item) => item.id === (fullArticle ? currentArticleId : currentEntryId));const next = list[position+direction];if (next) location.replace(fullArticle ? articleURL(next.id) : entryURL(next.id)); });
  $('themeSelect').addEventListener('change',(event) => { reportPersistence(safeUserAction(() => userStore.setSetting('theme',event.target.value)));applyPreferences(); });
  for (const [id,amount] of [['fontSmaller',-1],['fontLarger',1]]) $(id).addEventListener('click',() => { const size = Math.min(26,Math.max(16,userStore.state.settings.fontSize+amount));reportPersistence(safeUserAction(() => userStore.setSetting('fontSize',size)));applyPreferences(); });
  systemTheme.addEventListener?.('change',applyPreferences);
  $('installTop').addEventListener('click',installApp);$('installSettings').addEventListener('click',installApp);
  $('closeInstall').addEventListener('click',() => $('installDialog').close());$('installDone').addEventListener('click',() => $('installDialog').close());
  $('exportBackup').addEventListener('click',downloadBackup);$('importBackup').addEventListener('click',() => $('backupFile').click());
  $('backupFile').addEventListener('change',async (event) => { await importBackup(event.target.files[0]);event.target.value = ''; });
  $('cacheSource').addEventListener('click',cacheSource);
  $('checkUpdate').addEventListener('click',async () => { if (!navigator.onLine) { toast('Cần có mạng để kiểm tra bản cập nhật.');return; }if (!serviceWorkerRegistration) await setupOffline();if (!serviceWorkerRegistration) { toast('Chưa bật được chế độ cập nhật ngoại tuyến.');return; }try { await serviceWorkerRegistration.update();updateAvailable();await refreshOfflineStatus();toast(serviceWorkerRegistration.waiting ? 'Có bản cập nhật mới.' : 'Đã kiểm tra. Khi có bản mới, ứng dụng sẽ hiện nút Cập nhật.'); } catch { toast('Chưa kiểm tra được phiên bản mới.'); } });
  $('applyUpdate').addEventListener('click',() => { flushNote();if (pendingNote) return;if (serviceWorkerRegistration?.waiting) { reloadForUpdate = true;$('applyUpdate').disabled = true;$('applyUpdate').textContent = 'Đang cập nhật…';serviceWorkerRegistration.waiting.postMessage({type:'SKIP_WAITING'}); } });
  $('dismissUpdate').addEventListener('click',() => { $('updateBar').hidden = true; });
  window.addEventListener('hashchange',route);window.addEventListener('online',refreshOfflineStatus);window.addEventListener('offline',updateNetworkUI);window.addEventListener('pagehide',flushNote);
  document.addEventListener('visibilitychange',() => { if (document.visibilityState === 'hidden') flushNote(); });
}
async function loadBook() {
  if (dataLoading) return;dataLoading = true;$('loadError').hidden = true;$('loading').hidden = false;
  try {
    let data = window.SLEEP_EMBEDDED_BOOK;
    if (!data) { const response = await fetch('/data/book.json');if (!response.ok) throw new Error('Không tải được nội dung sách (mã ' + response.status + ').');data = await response.json(); }
    if (!Array.isArray(data.entries) || !data.entries.length || !Array.isArray(data.parts) || !Array.isArray(data.articles)) throw new Error('Dữ liệu sách chưa đúng định dạng.');
    book = data;book.meta ||= {};
    entriesById = new Map(book.entries.map((item) => [item.id,item]));articlesById = new Map(book.articles.map((item) => [item.id,item]));partsById = new Map(book.parts.map((item) => [item.id,item]));
    searchIndex = createSearchIndex(book);userStore = createUserStore(new Set(entriesById.keys()));applyPreferences();
    $('bookStats').innerHTML = '<span><strong>' + book.parts.length + '</strong> phần</span><span><strong>' + book.articles.length + '</strong> mục chính</span><span><strong>' + book.entries.length + '</strong> mục tra cứu</span>';
    $('partFilter').innerHTML = '<option value="">Tất cả phần</option>' + book.parts.map((part) => '<option value="' + escapeHTML(part.id) + '">' + escapeHTML(part.label + ': ' + titleOf(part.title)) + '</option>').join('');
    $('sourceLink').href = sourceURL();
    document.querySelectorAll('a[href="/source/Giac_Ngu_Nguon.docx"]').forEach((link) => { link.href = sourceURL(); });
    const notes = (book.meta.sourceNotes || []).map((note) => typeof note === 'string' ? note : note.text || '').filter(Boolean);
    $('bookSourceNotes').hidden = !notes.length;
    $('bookSourceNotes').innerHTML = '<strong>Biên tập để tra cứu</strong>' + notes.map((note) => '<p>' + escapeHTML(note) + '</p>').join('');
    const appendix = book.meta.sourceAppendix;
    if (appendix?.publication?.rows?.length && !$('publicationAppendix')) $('bookSourceNotes').insertAdjacentHTML('afterend','<details class="source-appendix" id="publicationAppendix"><summary>Thông tin xuất bản theo tài liệu</summary>' + renderTable(appendix.publication.rows) + '</details>');
    $('versionInfo').textContent = 'Ứng dụng 1.0 · Theo sách xuất bản ' + (book.meta.publicationYear || 2013) + ' · ' + (book.meta.version || '1.0');
    bindEvents();$('loading').hidden = true;
    if (!location.hash) history.replaceState(null,'','#/search');route();refreshSaveButtons();updateNetworkUI();
    if (userStore.error) toast(userStore.error,8000);
    setupOffline();
  } catch (error) { $('loading').hidden = true;$('loadError').hidden = false;$('loadErrorMessage').textContent = error.message || 'Hãy kiểm tra kết nối rồi thử lại.';$('networkBadge').textContent = 'Chưa mở được sách'; }
  finally { dataLoading = false; }
}
window.addEventListener('beforeinstallprompt',(event) => { event.preventDefault();deferredInstall = event;$('installTop').hidden = false; });
window.addEventListener('appinstalled',() => { deferredInstall = null;$('installTop').hidden = true;toast('Ứng dụng đã được thêm vào thiết bị.'); });
$('retryLoad').addEventListener('click',loadBook);
loadBook();
