document.addEventListener('DOMContentLoaded', () => {
  // 定数定義
  const TRANSLATION_HISTORY_KEY = 'translationHistory';
  const MAX_HISTORY_ITEMS = 20;

  // DOM要素の取得
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

  // 初期化
  async function initialize() {
    await loadModels();
    loadSavedData();
    setupEventListeners();
    loadTranslationHistory();
  }

  // モデル関連の機能
  async function loadModels() {
    try {
      const response = await fetch(chrome.runtime.getURL('models.json'));
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

  function updateModelSelect() {
    const selectedAPI = elements.selects.api.value;
    const apiModels = models[selectedAPI] || [];

    elements.selects.model.innerHTML = '';
    apiModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      elements.selects.model.appendChild(option);
    });

    chrome.storage.sync.get(['selectedModel'], (data) => {
      if (data.selectedModel && apiModels.includes(data.selectedModel)) {
        elements.selects.model.value = data.selectedModel;
      } else if (apiModels.length > 0) {
        const defaultModel = apiModels[0];
        elements.selects.model.value = defaultModel;
        chrome.storage.sync.set({ selectedModel: defaultModel });
      }
    });
  }

  // データ保存と読み込み
  function loadSavedData() {
    chrome.storage.sync.get([
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
        const defaultAPI = 'chatgpt';
        elements.selects.api.value = defaultAPI;
        chrome.storage.sync.set({ selectedAPI: defaultAPI });
        updateModelSelect();
      }
      if (data.sourceLang) elements.selects.sourceLanguage.value = data.sourceLang;
      if (data.targetLang) elements.selects.targetLanguage.value = data.targetLang;
      
      loadSelectedText();
    });
  }

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

  // イベントリスナーの設定
  function setupEventListeners() {
    // API関連
    elements.buttons.saveKeys.addEventListener('click', saveAPIKeys);
    elements.selects.api.addEventListener('change', handleAPIChange);
    elements.selects.model.addEventListener('change', saveSelectedModel);

    // 言語関連
    elements.selects.sourceLanguage.addEventListener('change', () => {
      chrome.storage.sync.set({ sourceLang: elements.selects.sourceLanguage.value });
    });
    elements.selects.targetLanguage.addEventListener('change', () => {
      chrome.storage.sync.set({ targetLang: elements.selects.targetLanguage.value });
    });
    elements.buttons.swapLanguages.addEventListener('click', swapLanguages);

    // 翻訳関連
    elements.buttons.translate.addEventListener('click', handleTranslation);
    elements.buttons.clearText.addEventListener('click', clearText);
    elements.buttons.clearHistory.addEventListener('click', clearHistory);
    elements.buttons.copyTranslation.addEventListener('click', copyTranslation);
  }

  // API関連のハンドラー
  function saveAPIKeys() {
    const apiKeyChatGPT = elements.inputs.apiKeyChatGPT.value.trim();
    const apiKeyGemini = elements.inputs.apiKeyGemini.value.trim();
    chrome.storage.sync.set({ apiKeyChatGPT, apiKeyGemini }, () => {
      alert('API keys saved!');
    });
  }

  function handleAPIChange() {
    const selectedAPI = elements.selects.api.value;
    chrome.storage.sync.set({ selectedAPI }, () => {
      updateModelSelect();
    });
  }

  function saveSelectedModel() {
    chrome.storage.sync.set({ selectedModel: elements.selects.model.value });
  }

  // 言語関連の機能
  function swapLanguages() {
    const sourceLang = elements.selects.sourceLanguage.value;
    const targetLang = elements.selects.targetLanguage.value;
    
    if (sourceLang !== 'auto') {
      elements.selects.sourceLanguage.value = targetLang;
      elements.selects.targetLanguage.value = sourceLang;
      chrome.storage.sync.set({ sourceLang: targetLang, targetLang: sourceLang });
    }
  }

  // 翻訳機能
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

  async function performTranslation(config) {
    const { selectedAPI } = config;

    chrome.storage.sync.get(['apiKeyChatGPT', 'apiKeyGemini'], async (keys) => {
      const apiKey = selectedAPI === 'chatgpt' ? keys.apiKeyChatGPT : keys.apiKeyGemini;

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

  // 履歴管理
  function loadTranslationHistory() {
    chrome.storage.sync.get([TRANSLATION_HISTORY_KEY], (result) => {
      const history = result[TRANSLATION_HISTORY_KEY] || [];
      console.log('Translation history loaded:', history);
      displayHistory(history);
    });
  }

  function displayHistory(history) {
    elements.history.innerHTML = '';
    
    if (history.length === 0) {
      elements.history.innerHTML = '<p>No translation history yet.</p>';
      return;
    }

    history.forEach((item, index) => {
      const historyItem = createHistoryItem(item, index);
      elements.history.appendChild(historyItem);
    });
  }

  function createHistoryItem(item, index) {
    const historyItemDiv = document.createElement('div');
    historyItemDiv.classList.add('history-item');
    historyItemDiv.innerHTML = `
      <div class="history-source">${escapeHTML(item.sourceText)}</div>
      <div class="history-translated">${escapeHTML(item.translatedText)}</div>
      <div class="history-meta">
        ${item.api} (${item.model}) - ${new Date(item.timestamp).toLocaleString()}
      </div>
      <button class="delete-history-item" data-index="${index}">Delete</button>
    `;

    historyItemDiv.addEventListener('click', () => {
      elements.inputs.sourceText.value = item.sourceText;
      elements.inputs.translatedText.value = item.translatedText;
      if (elements.inputs.supplementaryText) {
        elements.inputs.supplementaryText.value = item.supplementaryText || '';
      }
    });

    const deleteButton = historyItemDiv.querySelector('.delete-history-item');
    deleteButton.addEventListener('click', (event) => {
      deleteHistoryItem(index);
      event.stopPropagation();
    });

    return historyItemDiv;
  }

  function deleteHistoryItem(index) {
    chrome.storage.sync.get([TRANSLATION_HISTORY_KEY], (result) => {
      let history = result[TRANSLATION_HISTORY_KEY] || [];
      if (index >= 0 && index < history.length) {
        history.splice(index, 1);
        chrome.storage.sync.set({ [TRANSLATION_HISTORY_KEY]: history }, () => {
          console.log('Translation history item deleted.');
          displayHistory(history);
        });
      }
    });
  }

  // ユーティリティ機能
  function clearHistory() {
    chrome.storage.sync.remove(TRANSLATION_HISTORY_KEY, () => {
      console.log('Translation history cleared.');
      displayHistory([]);
    });
  }

  function clearText() {
    elements.inputs.sourceText.value = '';
    elements.inputs.translatedText.value = '';
    if (elements.inputs.supplementaryText) {
      elements.inputs.supplementaryText.value = '';
    }
  }

  function copyTranslation() {
    const translationText = elements.inputs.translatedText.value;
    navigator.clipboard.writeText(translationText)
      .then(() => console.log('Translation copied to clipboard!'))
      .catch(err => console.error('Failed to copy translation: ', err));
  }

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
