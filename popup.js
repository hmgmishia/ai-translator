document.addEventListener('DOMContentLoaded', () => {
  const apiKeyChatGPTInput = document.getElementById('api-key-chatgpt');
  const apiKeyGeminiInput = document.getElementById('api-key-gemini');
  const saveKeysButton = document.getElementById('save-keys-button');
  const apiSelect = document.getElementById('api-select');
  const sourceLanguageSelect = document.getElementById('source-language');
  const targetLanguageSelect = document.getElementById('target-language');
  const swapLanguagesButton = document.getElementById('swap-languages');
  const sourceTextInput = document.getElementById('source-text');
  const translatedTextInput = document.getElementById('translated-text');
  const supplementaryTextInput = document.getElementById('supplementary-text');
  const translateButton = document.getElementById('translate-button');
  const modelSelect = document.getElementById('model-select');
  const historyList = document.getElementById('history-list');
  const clearHistoryButton = document.getElementById('clear-history-button');
  const clearTranslationButton = document.getElementById('clear-text-button');

  const TRANSLATION_HISTORY_KEY = 'translationHistory';
  const MAX_HISTORY_ITEMS = 20;

  let models = {};

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
    const selectedAPI = apiSelect.value;
    const apiModels = models[selectedAPI] || [];

    modelSelect.innerHTML = '';

    apiModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });

    chrome.storage.sync.get(['selectedModel'], (data) => {
      if (data.selectedModel && apiModels.includes(data.selectedModel)) {
        modelSelect.value = data.selectedModel;
      } else if (apiModels.length > 0) {
        modelSelect.value = apiModels[0];
      }
    });
  }

  loadSavedData();

  // Load saved API keys and preferences and selected text
  function loadSavedData() {
    chrome.storage.sync.get(['apiKeyChatGPT', 'apiKeyGemini', 'selectedAPI', 'sourceLang', 'targetLang', 'selectedModel'], (data) => {
      if (data.apiKeyChatGPT) {
        apiKeyChatGPTInput.value = data.apiKeyChatGPT;
      }
      if (data.apiKeyGemini) {
        apiKeyGeminiInput.value = data.apiKeyGemini;
      }
      if (data.selectedAPI) {
        apiSelect.value = data.selectedAPI;
      }
      if (data.sourceLang) {
        sourceLanguageSelect.value = data.sourceLang;
      }
      if (data.targetLang) {
        targetLanguageSelect.value = data.targetLang;
      }
      // selectedModelはupdateModelSelectで処理される

      loadSelectedText();
    });
  }

  function loadSelectedText() {
    chrome.storage.local.get(['selectedTextForTranslation'], (localData) => {
      if (localData.selectedTextForTranslation) {
        sourceTextInput.value = localData.selectedTextForTranslation;
        chrome.storage.local.remove('selectedTextForTranslation', () => {
          console.log('Selected text removed from local storage.');
        });
      }
    });
  }

  // Save API keys
  saveKeysButton.addEventListener('click', () => {
    const apiKeyChatGPT = apiKeyChatGPTInput.value.trim();
    const apiKeyGemini = apiKeyGeminiInput.value.trim();
    chrome.storage.sync.set({ apiKeyChatGPT, apiKeyGemini }, () => {
      alert('API keys saved!');
    });
  });

  // Save selected API and update models
  apiSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ selectedAPI: apiSelect.value });
    updateModelSelect(); // APIが変更されたらモデルリストを更新
  });

  // Save selected model
  modelSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ selectedModel: modelSelect.value });
  });

  // Save selected languages
  sourceLanguageSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ sourceLang: sourceLanguageSelect.value });
  });

  targetLanguageSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ targetLang: targetLanguageSelect.value });
  });

  // Swap languages
  swapLanguagesButton.addEventListener('click', () => {
    const sourceLang = sourceLanguageSelect.value;
    const targetLang = targetLanguageSelect.value;
    if (sourceLang !== 'auto') { // Cannot swap if source is "Detect Language"
        sourceLanguageSelect.value = targetLang;
        targetLanguageSelect.value = sourceLang;
        chrome.storage.sync.set({ sourceLang: targetLang, targetLang: sourceLang });
    }
  });

  // Translate text
  translateButton.addEventListener('click', async () => {
    const sourceText = sourceTextInput.value.trim();
    const supplementaryTextValue = supplementaryTextInput.value.trim();
    const selectedAPI = apiSelect.value;
    const selectedModel = modelSelect.value; // 選択されたモデルを取得
    const sourceLang = sourceLanguageSelect.value;
    const targetLang = targetLanguageSelect.value;

    if (!sourceText) {
      translatedTextInput.value = 'Please enter text to translate.';
      return;
    }

    chrome.storage.sync.get(['apiKeyChatGPT', 'apiKeyGemini'], async (keys) => {
      let apiKey;
      if (selectedAPI === 'chatgpt') {
        apiKey = keys.apiKeyChatGPT;
      } else if (selectedAPI === 'gemini') {
        apiKey = keys.apiKeyGemini;
      }

      if (!apiKey) {
        translatedTextInput.value = `API key for ${selectedAPI} is not set.`;
        return;
      }

      translatedTextInput.value = 'Translating...';

      try {
        // Send message to background script to perform translation
        chrome.runtime.sendMessage(
          {
            action: 'translate',
            text: sourceText,
            supplementaryText: supplementaryTextValue,
            sourceLang: sourceLang,
            targetLang: targetLang,
            api: selectedAPI,
            model: selectedModel, // 選択されたモデルを渡す
            apiKey: apiKey
          },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error('Error sending message to background:', chrome.runtime.lastError.message);
              translatedTextInput.value = 'Error: Could not connect to background script.';
              return;
            }
            if (response) {
              if (response.error) {
                translatedTextInput.value = `Error: ${response.error}`;
              } else if (response.translation) {
                translatedTextInput.value = response.translation;
              } else {
                translatedTextInput.value = 'Error: Unexpected response from background script.';
              }
            } else {
               translatedTextInput.value = 'Error: No response from background script.';
            }
          }
        );
      } catch (error) {
        console.error('Translation error:', error);
        translatedTextInput.value = `Error: ${error.message}`;
      }
    });
  });

  // models.jsonを読み込む
  loadModels();

  // 翻訳履歴を読み込んで表示
  chrome.storage.sync.get([TRANSLATION_HISTORY_KEY], (result) => {
    const history = result[TRANSLATION_HISTORY_KEY] || [];
    console.log('Translation history loaded:', history); // 読み込まれたデータを確認するログを追加
    displayHistory(history);
  });

  // 翻訳履歴を表示する関数
  function displayHistory(history) {
    historyList.innerHTML = ''; // 現在のリストをクリア
    if (history.length === 0) {
      historyList.innerHTML = '<p>No translation history yet.</p>';
      return;
    }

    history.forEach((item, index) => {
      const historyItemDiv = document.createElement('div');
      historyItemDiv.classList.add('history-item'); // スタイルのためのクラスを追加
      historyItemDiv.innerHTML = `
        <div class="history-source">${escapeHTML(item.sourceText)}</div>
        <div class="history-translated">${escapeHTML(item.translatedText)}</div>
        <div class="history-meta">
          ${item.api} (${item.model}) - ${new Date(item.timestamp).toLocaleString()}
        </div>
        <button class="delete-history-item" data-index="${index}">Delete</button>
      `;
      // 履歴項目クリックでテキストエリアに反映
      historyItemDiv.addEventListener('click', () => {
        sourceTextInput.value = item.sourceText;
        translatedTextInput.value = item.translatedText;
        // 補足情報テキストエリアもあれば反映
        if (supplementaryTextInput) {
          supplementaryTextInput.value = item.supplementaryText || '';
        }
      });
      historyList.appendChild(historyItemDiv);
    });
  }

  // 履歴クリアボタンのクリックイベントリスナー
  clearHistoryButton.addEventListener('click', () => {
    chrome.storage.sync.remove(TRANSLATION_HISTORY_KEY, () => {
      console.log('Translation history cleared.');
      displayHistory([]); // 表示をクリア
    });
  });

  // 翻訳内容クリアボタンのクリックイベントリスナー
  const clearTextButton = document.getElementById('clear-text-button');
  clearTextButton.addEventListener('click', () => {
    sourceTextInput.value = '';
    translatedTextInput.value = '';
    if (supplementaryTextInput) {
      supplementaryTextInput.value = '';
    }
  });

  // HTMLエスケープ処理（セキュリティのため）
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  // background.jsからの履歴更新通知を受け取る
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'updateHistory') {
      console.log('Received updateHistory message from background.js');
      try {
        chrome.storage.sync.get([TRANSLATION_HISTORY_KEY], (result) => {
          const history = result[TRANSLATION_HISTORY_KEY] || [];
          displayHistory(history);
        });
      } catch (error) {
        console.error('Error handling updateHistory message:', error);
      }
    }
  });
});
