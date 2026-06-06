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

// 解析CSV行数据（格式：ID,word,Chinese translation）
function parseWordLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;

    const parts = trimmed.split(',');
    if (parts.length >= 3) {
        const id = parts[0].trim();
        const word = parts[1].trim();
        const translation = parts.slice(2).join(',').trim();

        return { id, word, translation };
    }
    return null;
}

// 基于种子的随机选择函数
function getRandomLinesWithSeed(lines, count, seed) {
    const rng = new SeededRandom(seed);
    const validLines = [];

    for (const line of lines) {
        const parsed = parseWordLine(line);
        if (parsed && parsed.word && parsed.translation) {
            validLines.push(parsed);
        }
    }

    if (validLines.length === 0) return [];

    const indices = Array.from({ length: validLines.length }, (_, i) => i);

    // Fisher-Yates 洗牌
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const result = [];
    const seenWords = new Set();

    for (let i = 0; i < indices.length && result.length < count; i++) {
        const wordData = validLines[indices[i]];
        if (!seenWords.has(wordData.word.toLowerCase())) {
            seenWords.add(wordData.word.toLowerCase());
            result.push(wordData);
        }
    }

    return result;
}

// HTML 转义
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// HTML 属性转义
function escapeHtmlAttr(text) {
    return String(text).replace(/&/g, '&amp;')
                       .replace(/"/g, '&quot;')
                       .replace(/'/g, '&#39;')
                       .replace(/</g, '&lt;')
                       .replace(/>/g, '&gt;');
}

// 创建词汇网格 HTML
function createWordGrid(wordList, selectedDate, seed) {
    const displayMode = document.querySelector('input[name="displayMode"]:checked')?.value || 'english';

    let cardClass = '';
    let showEnglish = true;
    let showChinese = false;

    switch (displayMode) {
        case 'chinese':
            cardClass = 'chinese-only';
            showEnglish = false;
            showChinese = true;
            break;
        case 'both':
            cardClass = 'show-translation';
            showEnglish = true;
            showChinese = true;
            break;
        case 'english':
        default:
            cardClass = '';
            showEnglish = true;
            showChinese = false;
            break;
    }

    const gridHTML = `
        <div class="word-container">
            <div class="info-header">
                <strong>Date:</strong> ${escapeHtml(selectedDate)} &nbsp;&nbsp;
                <strong>Seed:</strong> ${seed} &nbsp;&nbsp;
                <strong>Words:</strong> ${wordList.length} &nbsp;&nbsp;
                <strong>Mode:</strong> ${displayMode === 'english' ? 'English Only' : displayMode === 'chinese' ? 'Chinese Only' : 'Both Languages'}
            </div>
            <div class="word-grid">
                ${wordList.map((item, index) => `
                    <div class="word-card ${cardClass}" data-word="${escapeHtmlAttr(item.word)}" data-translation="${escapeHtmlAttr(item.translation)}" data-index="${index}">
                        <div class="word-id">${escapeHtml(item.id)}</div>
                        ${showEnglish ? `<div class="word-text">${escapeHtml(item.word)}</div>` : ''}
                        ${showChinese ? `<div class="word-translation">${escapeHtml(item.translation)}</div>` : ''}
                        <button class="speaker-icon" data-word="${escapeHtmlAttr(item.word)}" title="朗读单词">🔊</button>
                    </div>
                `).join('')}
            </div>
        </div>
    `;

    return gridHTML;
}

// 处理词汇点击
function handleWordClick(word, translation) {
    showTranslation(word, translation);
}

// 显示翻译模态框
function showTranslation(word, translation) {
    const modal = document.getElementById('translationModal');
    const modalWordTitle = document.getElementById('modalWordTitle');
    const chineseTranslation = document.getElementById('chineseTranslation');

    modalWordTitle.textContent = word;
    chineseTranslation.textContent = translation;

    window.currentWord = word;

    modal.style.display = 'block';

    document.addEventListener('keydown', handleModalKeydown);
}

function handleModalKeydown(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

function closeModal() {
    const modal = document.getElementById('translationModal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleModalKeydown);
}

// Google 含义搜索（带图片说明）
function googleMeaningSearch() {
    const word = window.currentWord;
    if (!word) return;

    const query = `what does the word "${word}" means? with picture to understand?`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// Google 图片搜索
function googlePictureSearch() {
    const word = window.currentWord;
    if (!word) return;

    const url = `https://www.google.com/search?q=${encodeURIComponent(word)}&udm=2`;
    window.open(url, '_blank', 'noopener,noreferrer');
}

// 语音相关
const NOVELTY_VOICE_NAMES = new Set([
    'Albert', 'Bad News', 'Bahh', 'Bells', 'Boing', 'Bubbles', 'Cellos',
    'Deranged', 'Good News', 'Hysterical', 'Jester', 'Junior', 'Kathy',
    'Organ', 'Pipe Organ', 'Ralph', 'Superstar', 'Trinoids', 'Whisper',
    'Wobble', 'Zarvox', 'Eddy', 'Flo', 'Fred', 'Grandma', 'Grandpa',
    'Reed', 'Rocko', 'Sandy', 'Shelley'
]);

const PREFERRED_VOICE_NAMES = [
    'Google US English',
    'Microsoft Aria Online (Natural) - English (United States)',
    'Microsoft Jenny Online (Natural) - English (United States)',
    'Microsoft Guy Online (Natural) - English (United States)',
    'Microsoft Aria',
    'Microsoft Jenny',
    'Microsoft Zira',
    'Microsoft David',
    'Samantha',
    'Alex',
    'Daniel',
    'Karen',
    'Moira',
    'Tessa'
];

function pickPreferredVoice() {
    if (!window.speechSynthesis) return null;
    const voices = window.speechSynthesis.getVoices() || [];
    if (voices.length === 0) return null;

    for (const name of PREFERRED_VOICE_NAMES) {
        const v = voices.find(v => v.name === name);
        if (v) return v;
    }

    const englishVoices = voices.filter(v =>
        /^en(-|_)/i.test(v.lang) && !NOVELTY_VOICE_NAMES.has(v.name)
    );
    if (englishVoices.length === 0) return null;

    return (
        englishVoices.find(v => v.default && /^en-US/i.test(v.lang)) ||
        englishVoices.find(v => /^en-US/i.test(v.lang) && v.localService) ||
        englishVoices.find(v => /^en-US/i.test(v.lang)) ||
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

function speakWord(word) {
    if (!word) return;
    if (!window.speechSynthesis) {
        console.warn('当前浏览器不支持语音合成功能');
        return;
    }

    window.speechSynthesis.cancel();

    const doSpeak = () => {
        const utterance = new SpeechSynthesisUtterance(word);
        const voice = pickPreferredVoice();
        if (voice) {
            utterance.voice = voice;
            utterance.lang = voice.lang || 'en-US';
        } else {
            utterance.lang = 'en-US';
        }

        utterance.rate = 0.9;
        utterance.pitch = 1;
        utterance.volume = 1;

        utterance.onerror = function (event) {
            console.error('语音合成出错:', event.error);
        };

        window.speechSynthesis.speak(utterance);
    };

    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
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

function speakCurrentWord() {
    const word = window.currentWord;
    if (word) {
        speakWord(word);
    }
}

// 设置词汇卡片点击事件处理器
function setupWordCardClickHandlers() {
    const wordGrid = document.querySelector('.word-grid');
    if (!wordGrid) return;

    wordGrid.removeEventListener('click', handleWordGridClick);
    wordGrid.addEventListener('click', handleWordGridClick);
}

function handleWordGridClick(event) {
    if (event.target.classList.contains('speaker-icon')) {
        event.stopPropagation();
        const word = event.target.getAttribute('data-word');
        if (word) {
            speakWord(word);
        }
        return;
    }

    const wordCard = event.target.closest('.word-card');
    if (!wordCard) return;

    const word = wordCard.getAttribute('data-word');
    const translation = wordCard.getAttribute('data-translation');

    if (word && translation) {
        handleWordClick(word, translation);
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function getTodayString() {
    return formatDate(new Date());
}

// 加载并显示词汇（复用 high-school 文件夹下的 csv 数据）
function loadAndDisplayWords(selectedDate) {
    const output = document.getElementById('output');
    output.textContent = 'Loading words...';
    output.className = 'loading';

    fetch('../high-school/words.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response error: ' + response.statusText);
            }
            return response.text();
        })
        .then(text => {
            const lines = text.split('\n');

            const seed = dateToSeed(selectedDate);
            const randomWords = getRandomLinesWithSeed(lines, 100, seed);

            if (randomWords.length === 0) {
                output.innerHTML = '<div class="loading">CSV file format error or no valid word data found.</div>';
                return;
            }

            const gridHTML = createWordGrid(randomWords, selectedDate, seed);
            output.innerHTML = gridHTML;
            output.className = '';

            setupWordCardClickHandlers();
        })
        .catch(error => {
            console.error('Error loading words:', error);
            output.innerHTML = '<div class="loading">Error loading words. Please check your network connection or if the file exists.</div>';
        });
}

// 页面初始化
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('dateInput');
    const modal = document.getElementById('translationModal');
    const closeBtn = document.querySelector('.close');
    const googleSearchBtn = document.getElementById('googleSearchBtn');
    const googlePictureBtn = document.getElementById('googlePictureBtn');
    const modalSpeakerBtn = document.getElementById('modalSpeakerBtn');

    // 设置版权年份
    const currentYear = new Date().getFullYear();
    document.getElementById('currentYear').textContent = currentYear;

    // 默认日期为今天
    const today = getTodayString();
    dateInput.value = today;

    // 监听日期变化
    dateInput.addEventListener('change', (event) => {
        const selectedDate = event.target.value;
        if (selectedDate) {
            loadAndDisplayWords(selectedDate);
        }
    });

    // 监听显示模式变化
    const displayModeRadios = document.querySelectorAll('input[name="displayMode"]');
    displayModeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            const currentDate = dateInput.value;
            if (currentDate) {
                loadAndDisplayWords(currentDate);
            }
        });
    });

    // 模态框事件监听
    closeBtn.addEventListener('click', closeModal);

    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Google 含义按钮：在新页面打开
    googleSearchBtn.addEventListener('click', googleMeaningSearch);

    // Google 图片按钮：在新页面打开
    googlePictureBtn.addEventListener('click', googlePictureSearch);

    // 模态框朗读按钮
    modalSpeakerBtn.addEventListener('click', speakCurrentWord);

    // 加载今天的词汇
    loadAndDisplayWords(today);

    // 暴露给全局（便于调试）
    window.handleWordClick = handleWordClick;
    window.showTranslation = showTranslation;
    window.closeModal = closeModal;
    window.googleMeaningSearch = googleMeaningSearch;
    window.googlePictureSearch = googlePictureSearch;
    window.speakWord = speakWord;
    window.speakCurrentWord = speakCurrentWord;
});
