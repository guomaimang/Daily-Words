# Daily Words - 每日词汇

一个简洁优雅的每日词汇学习网站，基于日期确定性地生成每日100个学习词汇，支持多种翻译 API 和语言。

## ✨ 特性

- 📅 **确定性随机选择**：基于日期生成种子，同一天总是显示相同的词汇
- 🎯 **每日100词**：每天随机选择100个不重复的词汇进行学习
- 🌐 **多语言翻译**：支持翻译为粤语和英语
- 🔄 **多种翻译 API**：集成 Google Translate、Bing Translator 和 Shyyp 粤语字典
- 📋 **一键复制**：点击词汇 ID 即可快速复制词汇到剪贴板
- 🎓 **多种模式**：支持普通模式、高中模式和雅思模式
- 📱 **响应式设计**：完美支持桌面和移动设备

## 🚀 快速开始

### 在线访问

直接访问部署的网站即可使用。

### 本地运行

1. 克隆仓库
```bash
git clone https://github.com/yourusername/Daily-Words.git
cd Daily-Words
```

2. 使用任意 HTTP 服务器启动

使用 Python：
```bash
cd src
python -m http.server 8000
```

使用 Node.js：
```bash
cd src
npx serve
```

3. 在浏览器中打开 `http://localhost:8000`

## 📖 使用说明

### 基本功能

1. **选择日期**：使用日期选择器选择任意日期，系统会为该日期生成固定的100个词汇
2. **选择翻译 API**：
   - **Google Translate**：使用 Google 翻译服务
   - **Bing Translator**：使用 Bing 翻译服务
   - **Shyyp**：粤语专用字典（仅在选择粤语时可用）
3. **选择翻译语言**：
   - **粤语 (HK)**：将中文词汇翻译为粤语
   - **英语 (EN)**：将中文词汇翻译为英语
4. **翻译词汇**：点击任意词汇，在新窗口中打开所选 API 的翻译页面
5. **复制词汇**：点击词汇的 ID 列，快速复制词汇到剪贴板

### 切换模式

项目包含三种学习模式：

- **普通模式**：`src/index.html` - 标准词汇学习
- **高中模式**：`src/high-school/index.html` - 适合高中生的词汇
- **雅思模式**：`src/ielts/index.html` - 雅思考试词汇

可以通过页面左上角的按钮快速切换模式。

## 📁 项目结构

```
Daily-Words/
├── src/
│   ├── index.html              # 主页面（普通模式）
│   ├── script.js               # 核心逻辑脚本
│   ├── word.txt                # 词汇数据文件
│   ├── favicon.ico             # 网站图标
│   ├── 404.html                # 404 错误页面
│   ├── LICENSE                 # 许可证文件
│   ├── high-school/            # 高中模式
│   │   ├── index.html
│   │   ├── script.js
│   │   └── word.txt
│   └── ielts/                  # 雅思模式
│       ├── index.html
│       ├── script.js
│       └── word.txt
├── docs/                       # 文档目录
└── README.md                   # 项目说明文件
```

## 🔧 技术实现

### 确定性随机算法

项目使用线性同余生成器（LCG）实现确定性随机数生成：

```javascript
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
```

- 基于日期字符串生成唯一种子值
- 使用 Fisher-Yates 洗牌算法打乱词汇顺序
- 确保同一天总是生成相同的词汇序列

### 词汇数据格式

词汇文件 `word.txt` 采用制表符或空格分隔的格式：

```
词汇    拼音    ID/频率
例如：   学习    xué xí    1001
```

## 🎨 界面特性

- 清爽的白色卡片式设计
- 表格式词汇展示，支持悬停高亮
- 响应式布局，移动端优化
- 平滑的动画过渡效果
- 复制成功的提示反馈

## 📝 自定义词汇

你可以通过编辑 `word.txt` 文件来自定义词汇库：

1. 每行一个词汇，使用制表符或空格分隔
2. 格式：`词汇 [TAB] 拼音 [TAB] ID`
3. 确保文件使用 UTF-8 编码

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](src/LICENSE) 文件了解详情

## 🙏 致谢

- Google Translate API
- Bing Translator API
- Shyyp 粤语字典

---

如有问题或建议，欢迎通过 Issues 反馈！
