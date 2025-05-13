// 定数定義
const TRANSLATION_HISTORY_KEY = 'translationHistory';
const MAX_HISTORY_ITEMS = 20;

// 言語マッピング
const LANGUAGE_MAP = {
  'en': 'English',
  'ja': 'Japanese',
  'es': 'Spanish',
  'fr': 'French',
  'de': 'German',
  'zh-CN': 'Chinese (Simplified)',
  'ko': 'Korean'
};

// グローバル状態
let models = {};

// 初期化関数
async function initialize() {
  console.log('AI Translator extension initializing...');
  await loadModels();
  setupContextMenu();
  setupDefaultSettings();
}

// モデル関連の機能
async function loadModels() {
  try {
    const response = await fetch(chrome.runtime.getURL('models.json'));
    if (!response.ok) {
      throw new Error(`Failed to load models.json: ${response.statusText}`);
    }
    models = await response.json();
    console.log('Models loaded in background:', models);
  } catch (error) {
    console.error('Error loading models.json in background:', error);
  }
}

// コンテキストメニューの設定
function setupContextMenu() {
  chrome.contextMenus.create({
    id: "translateSelectedText",
    title: "選択したテキストを翻訳",
    contexts: ["selection"]
  });
}

// デフォルト設定
function setupDefaultSettings() {
  chrome.storage.sync.set({ selectedModel: 'gpt-4o-mini' }, () => {
    console.log('Default model set to gpt-4o-mini');
  });
}

// 翻訳機能
async function handleTranslation(request, sendResponse) {
  const { text, supplementaryText, sourceLang, targetLang, api, model, apiKey } = request;
  
  try {
    const config = createTranslationConfig({
      text,
      supplementaryText,
      sourceLang,
      targetLang,
      api,
      model,
      apiKey
    });

    const response = await fetchTranslation(config);
    const translation = extractTranslation(response, api);
    
    await saveTranslationHistory({
      sourceText: text,
      translatedText: translation,
      supplementaryText,
      sourceLang,
      targetLang,
      api,
      model
    });

    sendResponse({ translation });
  } catch (error) {
    console.error('Translation error:', error);
    sendResponse({ error: error.message || 'Failed to fetch translation.' });
  }
}

// 翻訳設定の作成
function createTranslationConfig({ text, supplementaryText, sourceLang, targetLang, api, model, apiKey }) {
  const sourceLangPrompt = sourceLang === 'auto' 
    ? 'Detect language and translate' 
    : `Translate from ${getLanguageName(sourceLang)}`;
  const prompt = `${sourceLangPrompt} to ${getLanguageName(targetLang)}: "${text}"`;

  let systemInstruction = 'You are a translation assistant. Provide only the translated text without any additional comments or explanations.';
  if (supplementaryText) {
    systemInstruction += `\n\nTranslate the text according to the following supplementary information: "${supplementaryText}"`;
  }

  if (api === 'chatgpt') {
    return {
      url: 'https://api.openai.com/v1/chat/completions',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: {
        model: model,
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3
      }
    };
  } else if (api === 'gemini') {
    return {
      url: `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      headers: {
        'Content-Type': 'application/json'
      },
      body: {
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: [
          { role: 'user', parts: [{ text: prompt }] }
        ]
      }
    };
  }

  throw new Error('Invalid API selected');
}

// 翻訳APIの呼び出し
async function fetchTranslation(config) {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: config.headers,
    body: JSON.stringify(config.body)
  });

  if (!response.ok) {
    const error = await response.json();
    let errorMessage = `API request failed with status ${response.status}.`;
    if (error?.error?.message) {
      errorMessage += ` Message: ${error.error.message}`;
    } else if (error?.message) {
      errorMessage += ` Message: ${error.message}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// レスポンスから翻訳テキストを抽出
function extractTranslation(data, api) {
  if (api === 'chatgpt') {
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content.trim();
    }
    throw new Error('Unexpected response structure from ChatGPT API');
  } else if (api === 'gemini') {
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error('Unexpected response structure from Gemini API');
  }
  throw new Error('Invalid API type');
}

// 履歴管理
async function saveTranslationHistory(historyItem) {
  const history = await getTranslationHistory();
  
  history.unshift({
    ...historyItem,
    timestamp: Date.now()
  });

  if (history.length > MAX_HISTORY_ITEMS) {
    history.pop();
  }

  await chrome.storage.sync.set({ [TRANSLATION_HISTORY_KEY]: history });
  console.log('Translation history saved:', history);
  
  notifyHistoryUpdate();
}

async function getTranslationHistory() {
  const result = await chrome.storage.sync.get([TRANSLATION_HISTORY_KEY]);
  return result[TRANSLATION_HISTORY_KEY] || [];
}

function notifyHistoryUpdate() {
  chrome.runtime.sendMessage({ action: 'updateHistory' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('Popup is not open, cannot update history:', chrome.runtime.lastError.message);
    }
  });
}

// ユーティリティ関数
function getLanguageName(code) {
  return LANGUAGE_MAP[code] || code;
}

// イベントリスナーの設定
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelectedText" && info.selectionText) {
    chrome.storage.local.set({ selectedTextForTranslation: info.selectionText }, () => {
      console.log('Selected text saved:', info.selectionText);
      chrome.action.openPopup();
    });
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request, sendResponse);
    return true; // 非同期レスポンスを示す
  }
});
