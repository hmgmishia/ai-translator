/**
 * AI Translator Chrome Extension - Background Script
 * 
 * このスクリプトは拡張機能のバックグラウンドで動作し、
 * 翻訳処理、履歴管理、APIとの通信を担当します。
 */

// 定数定義
const TRANSLATION_HISTORY_KEY = 'translationHistory';
const MAX_HISTORY_ITEMS = 20;
const PATH_TO_MODELS_JSON = '/src/config/models.json';
const NAME_MODEL_DEFAULT = 'gpt-4o-mini';
const NAME_API_DEFAULT = 'gemini';

const NAME_API_CHATGPT = 'chatgpt';
const NAME_API_GEMINI = 'gemini';

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

// 現在のミニポップアップのウィンドウIDを保持
let currentMiniPopupId = null;

/**
 * 拡張機能の初期化を行う
 * コンテキストメニューとデフォルト設定をセットアップ
 */
async function initialize() {
  console.log('AI Translator extension initializing...');
  setupContextMenu();
  setupDefaultSettings();
}

/**
 * コンテキストメニューのセットアップ
 */
function setupContextMenu() {
  chrome.contextMenus.create({
    id: "translateSelectedText",
    title: "選択したテキストを翻訳",
    contexts: ["selection"]
  });
}

/**
 * デフォルト設定のセットアップ
 */
function setupDefaultSettings() {
  chrome.storage.sync.get(['selectedAPI', 'selectedModel'], (data) => {
    if (!data.selectedAPI) {
      chrome.storage.sync.set({ selectedAPI: NAME_API_DEFAULT });
    }
    if (!data.selectedModel) {
      chrome.storage.sync.set({ selectedModel: NAME_MODEL_DEFAULT });
    }
  });
}

/**
 * 翻訳リクエストを処理
 * @param {Object} request - 翻訳リクエストパラメータ
 * @param {Function} sendResponse - レスポンス送信用コールバック
 */
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

/**
 * 翻訳用の設定を作成
 * @param {Object} params - 翻訳パラメータ
 * @returns {Object} API呼び出し用の設定オブジェクト
 */
function createTranslationConfig({ text, supplementaryText, sourceLang, targetLang, api, model, apiKey }) {
  const sourceLangPrompt = sourceLang === 'auto' 
    ? 'Detect language and translate' 
    : `Translate from ${getLanguageName(sourceLang)}`;
  const prompt = `${sourceLangPrompt} to ${getLanguageName(targetLang)}: "${text}"`;

  let systemInstruction = 'You are a translation assistant. Provide only the translated text without any additional comments or explanations.';
  if (supplementaryText) {
    systemInstruction += `\n\nTranslate the text according to the following supplementary information: "${supplementaryText}"`;
  }

  if (api === NAME_API_CHATGPT) {
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
  } else if (api === NAME_API_GEMINI) {
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

/**
 * 翻訳APIを呼び出し
 * @param {Object} config - API呼び出し設定
 * @returns {Promise<Object>} APIレスポンス
 */
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

/**
 * APIレスポンスから翻訳テキストを抽出
 * @param {Object} data - APIレスポンス
 * @param {string} api - 使用中のAPI
 * @returns {string} 翻訳されたテキスト
 */
function extractTranslation(data, api) {
  if (api === NAME_API_CHATGPT) {
    if (data.choices?.[0]?.message?.content) {
      return data.choices[0].message.content.trim();
    }
    throw new Error('Unexpected response structure from ChatGPT API');
  } else if (api === NAME_API_GEMINI) {
    if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
      return data.candidates[0].content.parts[0].text.trim();
    }
    throw new Error('Unexpected response structure from Gemini API');
  }
  throw new Error('Invalid API type');
}

/**
 * 翻訳履歴を保存
 * @param {Object} historyItem - 保存する履歴アイテム
 */
async function saveTranslationHistory(historyItem) {
  const history = await getTranslationHistory();
  
  // 機密情報を含まない履歴アイテムを作成
  const safeHistoryItem = {
    sourceText: historyItem.sourceText.substring(0, 1000), // 長いテキストを制限
    translatedText: historyItem.translatedText.substring(0, 1000),
    supplementaryText: historyItem.supplementaryText ? historyItem.supplementaryText.substring(0, 500) : '',
    sourceLang: historyItem.sourceLang,
    targetLang: historyItem.targetLang,
    api: historyItem.api,
    model: historyItem.model,
    timestamp: Date.now()
  };

  history.unshift(safeHistoryItem);

  if (history.length > MAX_HISTORY_ITEMS) {
    history.pop();
  }

  await chrome.storage.sync.set({ [TRANSLATION_HISTORY_KEY]: history });
  console.log('Translation history saved:', history);
  
  notifyHistoryUpdate();
}

/**
 * 翻訳履歴を取得
 * @returns {Promise<Array>} 履歴アイテムの配列
 */
async function getTranslationHistory() {
  const result = await chrome.storage.sync.get([TRANSLATION_HISTORY_KEY]);
  return result[TRANSLATION_HISTORY_KEY] || [];
}

/**
 * 履歴更新をポップアップに通知
 */
function notifyHistoryUpdate() {
  chrome.runtime.sendMessage({ action: 'updateHistory' }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn('Popup is not open, cannot update history:', chrome.runtime.lastError.message);
    }
  });
}

/**
 * 言語コードから言語名を取得
 * @param {string} code - 言語コード
 * @returns {string} 言語名
 */
function getLanguageName(code) {
  return LANGUAGE_MAP[code] || code;
}

// イベントリスナーの設定
chrome.runtime.onInstalled.addListener(initialize);
chrome.runtime.onStartup.addListener(initialize);

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "translateSelectedText" && info.selectionText) {
    // 既存のミニポップアップがあれば閉じる
    if (currentMiniPopupId !== null) {
      chrome.windows.remove(currentMiniPopupId, () => {
        if (chrome.runtime.lastError) {
          console.log('Previous window was already closed');
        }
        createNewMiniPopup(info);
      });
    } else {
      createNewMiniPopup(info);
    }
  }
});

// 新しいミニポップアップを作成する関数
function createNewMiniPopup(info) {
  chrome.storage.local.set({ selectedTextForTranslation: info.selectionText }, () => {
    console.log('Selected text saved:', info.selectionText);
    chrome.windows.create({
      url: chrome.runtime.getURL('src/popup/mini-popup.html'),
      type: 'popup',
      width: 320,
      height: 400,
      left: info.x,
      top: info.y,
      focused: true
    }, (window) => {
      currentMiniPopupId = window.id;
    });
  });
}

// ウィンドウが閉じられたときの処理
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === currentMiniPopupId) {
    currentMiniPopupId = null;
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    handleTranslation(request, sendResponse);
    return true; // 非同期レスポンスを示す
  } else if (request.action === 'openFullPopup') {
    // フルポップアップを開く前に既存のミニポップアップを閉じる
    if (currentMiniPopupId !== null) {
      chrome.windows.remove(currentMiniPopupId, () => {
        chrome.action.openPopup();
      });
    } else {
      chrome.action.openPopup();
    }
  }
});
