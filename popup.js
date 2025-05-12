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
  const supplementaryText = document.getElementById('supplementary-text');
  const translateButton = document.getElementById('translate-button');
  const modelSelect = document.getElementById('model-select'); // モデル選択ドロップダウンの要素を取得
  const historyList = document.getElementById('history-list'); // 翻訳履歴リストの要素を取得

  const TRANSLATION_HISTORY_KEY = 'translationHistory'; // background.jsと合わせる

  let models = {}; // models.jsonから読み込んだモデル情報を保持する変数

  // models.jsonを読み込む関数
  async function loadModels() {
    try {
      const response = await fetch(chrome.runtime.getURL('models.json'));
      if (!response.ok) {
        throw new Error(`Failed to load models.json: ${response.statusText}`);
      }
      models = await response.json();
      console.log('Models loaded:', models);
      updateModelSelect(); // モデル選択ドロップダウンを更新
    } catch (error) {
      console.error('Error loading models.json:', error);
    }
  }

  // モデル選択ドロップダウンを更新する関数
  function updateModelSelect() {
    const selectedAPI = apiSelect.value;
    const apiModels = models[selectedAPI] || [];

    // 現在のオプションをクリア
    modelSelect.innerHTML = '';

    // 新しいオプションを追加
    apiModels.forEach(model => {
      const option = document.createElement('option');
      option.value = model;
      option.textContent = model;
      modelSelect.appendChild(option);
    });

    // 保存されているモデルを選択、なければ最初のモデルを選択
    chrome.storage.sync.get(['selectedModel'], (data) => {
      if (data.selectedModel && apiModels.includes(data.selectedModel)) {
        modelSelect.value = data.selectedModel;
      } else if (apiModels.length > 0) {
        modelSelect.value = apiModels[0];
      }
    });
  }

  // Load saved API keys and preferences and selected text
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

    // ポップアップが開かれたときに保存された選択テキストを読み込み、自動翻訳を実行
    chrome.storage.local.get(['selectedTextForTranslation'], (localData) => {
      if (localData.selectedTextForTranslation) {
        sourceTextInput.value = localData.selectedTextForTranslation;
        // テキストを読み込んだらストレージから削除
        chrome.storage.local.remove('selectedTextForTranslation', () => {
          console.log('Selected text removed from local storage.');
        });
        // 自動的に翻訳ボタンをクリック
        translateButton.click();
      }
    });
  });

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
            supplementaryText: supplementaryText.value, // 補足情報を追加
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

    history.forEach(item => {
      const historyItemDiv = document.createElement('div');
      historyItemDiv.classList.add('history-item'); // スタイルのためのクラスを追加
      historyItemDiv.innerHTML = `
        <div class="history-source">${escapeHTML(item.sourceText)}</div>
        <div class="history-translated">${escapeHTML(item.translatedText)}</div>
        <div class="history-meta">
          ${item.api} (${item.model}) - ${new Date(item.timestamp).toLocaleString()}
        </div>
      `;
      // 履歴項目クリックでテキストエリアに反映（オプション）
      // historyItemDiv.addEventListener('click', () => {
      //   sourceTextInput.value = item.sourceText;
      //   translatedTextInput.value = item.translatedText;
      // });
      historyList.appendChild(historyItemDiv);
    });
  }

  // HTMLエスケープ処理（セキュリティのため）
  function escapeHTML(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }
});
