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

// 解析词汇行数据
function parseWordLine(line) {
    const trimmed = line.trim();
    if (!trimmed) return null;
    
    // 使用制表符分割，如果没有制表符则尝试空格分割
    let parts = trimmed.split('\t');
    if (parts.length < 3) {
        // 尝试多个空格分割
        parts = trimmed.split(/\s+/);
    }
    
    if (parts.length >= 3) {
        return {
            word: parts[0].trim(),
            pinyin: parts[1].trim(),
            frequency: parts[2].trim()
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
        if (parsed) {
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
        if (!seenWords.has(wordData.word)) {
            seenWords.add(wordData.word);
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

// 创建表格HTML
function createWordTable(wordList, selectedDate, seed) {
    const tableHTML = `
        <div class="word-container">
            <div class="info-header">
                <strong>日期:</strong> ${selectedDate} &nbsp;&nbsp;
                <strong>生成种子:</strong> ${seed} &nbsp;&nbsp;
            </div>
            <div class="table-container">
                <table class="word-table">
                    <thead>
                        <tr>
                            <th class="word-column">中文词汇 <small>(点击使用所选API翻译)</small></th>
                            <th class="pinyin-column">拼音</th>
                            <th class="frequency-column">ID <small>(点击复制词汇)</small></th>
                        </tr>
                    </thead>
                    <tbody>
                        ${wordList.map((item, index) => `
                            <tr>
                                <td class="word-column" onclick="translateWord('${escapeHtml(item.word)}')">${escapeHtml(item.word)}</td>
                                <td class="pinyin-column">${escapeHtml(item.pinyin)}</td>
                                <td class="frequency-column" onclick="copyWord('${escapeHtml(item.word)}')" title="点击复制词汇">
                                    ${escapeHtml(item.frequency)}
                                    <span class="copy-tooltip">点击复制</span>
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    `;
    
    return tableHTML;
}

// HTML转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// 复制词汇的全局函数
function copyWord(word) {
    copyToClipboard(word);
}

// 翻译词汇的全局函数
function translateWord(word) {
    // 获取选中的 API
    const selectedAPI = document.querySelector('input[name="apiChoice"]:checked').value;
    // 获取选中的语言
    const selectedLanguage = document.querySelector('input[name="language"]:checked').value;
    
    let translateUrl;
    
    if (selectedAPI === 'bing') {
        // 使用 Bing 翻译
        if (selectedLanguage === 'en') {
            // 中文到英语
            translateUrl = `https://cn.bing.com/translator?from=zh-Hans&to=en&setlang=en&text=${encodeURIComponent(word)}`;
        } else {
            // 中文到粤语
            translateUrl = `https://cn.bing.com/translator?from=zh-Hans&to=yue&setlang=yue&text=${encodeURIComponent(word)}`;
        }
    } else {
        // 使用 Google 翻译
        if (selectedLanguage === 'en') {
            // 中文到英语
            translateUrl = `https://translate.google.com/?sl=zh-CN&tl=en&text=${encodeURIComponent(word)}&op=translate`;
        } else {
            // 中文到粤语
            translateUrl = `https://translate.google.com/?sl=zh-CN&tl=yue&text=${encodeURIComponent(word)}&op=translate`;
        }
    }
    
    // 在新窗口打开翻译链接
    window.open(translateUrl, '_blank');
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
    output.textContent = '正在加载词汇...';
    output.className = 'loading';
    
    fetch('word.txt')
        .then(response => {
            if (!response.ok) {
                throw new Error('网络响应错误: ' + response.statusText);
            }
            return response.text();
        })
        .then(text => {
            const lines = text.split('\n');
            
            // 使用选择的日期作为种子
            const seed = dateToSeed(selectedDate);
            const randomWords = getRandomLinesWithSeed(lines, 100, seed);
            
            if (randomWords.length === 0) {
                output.innerHTML = '<div class="loading">词汇文件格式错误或没有有效的词汇数据。</div>';
                return;
            }
            
            if (randomWords.length < 100) {
                console.warn(`警告: 只找到 ${randomWords.length} 个有效词汇，少于期望的100个。`);
            }
            
            // 创建并显示表格
            const tableHTML = createWordTable(randomWords, selectedDate, seed);
            output.innerHTML = tableHTML;
            output.className = '';
        })
        .catch(error => {
            console.error('加载词汇时出错:', error);
            output.innerHTML = '<div class="loading">加载词汇时出错，请检查网络连接或文件是否存在。</div>';
        });
}

// 页面加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    const dateInput = document.getElementById('dateInput');
    
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
    
    // 初始加载今天的词汇
    loadAndDisplayWords(today);
    
    // 将copyWord函数添加到全局作用域
    window.copyWord = copyWord;
    
    // 将translateWord函数添加到全局作用域
    window.translateWord = translateWord;
});