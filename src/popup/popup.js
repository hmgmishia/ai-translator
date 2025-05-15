/**
 * AI Translator Chrome Extension - Popup Script
 * 
 * このスクリプトはポップアップUIの制御を担当し、
 * ユーザーインターフェース、翻訳機能、履歴管理を処理します。
 */

document.addEventListener('DOMContentLoaded', () => {
  // 定数定義
  const TRANSLATION_HISTORY_KEY = 'translationHistory';
  const MAX_HISTORY_ITEMS = 20;
  const PATH_TO_MODELS_JSON = '/src/config/models.json';
  const NAME_MODEL_DEFAULT = 'gpt-4o-mini';
  const NAME_API_DEFAULT = 'gemini';

  const NAME_API_CHATGPT = 'chatgpt';
  const NAME_API_GEMINI = 'gemini';

  /**
   * UIの要素を管理するオブジェクト
   * 入力フィールド、選択メニュー、ボタンへの参照を保持
   */
  const elements = {
    inputs: {
      apiKeyChatGPT: document.getElementById('api-key-chatgpt'),
      apiKeyGemini: document.getElementById('api-key-gemini'),
      sourceText: document.getElementById('source-text'),
      translatedText: document.getElementById('translated-text'),
      supplementaryText: document.getElementById('supplementary-text')
    },
    selects: {
      api: document.getElementById('api-select'),
      model: document.getElementById('model-select'),
      sourceLanguage: document.getElementById('source-language'),
      targetLanguage: document.getElementById('target-language')
    },
    buttons: {
      saveKeys: document.getElementById('save-keys-button'),
      swapLanguages: document.getElementById('swap-languages'),
      translate: document.getElementById('translate-button'),
      clearHistory: document.getElementById('clear-history-button'),
      clearText: document.getElementById('clear-text-button'),
      copyTranslation: document.getElementById('copy-translation-button')
    },
    history: document.getElementById('history-list')
  };

  // グローバル状態
  let models = {};

  /**
   * 拡張機能の初期化
   * モデルのロード、保存データの読み込み、イベントリスナーの設定を行う
   */
  async function initialize() {
    await loadModels();
    loadSavedData();
    setupEventListeners();
    loadTranslationHistory();
  }

  /**
   * 利用可能な翻訳モデルを読み込む
   */
  async function loadModels() {
    try {
      const response = await fetch(chrome.runtime.getURL(PATH_TO_MODELS_JSON));
      if (!response.ok) {
        throw new Error(`Failed to load models.json: ${response.statusText}`);
      }
      models = await response.json();
      console.log('Models loaded:', models);
      updateModelSelect();
    } catch (error) {
      console.error('Error loading models.json:', error);
    }
  }

  /**
   * モデル選択メニューを更新
   * 選択されたAPIに応じて利用可能なモデルを表示
   */
  function updateModelSelect() {
    const selectedAPI = elements.selects.api.value;
    const apiModels = models[selectedAPI].models || [];

    elements.selects.model.innerHTML = '';
    apiModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      elements.selects.model.appendChild(option);
    });

    chrome.storage.local.get(['selectedModel'], (data) => {
      if (data.selectedModel && apiModels.includes(data.selectedModel)) {
        elements.selects.model.value = data.selectedModel;
      } else if (apiModels.length > 0) {
        const defaultModel = apiModels[0];
        elements.selects.model.value = defaultModel;
        chrome.storage.local.set({ selectedModel: defaultModel });
      }
    });
  }

  /**
   * 保存されたデータを読み込む
   * APIキー、選択されたAPI、言語設定などを復元
   */
  function loadSavedData() {
    chrome.storage.local.get([
      'apiKeyChatGPT',
      'apiKeyGemini',
      'selectedAPI',
      'sourceLang',
      'targetLang'
    ], (data) => {
      if (data.apiKeyChatGPT) elements.inputs.apiKeyChatGPT.value = data.apiKeyChatGPT;
      if (data.apiKeyGemini) elements.inputs.apiKeyGemini.value = data.apiKeyGemini;
      if (data.selectedAPI) {
        elements.selects.api.value = data.selectedAPI;
        updateModelSelect();
      } else {
        const defaultAPI = NAME_API_DEFAULT;
        elements.selects.api.value = defaultAPI;
        chrome.storage.local.set({ selectedAPI: defaultAPI });
        updateModelSelect();
      }
      if (data.sourceLang) elements.selects.sourceLanguage.value = data.sourceLang;
      if (data.targetLang) elements.selects.targetLanguage.value = data.targetLang;
      
      loadSelectedText();
    });
  }

  /**
   * コンテキストメニューから選択されたテキストを読み込む
   */
  function loadSelectedText() {
    chrome.storage.local.get(['selectedTextForTranslation'], (localData) => {
      if (localData.selectedTextForTranslation) {
        elements.inputs.sourceText.value = localData.selectedTextForTranslation;
        chrome.storage.local.remove('selectedTextForTranslation', () => {
          console.log('Selected text removed from local storage.');
        });
      }
    });
  }

  /**
   * イベントリスナーを設定
   * ユーザーインタラクションに対する処理を登録
   */
  function setupEventListeners() {
    // API関連
    elements.buttons.saveKeys.addEventListener('click', saveAPIKeys);
    elements.selects.api.addEventListener('change', handleAPIChange);
    elements.selects.model.addEventListener('change', saveSelectedModel);

    // 言語関連
    elements.selects.sourceLanguage.addEventListener('change', () => {
      chrome.storage.local.set({ sourceLang: elements.selects.sourceLanguage.value });
    });
    elements.selects.targetLanguage.addEventListener('change', () => {
      chrome.storage.local.set({ targetLang: elements.selects.targetLanguage.value });
    });
    elements.buttons.swapLanguages.addEventListener('click', swapLanguages);

    // 翻訳関連
    elements.buttons.translate.addEventListener('click', handleTranslation);
    elements.buttons.clearText.addEventListener('click', clearText);
    elements.buttons.clearHistory.addEventListener('click', clearHistory);
    elements.buttons.copyTranslation.addEventListener('click', copyTranslation);
  }

  /**
   * APIキーを保存
   */
  function saveAPIKeys() {
    const apiKeyChatGPT = elements.inputs.apiKeyChatGPT.value.trim();
    const apiKeyGemini = elements.inputs.apiKeyGemini.value.trim();
    chrome.storage.local.set({ apiKeyChatGPT, apiKeyGemini }, () => {
      alert('API keys saved!');
    });
  }

  /**
   * API変更時の処理
   */
  function handleAPIChange() {
    const selectedAPI = elements.selects.api.value;
    chrome.storage.local.set({ selectedAPI }, () => {
      updateModelSelect();
    });
  }

  /**
   * 選択されたモデルを保存
   */
  function saveSelectedModel() {
    chrome.storage.local.set({ selectedModel: elements.selects.model.value });
  }

  /**
   * 言語の入れ替え
   */
  function swapLanguages() {
    const sourceLang = elements.selects.sourceLanguage.value;
    const targetLang = elements.selects.targetLanguage.value;
    
    if (sourceLang !== 'auto') {
      elements.selects.sourceLanguage.value = targetLang;
      elements.selects.targetLanguage.value = sourceLang;
      chrome.storage.local.set({ sourceLang: targetLang, targetLang: sourceLang });
    }
  }

  /**
   * 翻訳処理の開始
   */
  async function handleTranslation() {
    const sourceText = elements.inputs.sourceText.value.trim();
    const supplementaryText = elements.inputs.supplementaryText.value.trim();
    const selectedAPI = elements.selects.api.value;
    const selectedModel = elements.selects.model.value;
    const sourceLang = elements.selects.sourceLanguage.value;
    const targetLang = elements.selects.targetLanguage.value;

    if (!sourceText) {
      elements.inputs.translatedText.value = 'Please enter text to translate.';
      return;
    }

    await performTranslation({
      sourceText,
      supplementaryText,
      selectedAPI,
      selectedModel,
      sourceLang,
      targetLang
    });
  }

  /**
   * 翻訳の実行
   * @param {Object} config - 翻訳設定
   */
  async function performTranslation(config) {
    const { selectedAPI } = config;

    chrome.storage.local.get(['apiKeyChatGPT', 'apiKeyGemini'], async (keys) => {
      const apiKey = selectedAPI === NAME_API_CHATGPT ? keys.apiKeyChatGPT : keys.apiKeyGemini;

      if (!apiKey) {
        elements.inputs.translatedText.value = `API key for ${selectedAPI} is not set.`;
        return;
      }

      elements.inputs.translatedText.value = 'Translating...';

      try {
        await sendTranslationRequest({ ...config, apiKey });
      } catch (error) {
        console.error('Translation error:', error);
        elements.inputs.translatedText.value = `Error: ${error.message}`;
      }
    });
  }

  /**
   * バックグラウンドスクリプトに翻訳リクエストを送信
   * @param {Object} config - 翻訳設定
   */
  function sendTranslationRequest(config) {
    chrome.runtime.sendMessage(
      {
        action: 'translate',
        text: config.sourceText,
        supplementaryText: config.supplementaryText,
        sourceLang: config.sourceLang,
        targetLang: config.targetLang,
        api: config.selectedAPI,
        model: config.selectedModel,
        apiKey: config.apiKey
      },
      handleTranslationResponse
    );
  }

  /**
   * 翻訳レスポンスの処理
   * @param {Object} response - バックグラウンドスクリプトからのレスポンス
   */
  function handleTranslationResponse(response) {
    if (chrome.runtime.lastError) {
      console.error('Error sending message to background:', chrome.runtime.lastError.message);
      elements.inputs.translatedText.value = 'Error: Could not connect to background script.';
      return;
    }

    if (!response) {
      elements.inputs.translatedText.value = 'Error: No response from background script.';
      return;
    }

    if (response.error) {
      elements.inputs.translatedText.value = `Error: ${response.error}`;
    } else if (response.translation) {
      elements.inputs.translatedText.value = response.translation;
    } else {
      elements.inputs.translatedText.value = 'Error: Unexpected response from background script.';
    }
  }

  /**
   * 翻訳履歴の読み込みと表示
   */
  function loadTranslationHistory() {
    chrome.storage.local.get([TRANSLATION_HISTORY_KEY], (result) => {
      const history = result[TRANSLATION_HISTORY_KEY] || [];
      console.log('Translation history loaded:', history);
      displayHistory(history);
    });
  }

  /**
   * 翻訳履歴を表示
   * @param {Array} history - 履歴アイテムの配列
   */
  function displayHistory(history) {
    if (!elements.history) return;

    if (!history || history.length === 0) {
      elements.history.innerHTML = '<div class="no-history">履歴はありません</div>';
      return;
    }

    elements.history.innerHTML = '';
    history.forEach((item, index) => {
      const historyItem = createHistoryItem(item, index);
      elements.history.appendChild(historyItem);
    });
  }

  /**
   * 履歴アイテムのHTML要素を作成
   * @param {Object} item - 履歴アイテム
   * @param {number} index - 配列内のインデックス
   * @returns {HTMLElement} 履歴アイテムの要素
   */
  function createHistoryItem(item, index) {
    const container = document.createElement('div');
    container.className = 'history-item';
    
    // プレビュー部分を作成
    const preview = document.createElement('div');
    preview.className = 'history-preview';
    preview.innerHTML = `
      <div class="history-text">
        <div class="source-text">${escapeHTML(item.preview.sourceText)}</div>
        <div class="translated-text">${escapeHTML(item.preview.translatedText)}</div>
      </div>
      <div class="history-meta">
        <span>${getLanguageName(item.sourceLang)} → ${getLanguageName(item.targetLang)}</span>
        <span class="history-timestamp">${formatTimestamp(item.timestamp)}</span>
      </div>
      <div class="history-actions">
        <button class="show-details-button" title="詳細を表示">詳細</button>
        <button class="delete-history-button" title="この履歴を削除">✕</button>
      </div>
    `;

    // 詳細表示部分を作成（初期状態は非表示）
    const details = document.createElement('div');
    details.className = 'history-details hidden';
    details.innerHTML = `
      <div class="details-content">
        <div class="details-section">
          <h4>翻訳元テキスト:</h4>
          <div class="details-text">${escapeHTML(item.full.sourceText)}</div>
        </div>
        ${item.full.supplementaryText ? `
          <div class="details-section">
            <h4>補足情報:</h4>
            <div class="details-text">${escapeHTML(item.full.supplementaryText)}</div>
          </div>
        ` : ''}
        <div class="details-section">
          <h4>翻訳結果:</h4>
          <div class="details-text">${escapeHTML(item.full.translatedText)}</div>
        </div>
        <div class="details-meta">
          <div>API: ${item.api}</div>
          <div>Model: ${item.model}</div>
        </div>
      </div>
    `;

    container.appendChild(preview);
    container.appendChild(details);

    // プレビューのクリックイベント（ボタン以外の領域）
    const historyText = preview.querySelector('.history-text');
    historyText.addEventListener('click', () => {
      // テキストボックスに完全な翻訳情報を反映
      elements.inputs.sourceText.value = item.full.sourceText;
      elements.inputs.translatedText.value = item.full.translatedText;
      if (elements.inputs.supplementaryText) {
        elements.inputs.supplementaryText.value = item.full.supplementaryText || '';
      }

      // 言語の選択も復元
      elements.selects.sourceLanguage.value = item.sourceLang;
      elements.selects.targetLanguage.value = item.targetLang;

      // APIとモデルの選択も復元
      if (elements.selects.api) {
        elements.selects.api.value = item.api;
        // APIの変更をトリガー
        const event = new Event('change');
        elements.selects.api.dispatchEvent(event);
        
        // モデルの選択を復元（APIの変更イベント後に実行）
        setTimeout(() => {
          if (elements.selects.model) {
            elements.selects.model.value = item.model;
          }
        }, 100);
      }

      // スクロールをテキストエリアの先頭に移動
      elements.inputs.sourceText.scrollTop = 0;
      elements.inputs.translatedText.scrollTop = 0;
    });

    // イベントリスナーを設定
    const showDetailsButton = preview.querySelector('.show-details-button');
    showDetailsButton.addEventListener('click', (e) => {
      e.stopPropagation(); // クリックイベントの伝播を停止
      details.classList.toggle('hidden');
      showDetailsButton.textContent = details.classList.contains('hidden') ? '詳細' : '閉じる';
    });

    const deleteButton = preview.querySelector('.delete-history-button');
    deleteButton.addEventListener('click', (e) => {
      e.stopPropagation(); // クリックイベントの伝播を停止
      deleteHistoryItem(index);
    });

    return container;
  }

  /**
   * 言語コードから言語名を取得
   * @param {string} langCode - 言語コード
   * @returns {string} 言語名
   */
  function getLanguageName(langCode) {
    const languages = {
      'auto': '自動検出',
      'en': '英語',
      'ja': '日本語',
      'es': 'スペイン語',
      'fr': 'フランス語',
      'de': 'ドイツ語',
      'zh-CN': '中国語',
      'ko': '韓国語'
    };
    return languages[langCode] || langCode;
  }

  /**
   * タイムスタンプを整形
   * @param {number} timestamp - UNIXタイムスタンプ
   * @returns {string} 整形された時刻文字列
   */
  function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;
    
    if (diff < 60000) return 'たった今';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}分前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}時間前`;
    
    return date.toLocaleString('ja-JP', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  /**
   * 履歴アイテムの削除
   * @param {number} index - 削除する履歴のインデックス
   */
  function deleteHistoryItem(index) {
    chrome.storage.local.get([TRANSLATION_HISTORY_KEY], (result) => {
      let history = result[TRANSLATION_HISTORY_KEY] || [];
      if (index >= 0 && index < history.length) {
        history.splice(index, 1);
        chrome.storage.local.set({ [TRANSLATION_HISTORY_KEY]: history }, () => {
          console.log('Translation history item deleted.');
          displayHistory(history);
        });
      }
    });
  }

  /**
   * 履歴のクリア
   */
  function clearHistory() {
    chrome.storage.local.remove(TRANSLATION_HISTORY_KEY, () => {
      console.log('Translation history cleared.');
      displayHistory([]);
    });
  }

  /**
   * テキストフィールドのクリア
   */
  function clearText() {
    elements.inputs.sourceText.value = '';
    elements.inputs.translatedText.value = '';
    if (elements.inputs.supplementaryText) {
      elements.inputs.supplementaryText.value = '';
    }
  }

  /**
   * 翻訳テキストのコピー
   */
  function copyTranslation() {
    const translationText = elements.inputs.translatedText.value;
    navigator.clipboard.writeText(translationText)
      .then(() => console.log('Translation copied to clipboard!'))
      .catch(err => console.error('Failed to copy translation: ', err));
  }

  /**
   * HTMLエスケープ
   * @param {string} str - エスケープする文字列
   * @returns {string} エスケープされた文字列
   */
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // メッセージリスナー
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateHistory') {
      console.log('Received updateHistory message from background.js');
      try {
        loadTranslationHistory();
      } catch (error) {
        console.error('Error handling updateHistory message:', error);
      }
    }
  });

  // 初期化の実行
  initialize();
});
