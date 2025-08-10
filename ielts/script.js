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
        hash = hash & hash; // 转换为32位整数
    }
    return Math.abs(hash);
}

// 解析CSV行数据（IELTS格式：ID,word,Chinese translation）
function parseWordLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    
    // 解析CSV格式：ID,word,translation
    const parts = trimmed.split(',');
    if (parts.length >= 3) {
        const id = parts[0].trim();
        const word = parts[1].trim();
        const translation = parts.slice(2).join(',').trim(); // 处理翻译中可能包含逗号的情况
        
        return {
            id: id,
            word: word,
            translation: translation
        };
    }
    return null;
}

// 基于种子的随机选择函数
function getRandomLinesWithSeed(lines, count, seed) {
    const rng = new SeededRandom(seed);
    const validLines = [];
    
    // 过滤和解析有效的词汇行
    for (const line of lines) {
        const parsed = parseWordLine(line);
        if (parsed && parsed.word && parsed.translation) {
            validLines.push(parsed);
        }
    }
    
    if (validLines.length === 0) {
        return [];
    }
    
    // 创建索引数组并使用确定性随机数进行洗牌
    const indices = Array.from({length: validLines.length}, (_, i) => i);
    
    // Fisher-Yates洗牌算法（确定性版本）
    for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(rng.next() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    
    // 取前count个不重复的词
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

// 复制文本到剪贴板
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        showCopySuccess();
    } catch (err) {
        // 降级方案
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.select();
        
        try {
            document.execCommand('copy');
            showCopySuccess();
        } catch (fallbackErr) {
            console.error('复制失败:', fallbackErr);
        }
        
        document.body.removeChild(textArea);
    }
}

// 显示复制成功提示
function showCopySuccess() {
    const successDiv = document.getElementById('copySuccess');
    successDiv.classList.add('show');
    
    setTimeout(() => {
        successDiv.classList.remove('show');
    }, 2000);
}

// 创建词汇网格HTML
function createWordGrid(wordList, selectedDate, seed) {
    const gridHTML = `
        <div class="word-container">
            <div class="info-header">
                <strong>Date:</strong> ${selectedDate} &nbsp;&nbsp;
                <strong>Seed:</strong> ${seed} &nbsp;&nbsp;
                <strong>Words:</strong> ${wordList.length}
            </div>
            <div class="word-grid">
                ${wordList.map((item, index) => `
                    <div class="word-card" onclick="showTranslation('${escapeHtml(item.word)}', '${escapeHtml(item.translation)}')">
                        <div class="word-id">${escapeHtml(item.id)}</div>
                        <div class="word-text">${escapeHtml(item.word)}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    return gridHTML;
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 显示翻译模态框
function showTranslation(word, translation) {
    const modal = document.getElementById('translationModal');
    const modalWordTitle = document.getElementById('modalWordTitle');
    const chineseTranslation = document.getElementById('chineseTranslation');
    
    modalWordTitle.textContent = word;
    chineseTranslation.textContent = translation;
    
    // 设置当前词汇到全局变量，供其他函数使用
    window.currentWord = word;
    
    modal.style.display = 'block';
    
    // 添加键盘ESC关闭功能
    document.addEventListener('keydown', handleModalKeydown);
}

// 处理模态框键盘事件
function handleModalKeydown(event) {
    if (event.key === 'Escape') {
        closeModal();
    }
}

// 关闭模态框
function closeModal() {
    const modal = document.getElementById('translationModal');
    modal.style.display = 'none';
    document.removeEventListener('keydown', handleModalKeydown);
}

// 在线翻译
function translateOnline() {
    const word = window.currentWord;
    if (!word) return;
    
    // 获取选中的 API
    const selectedAPI = document.querySelector('input[name="apiChoice"]:checked').value;
    // 获取选中的语言
    const selectedLanguage = document.querySelector('input[name="language"]:checked').value;
    
    let translateUrl;
    
    if (selectedAPI === 'bing') {
        // 使用 Bing 翻译
        if (selectedLanguage === 'cn') {
            // 英语到中文
            translateUrl = `https://cn.bing.com/translator?from=en&to=zh-Hans&setlang=zh-Hans&text=${encodeURIComponent(word)}`;
        } else {
            // 英语到粤语
            translateUrl = `https://cn.bing.com/translator?from=en&to=yue&setlang=yue&text=${encodeURIComponent(word)}`;
        }
    } else {
        // 使用 Google 翻译
        if (selectedLanguage === 'cn') {
            // 英语到中文
            translateUrl = `https://translate.google.com/?sl=en&tl=zh-CN&text=${encodeURIComponent(word)}&op=translate`;
        } else {
            // 英语到粤语
            translateUrl = `https://translate.google.com/?sl=en&tl=yue&text=${encodeURIComponent(word)}&op=translate`;
        }
    }
    
    // 在新窗口打开翻译链接
    window.open(translateUrl, '_blank');
}

// 复制词汇
function copyCurrentWord() {
    const word = window.currentWord;
    if (word) {
        copyToClipboard(word);
    }
}

// 格式化日期为YYYY-MM-DD
function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 获取今天的日期
function getTodayString() {
    return formatDate(new Date());
}

// 加载并显示词汇
function loadAndDisplayWords(selectedDate) {
    const output = document.getElementById('output');
    output.textContent = 'Loading IELTS words...';
    output.className = 'loading';
    
    fetch('ielts.csv')
        .then(response => {
            if (!response.ok) {
                throw new Error('Network response error: ' + response.statusText);
            }
            return response.text();
        })
        .then(text => {
            const lines = text.split('\n');
            
            // 使用选择的日期作为种子
            const seed = dateToSeed(selectedDate);
            const randomWords = getRandomLinesWithSeed(lines, 100, seed);
            
            if (randomWords.length === 0) {
                output.innerHTML = '<div class="loading">CSV file format error or no valid word data found.</div>';
                return;
            }
            
            if (randomWords.length < 100) {
                console.warn(`Warning: Only found ${randomWords.length} valid words, less than expected 100.`);
            }
            
            // 创建并显示网格
            const gridHTML = createWordGrid(randomWords, selectedDate, seed);
            output.innerHTML = gridHTML;
            output.className = '';
        })
        .catch(error => {
            console.error('Error loading words:', error);
            output.innerHTML = '<div class="loading">Error loading words. Please check your network connection or if the file exists.</div>';
        });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('dateInput');
    const modal = document.getElementById('translationModal');
    const closeBtn = document.querySelector('.close');
    const translateOnlineBtn = document.getElementById('translateOnlineBtn');
    const copyWordBtn = document.getElementById('copyWordBtn');
    
    // 设置版权年份
    const currentYear = new Date().getFullYear();
    document.getElementById('currentYear').textContent = currentYear;
    
    // 设置默认日期为今天
    const today = getTodayString();
    dateInput.value = today;
    
    // 监听日期变化
    dateInput.addEventListener('change', (event) => {
        const selectedDate = event.target.value;
        if (selectedDate) {
            loadAndDisplayWords(selectedDate);
        }
    });
    
    // 模态框事件监听
    closeBtn.addEventListener('click', closeModal);
    
    // 点击模态框外部关闭
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });
    
    // 在线翻译按钮
    translateOnlineBtn.addEventListener('click', translateOnline);
    
    // 复制词汇按钮
    copyWordBtn.addEventListener('click', copyCurrentWord);
    
    // 初始加载今天的词汇
    loadAndDisplayWords(today);
    
    // 将函数添加到全局作用域
    window.showTranslation = showTranslation;
    window.closeModal = closeModal;
    window.translateOnline = translateOnline;
    window.copyCurrentWord = copyCurrentWord;
});