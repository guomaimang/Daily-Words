// 数据来源：https://github.com/tyypgzl/Oxford-5000-words （本地副本）
const DATA_URL = 'full-word.json';

// 简单的线性同余生成器，用于生成确定性随机数
class SeededRandom {
    constructor(seed) {
        this.seed = seed % 2147483647;
        if (this.seed <= 0) this.seed += 2147483646;
    }
    next() {
        this.seed = (this.seed * 16807) % 2147483647;
        return (this.seed - 1) / 2147483646;
    }
}

// 根据日期字符串生成种子
function dateToSeed(dateString) {
    let hash = 0;
    for (let i = 0; i < dateString.length; i++) {
        const char = dateString.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text == null ? '' : String(text);
    return div.innerHTML;
}
function escapeHtmlAttr(text) {
    return String(text == null ? '' : text)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

// 把 JSON 原始 entry 规整化
function normalizeEntry(rawEntry) {
    if (!rawEntry || !rawEntry.value || !rawEntry.value.word) return null;
    const v = rawEntry.value;
    const word = String(v.word).trim();
    if (!word) return null;
    const level = (v.level && String(v.level).trim()) || '';
    const examples = Array.isArray(v.examples)
        ? v.examples.filter(e => typeof e === 'string' && e.trim())
        : [];

    return {
        id: rawEntry.id != null ? String(rawEntry.id) : '',
        word,
        href: typeof v.href === 'string' ? v.href : '',
        type: typeof v.type === 'string' ? v.type.trim() : '',
        level,
        phonetics: {
            us: (v.phonetics && typeof v.phonetics.us === 'string') ? v.phonetics.us.trim() : '',
            uk: (v.phonetics && typeof v.phonetics.uk === 'string') ? v.phonetics.uk.trim() : ''
        },
        examples
    };
}

// 基于种子的随机选择函数
function getRandomEntriesWithSeed(entries, count, seed) {
    const rng = new SeededRandom(seed);
    if (!entries.length) return [];

    const indices = Array.from({ length: entries.length }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    // 同一个词可能因不同词性出现多次，按 (word + type) 去重以保留词性差异
    const result = [];
    const seenKeys = new Set();
    for (let i = 0; i < indices.length && result.length < count; i++) {
        const item = entries[indices[i]];
        const key = item.word.toLowerCase() + '|' + item.type.toLowerCase();
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            result.push(item);
        }
    }
    return result;
}

// ---------- 数据加载 ----------
let allEntries = []; // 规整化后的全量数据
async function ensureDataLoaded() {
    if (allEntries.length) return allEntries;

    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error('Network response error: ' + res.status);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('Unexpected data format: not an array');

    const normalized = [];
    for (const item of json) {
        const n = normalizeEntry(item);
        if (n) normalized.push(n);
    }
    allEntries = normalized;
    return allEntries;
}

// ---------- 当前展示状态 ----------
let currentWords = [];
let currentFocusIndex = 0;
let currentSelectedDate = '';
let currentSeed = 0;

function getFocusMode() {
    return document.querySelector('input[name="focusMode"]:checked')?.value || 'off';
}
function getAccent() {
    return document.querySelector('input[name="accent"]:checked')?.value || 'us';
}

// ---------- 聚焦进度持久化（按目录维度独立） ----------
function getFocusProgressKey() {
    let dir = '/';
    try {
        const path = (window.location && window.location.pathname) || '';
        dir = path.replace(/[^/]*$/, '') || '/';
    } catch (e) { dir = '/'; }
    return `daily-words:focusProgress:${dir}`;
}
function loadFocusProgress(dateString, wordCount) {
    try {
        if (!window.localStorage) return 0;
        const raw = localStorage.getItem(getFocusProgressKey());
        if (!raw) return 0;
        const data = JSON.parse(raw);
        if (!data || data.date !== dateString) return 0;
        const idx = Number(data.index);
        if (!Number.isFinite(idx) || idx < 0) return 0;
        if (wordCount > 0 && idx >= wordCount) return 0;
        return idx;
    } catch (e) {
        return 0;
    }
}
function saveFocusProgress(dateString, index) {
    try {
        if (!window.localStorage || !dateString) return;
        localStorage.setItem(getFocusProgressKey(), JSON.stringify({ date: dateString, index }));
    } catch (e) { /* ignore */ }
}

// ---------- 渲染 ----------
function renderLevelBadge(level) {
    if (!level) return '';
    const safe = escapeHtml(level);
    const cls = `level-${escapeHtmlAttr(level).replace(/[^A-Za-z0-9]/g, '')}`;
    return `<span class="level-badge ${cls}">${safe}</span>`;
}

function createWordGrid(wordList, selectedDate, seed) {
    const cards = wordList.map((item, index) => {
        const accent = getAccent();
        const phon = (accent === 'uk' ? item.phonetics.uk : item.phonetics.us) || item.phonetics.us || item.phonetics.uk || '';
        return `
            <div class="word-card" data-index="${index}">
                ${renderLevelBadge(item.level)}
                <button class="speaker-icon" data-index="${index}" title="Read word">🔊</button>
                <button class="search-icon" data-index="${index}" title="Search on Google">🔍</button>
                <button class="youglish-icon" data-index="${index}" title="Hear on YouGlish">🎬</button>
                <div class="word-text">${escapeHtml(item.word)}</div>
                ${item.type ? `<div class="word-pos">${escapeHtml(item.type)}</div>` : ''}
                ${phon ? `<div class="word-phonetic">${escapeHtml(phon)}</div>` : ''}
                <div class="word-id">${escapeHtml(item.id)}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="word-container">
            <div class="info-header">
                <strong>Date:</strong> ${escapeHtml(selectedDate)} &nbsp;&nbsp;
                <strong>Seed:</strong> ${seed} &nbsp;&nbsp;
                <strong>Words:</strong> ${wordList.length} &nbsp;&nbsp;
                <strong>Accent:</strong> ${getAccent().toUpperCase()}
            </div>
            <div class="word-grid">${cards}</div>
        </div>
    `;
}

function createFocusView(wordList, selectedDate, seed) {
    return `
        <div class="word-container">
            <div class="info-header">
                <strong>Date:</strong> ${escapeHtml(selectedDate)} &nbsp;&nbsp;
                <strong>Seed:</strong> ${seed} &nbsp;&nbsp;
                <strong>Words:</strong> ${wordList.length} &nbsp;&nbsp;
                <strong>Mode:</strong> Focus
            </div>
            <div class="focus-view">
                <div class="focus-counter" id="focusCounter"></div>
                <div class="focus-meta" id="focusMeta"></div>
                <div class="focus-word" id="focusWord"></div>
                <div class="focus-phonetics" id="focusPhonetics"></div>
                <div class="focus-actions">
                    <button class="focus-action-btn us" id="focusUsBtn" title="Play US pronunciation">🇺🇸 US</button>
                    <button class="focus-action-btn uk" id="focusUkBtn" title="Play UK pronunciation">🇬🇧 UK</button>
                    <button class="focus-action-btn info" id="focusInfoBtn" title="Show details">ⓘ</button>
                    <button class="focus-action-btn search" id="focusSearchBtn" title="Search on Google">🔍</button>
                    <button class="focus-action-btn picture" id="focusPictureBtn" title="Search images on Google">🖼️</button>
                    <button class="focus-action-btn youglish" id="focusYouglishBtn" title="Hear on YouGlish">🎬</button>
                </div>
            </div>
        </div>
        <button class="focus-arrow left" id="focusPrevBtn" title="Previous word (←)">‹</button>
        <button class="focus-arrow right" id="focusNextBtn" title="Next word (→)">›</button>
    `;
}

function renderFocusWord() {
    if (!currentWords.length) return;
    if (currentFocusIndex < 0 || currentFocusIndex >= currentWords.length) {
        currentFocusIndex = 0;
    }
    const item = currentWords[currentFocusIndex];
    const wordEl = document.getElementById('focusWord');
    const counterEl = document.getElementById('focusCounter');
    const metaEl = document.getElementById('focusMeta');
    const phEl = document.getElementById('focusPhonetics');

    if (wordEl) wordEl.textContent = item.word;
    if (counterEl) counterEl.textContent = `${currentFocusIndex + 1} / ${currentWords.length}  ·  #${item.id}`;
    if (metaEl) {
        metaEl.innerHTML = `
            ${renderLevelBadge(item.level)}
            ${item.type ? `<span class="pos">${escapeHtml(item.type)}</span>` : ''}
        `;
    }
    if (phEl) {
        const parts = [];
        if (item.phonetics.us) parts.push(`<span class="ph-item"><span class="ph-flag">US</span>${escapeHtml(item.phonetics.us)}</span>`);
        if (item.phonetics.uk) parts.push(`<span class="ph-item"><span class="ph-flag">UK</span>${escapeHtml(item.phonetics.uk)}</span>`);
        phEl.innerHTML = parts.join('');
    }

    window.currentItem = item;
    saveFocusProgress(currentSelectedDate, currentFocusIndex);
}

function focusNext() {
    if (!currentWords.length) return;
    currentFocusIndex = (currentFocusIndex + 1) % currentWords.length;
    renderFocusWord();
}
function focusPrev() {
    if (!currentWords.length) return;
    currentFocusIndex = (currentFocusIndex - 1 + currentWords.length) % currentWords.length;
    renderFocusWord();
}

function setupFocusHandlers() {
    const usBtn = document.getElementById('focusUsBtn');
    const ukBtn = document.getElementById('focusUkBtn');
    const infoBtn = document.getElementById('focusInfoBtn');
    const searchBtn = document.getElementById('focusSearchBtn');
    const pictureBtn = document.getElementById('focusPictureBtn');
    const youglishBtn = document.getElementById('focusYouglishBtn');
    const prevBtn = document.getElementById('focusPrevBtn');
    const nextBtn = document.getElementById('focusNextBtn');
    const focusWordEl = document.getElementById('focusWord');

    if (usBtn) usBtn.addEventListener('click', () => playWordAudio(currentWords[currentFocusIndex], 'us'));
    if (ukBtn) ukBtn.addEventListener('click', () => playWordAudio(currentWords[currentFocusIndex], 'uk'));
    if (infoBtn) infoBtn.addEventListener('click', () => showWordModal(currentWords[currentFocusIndex]));
    if (searchBtn) searchBtn.addEventListener('click', () => {
        const item = currentWords[currentFocusIndex];
        if (item) openGoogleMeaning(item.word);
    });
    if (pictureBtn) pictureBtn.addEventListener('click', () => {
        const item = currentWords[currentFocusIndex];
        if (item) openGooglePicture(item.word);
    });
    if (youglishBtn) youglishBtn.addEventListener('click', () => {
        const item = currentWords[currentFocusIndex];
        if (item) openYouglish(item.word);
    });
    if (prevBtn) prevBtn.addEventListener('click', focusPrev);
    if (nextBtn) nextBtn.addEventListener('click', focusNext);

    // 点击单词朗读（按当前 Accent）
    if (focusWordEl) {
        focusWordEl.addEventListener('click', () => {
            playWordAudio(currentWords[currentFocusIndex], getAccent());
        });
    }
}

function handleFocusKeydown(event) {
    if (getFocusMode() !== 'on') return;
    const modal = document.getElementById('translationModal');
    if (modal && modal.style.display === 'block') return;
    const target = event.target;
    const tag = (target && target.tagName ? target.tagName : '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || (target && target.isContentEditable)) return;

    if (event.key === 'ArrowLeft') {
        event.preventDefault();
        focusPrev();
    } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        focusNext();
    } else if (event.key === ' ' || event.code === 'Space') {
        event.preventDefault();
        playWordAudio(currentWords[currentFocusIndex], getAccent());
    }
}

function renderCurrentMode() {
    const output = document.getElementById('output');
    if (!output || !currentWords.length) return;

    if (getFocusMode() === 'on') {
        if (currentFocusIndex >= currentWords.length) currentFocusIndex = 0;
        output.innerHTML = createFocusView(currentWords, currentSelectedDate, currentSeed);
        output.className = '';
        setupFocusHandlers();
        renderFocusWord();
    } else {
        output.innerHTML = createWordGrid(currentWords, currentSelectedDate, currentSeed);
        output.className = '';
        setupWordCardClickHandlers();
    }
}

// ---------- 模态框（充分利用 metadata） ----------
function showWordModal(item) {
    if (!item) return;
    const modal = document.getElementById('translationModal');
    const title = document.getElementById('modalWordTitle');
    const meta = document.getElementById('modalMetaRow');
    const list = document.getElementById('modalExamplesList');
    const oxfordLink = document.getElementById('oxfordLinkBtn');
    const usBtn = document.getElementById('modalPronUsBtn');
    const ukBtn = document.getElementById('modalPronUkBtn');

    title.textContent = item.word;

    const metaParts = [];
    metaParts.push(renderLevelBadge(item.level));
    if (item.type) metaParts.push(`<span class="pos">${escapeHtml(item.type)}</span>`);
    if (item.phonetics.us) metaParts.push(`<span class="ph"><span class="flag">US</span>${escapeHtml(item.phonetics.us)}</span>`);
    if (item.phonetics.uk) metaParts.push(`<span class="ph"><span class="flag">UK</span>${escapeHtml(item.phonetics.uk)}</span>`);
    meta.innerHTML = metaParts.join('');

    if (item.examples.length) {
        list.style.display = '';
        list.innerHTML = item.examples
            .map(ex => `<li>${escapeHtml(ex)}</li>`)
            .join('');
    } else {
        list.style.display = '';
        list.innerHTML = `<li class="examples-empty" style="background:transparent;border-left:none;padding-left:0;">No example sentences available.</li>`;
    }

    if (item.href) {
        oxfordLink.href = item.href;
        oxfordLink.style.display = '';
    } else {
        oxfordLink.removeAttribute('href');
        oxfordLink.style.display = 'none';
    }

    // 仅当存在对应音频或可回退到 TTS 时启用按钮——TTS 始终可用，因此默认都启用
    usBtn.disabled = false;
    ukBtn.disabled = false;

    window.currentItem = item;

    modal.style.display = 'block';
    document.addEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(event) {
    if (event.key === 'Escape') closeModal();
}
function closeModal() {
    const modal = document.getElementById('translationModal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleModalKeydown);
    stopAudio();
}

// ---------- Google 搜索 ----------
function openGoogleMeaning(word) {
    if (!word) return;
    const query = `what "${word}" meaning in and example`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}
function openGooglePicture(word) {
    if (!word) return;
    const url = `https://www.google.com/search?q=${encodeURIComponent(word)}&udm=2`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// YouGlish：通过 YouTube 视频示例发音
// 形如：https://youglish.com/pronounce/get_out/english
function openYouglish(word) {
    if (!word) return;
    const slug = String(word).trim().toLowerCase().replace(/\s+/g, '_');
    const url = `https://youglish.com/pronounce/${encodeURIComponent(slug)}/english`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// ---------- 音频播放（仅使用浏览器内置语音合成 SpeechSynthesis） ----------
function stopAudio() {
    if (window.speechSynthesis) {
        try { window.speechSynthesis.cancel(); } catch (e) { /* ignore */ }
    }
}

function playWordAudio(item, accent) {
    if (!item) return;
    stopAudio();
    accent = accent === 'uk' ? 'uk' : 'us';
    // 不再请求网络上的英式/美式 mp3/ogg 音频，统一使用浏览器（Chrome/Firefox）内置发音
    speakWord(item.word, accent);
}

// ---------- TTS 兜底 ----------
const NOVELTY_VOICE_NAMES = new Set([
    'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
    'Deranged', 'Good News', 'Hysterical', 'Jester', 'Junior', 'Kathy',
    'Organ', 'Pipe Organ', 'Ralph', 'Superstar', 'Trinoids', 'Whisper',
    'Wobble', 'Zarvox', 'Eddy', 'Flo', 'Fred', 'Grandma', 'Grandpa',
    'Reed', 'Rocko', 'Sandy', 'Shelley'
]);
const PREFERRED_US_VOICES = [
    'Google US English',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Aria', 'Microsoft Jenny', 'Microsoft Zira', 'Microsoft David',
    'Samantha', 'Alex'
];
const PREFERRED_UK_VOICES = [
    'Google UK English Female', 'Google UK English Male',
    'Microsoft Sonia Online (Natural) - English (United Kingdom)',
    'Microsoft Ryan Online (Natural) - English (United Kingdom)',
    'Microsoft Hazel', 'Microsoft Susan', 'Daniel', 'Karen', 'Moira', 'Tessa'
];

function pickVoice(accent) {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (!voices.length) return null;

    const preferredList = accent === 'uk' ? PREFERRED_UK_VOICES : PREFERRED_US_VOICES;
    for (const name of preferredList) {
        const v = voices.find(v => v.name === name);
        if (v) return v;
    }
    const langPrefix = accent === 'uk' ? 'en-GB' : 'en-US';
    const englishVoices = voices.filter(v =>
        /^en(-|_)/i.test(v.lang) && !NOVELTY_VOICE_NAMES.has(v.name)
    );
    if (!englishVoices.length) return null;
    return (
        englishVoices.find(v => new RegExp('^' + langPrefix, 'i').test(v.lang) && v.localService) ||
        englishVoices.find(v => new RegExp('^' + langPrefix, 'i').test(v.lang)) ||
        englishVoices.find(v => v.default) ||
        englishVoices[0]
    );
}

if (typeof window !== 'undefined' && window.speechSynthesis) {
    window.speechSynthesis.getVoices();
    if (typeof window.speechSynthesis.onvoiceschanged !== 'undefined') {
        window.speechSynthesis.addEventListener('voiceschanged', () => {
            window.speechSynthesis.getVoices();
        });
    }
}

function speakWord(word, accent) {
    if (!word) return;
    if (!window.speechSynthesis) {
        console.warn('SpeechSynthesis is not supported in this browser.');
        return;
    }
    window.speechSynthesis.cancel();

    const doSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(word);
        const voice = pickVoice(accent);
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang || (accent === 'uk' ? 'en-GB' : 'en-US');
        } else {
            utterance.lang = accent === 'uk' ? 'en-GB' : 'en-US';
        }
        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;
        utterance.onerror = (e) => console.error('TTS error:', e.error);
        window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (!voices || !voices.length) {
        const onReady = () => {
            window.speechSynthesis.removeEventListener('voiceschanged', onReady);
            doSpeak();
        };
        window.speechSynthesis.addEventListener('voiceschanged', onReady);
        setTimeout(() => {
            window.speechSynthesis.removeEventListener('voiceschanged', onReady);
            doSpeak();
        }, 300);
        return;
    }
    doSpeak();
}

// ---------- 网格视图点击 ----------
function setupWordCardClickHandlers() {
    const wordGrid = document.querySelector('.word-grid');
    if (!wordGrid) return;
    wordGrid.removeEventListener('click', handleWordGridClick);
    wordGrid.addEventListener('click', handleWordGridClick);
}

function handleWordGridClick(event) {
    const speakerBtn = event.target.closest('.speaker-icon');
    if (speakerBtn) {
        event.stopPropagation();
        const idx = Number(speakerBtn.getAttribute('data-index'));
        const item = currentWords[idx];
        if (item) playWordAudio(item, getAccent());
        return;
    }
    const searchBtn = event.target.closest('.search-icon');
    if (searchBtn) {
        event.stopPropagation();
        const idx = Number(searchBtn.getAttribute('data-index'));
        const item = currentWords[idx];
        if (item) openGoogleMeaning(item.word);
        return;
    }
    const youglishBtn = event.target.closest('.youglish-icon');
    if (youglishBtn) {
        event.stopPropagation();
        const idx = Number(youglishBtn.getAttribute('data-index'));
        const item = currentWords[idx];
        if (item) openYouglish(item.word);
        return;
    }
    const card = event.target.closest('.word-card');
    if (!card) return;
    const idx = Number(card.getAttribute('data-index'));
    const item = currentWords[idx];
    if (item) showWordModal(item);
}

// ---------- 日期工具 ----------
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
function getTodayString() { return formatDate(new Date()); }

// ---------- 加载并显示 ----------
async function loadAndDisplayWords(selectedDate) {
    const output = document.getElementById('output');
    output.textContent = 'Loading Oxford 5000 words...';
    output.className = 'loading';

    try {
        const entries = await ensureDataLoaded();
        if (!entries.length) {
            output.innerHTML = '<div class="loading">No valid word data found.</div>';
            return;
        }
        const seed = dateToSeed(selectedDate);
        const picked = getRandomEntriesWithSeed(entries, 100, seed);

        currentWords = picked;
        currentSelectedDate = selectedDate;
        currentSeed = seed;
        currentFocusIndex = loadFocusProgress(selectedDate, picked.length);

        renderCurrentMode();
    } catch (error) {
        console.error('Error loading words:', error);
        output.innerHTML = '<div class="loading">Error loading words. Please check your network connection and try again.</div>';
    }
}

// ---------- 页面初始化 ----------
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('dateInput');
    const modal = document.getElementById('translationModal');
    const closeBtn = document.querySelector('.close');
    const googleSearchBtn = document.getElementById('googleSearchBtn');
    const googlePictureBtn = document.getElementById('googlePictureBtn');
    const youglishBtn = document.getElementById('youglishBtn');
    const modalPronUsBtn = document.getElementById('modalPronUsBtn');
    const modalPronUkBtn = document.getElementById('modalPronUkBtn');

    document.getElementById('currentYear').textContent = new Date().getFullYear();

    const today = getTodayString();
    dateInput.value = today;

    dateInput.addEventListener('change', (event) => {
        const v = event.target.value;
        if (v) loadAndDisplayWords(v);
    });

    document.querySelectorAll('input[name="focusMode"]').forEach(radio => {
        radio.addEventListener('change', () => {
            if (currentWords.length) renderCurrentMode();
            else if (dateInput.value) loadAndDisplayWords(dateInput.value);
        });
    });

    document.querySelectorAll('input[name="accent"]').forEach(radio => {
        radio.addEventListener('change', () => {
            // 仅网格视图需要重渲染（音标显示跟随 Accent）；聚焦视图同时显示 US/UK，无需重绘
            if (currentWords.length && getFocusMode() === 'off') renderCurrentMode();
        });
    });

    document.addEventListener('keydown', handleFocusKeydown);

    closeBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) closeModal();
    });

    googleSearchBtn.addEventListener('click', () => {
        const item = window.currentItem;
        if (item) openGoogleMeaning(item.word);
    });
    googlePictureBtn.addEventListener('click', () => {
        const item = window.currentItem;
        if (item) openGooglePicture(item.word);
    });
    if (youglishBtn) youglishBtn.addEventListener('click', () => {
        const item = window.currentItem;
        if (item) openYouglish(item.word);
    });
    modalPronUsBtn.addEventListener('click', () => {
        const item = window.currentItem;
        if (item) playWordAudio(item, 'us');
    });
    modalPronUkBtn.addEventListener('click', () => {
        const item = window.currentItem;
        if (item) playWordAudio(item, 'uk');
    });

    loadAndDisplayWords(today);

    // 调试用全局接口
    window.showWordModal = showWordModal;
    window.closeModal = closeModal;
    window.playWordAudio = playWordAudio;
    window.openYouglish = openYouglish;
});
