document.addEventListener('DOMContentLoaded', () => {
  // 要素の取得
  const elements = {
    inputs: {
      sourceText: document.getElementById('mini-source-text'),
      translatedText: document.getElementById('mini-translated-text')
    },
    selects: {
      sourceLanguage: document.getElementById('mini-source-language'),
      targetLanguage: document.getElementById('mini-target-language')
    },
    buttons: {
      swapLanguages: document.getElementById('mini-swap-languages'),
      translate: document.getElementById('mini-translate-button'),
      copy: document.getElementById('mini-copy-button'),
      expand: document.getElementById('mini-expand-button')
    }
  };

  // 初期化
  function initialize() {
    loadSavedData();
    setupEventListeners();
    loadSelectedText();
  }

  // 保存されたデータを読み込む
  function loadSavedData() {
    chrome.storage.sync.get(['sourceLang', 'targetLang'], (data) => {
      if (data.sourceLang) elements.selects.sourceLanguage.value = data.sourceLang;
      if (data.targetLang) elements.selects.targetLanguage.value = data.targetLang;
    });
  }

  // 選択されたテキストを読み込む
  function loadSelectedText() {
    chrome.storage.local.get(['selectedTextForTranslation'], (data) => {
      if (data.selectedTextForTranslation) {
        elements.inputs.sourceText.value = data.selectedTextForTranslation;
        chrome.storage.local.remove('selectedTextForTranslation');
        handleTranslation(); // 自動的に翻訳を開始
      }
    });
  }

  // イベントリスナーの設定
  function setupEventListeners() {
    elements.buttons.swapLanguages.addEventListener('click', swapLanguages);
    elements.buttons.translate.addEventListener('click', handleTranslation);
    elements.buttons.copy.addEventListener('click', copyTranslation);
    elements.buttons.expand.addEventListener('click', expandToFullPopup);
    elements.selects.sourceLanguage.addEventListener('change', saveLanguageSettings);
    elements.selects.targetLanguage.addEventListener('change', saveLanguageSettings);
  }

  // 言語設定を保存
  function saveLanguageSettings() {
    chrome.storage.sync.set({
      sourceLang: elements.selects.sourceLanguage.value,
      targetLang: elements.selects.targetLanguage.value
    });
  }

  // 言語の入れ替え
  function swapLanguages() {
    const sourceLang = elements.selects.sourceLanguage.value;
    const targetLang = elements.selects.targetLanguage.value;
    
    if (sourceLang !== 'auto') {
      elements.selects.sourceLanguage.value = targetLang;
      elements.selects.targetLanguage.value = sourceLang;
      saveLanguageSettings();
    }
  }

  // 翻訳の実行
  async function handleTranslation() {
    const sourceText = elements.inputs.sourceText.value.trim();
    if (!sourceText) {
      elements.inputs.translatedText.value = '翻訳するテキストを入力してください。';
      return;
    }

    elements.inputs.translatedText.value = '翻訳中...';

    // APIキーと設定を取得
    chrome.storage.sync.get(['apiKeyChatGPT', 'apiKeyGemini', 'selectedAPI', 'selectedModel'], async (data) => {
      const selectedAPI = data.selectedAPI || 'gemini';
      const apiKey = selectedAPI === 'chatgpt' ? data.apiKeyChatGPT : data.apiKeyGemini;

      if (!apiKey) {
        elements.inputs.translatedText.value = `${selectedAPI}のAPIキーが設定されていません。`;
        return;
      }

      // 翻訳リクエストの送信
      chrome.runtime.sendMessage({
        action: 'translate',
        text: sourceText,
        sourceLang: elements.selects.sourceLanguage.value,
        targetLang: elements.selects.targetLanguage.value,
        api: selectedAPI,
        model: data.selectedModel,
        apiKey: apiKey
      }, handleTranslationResponse);
    });
  }

  // 翻訳レスポンスの処理
  function handleTranslationResponse(response) {
    if (chrome.runtime.lastError) {
      elements.inputs.translatedText.value = 'エラー: バックグラウンドスクリプトに接続できません。';
      return;
    }

    if (!response) {
      elements.inputs.translatedText.value = 'エラー: バックグラウンドスクリプトからの応答がありません。';
      return;
    }

    if (response.error) {
      elements.inputs.translatedText.value = `エラー: ${response.error}`;
    } else if (response.translation) {
      elements.inputs.translatedText.value = response.translation;
    } else {
      elements.inputs.translatedText.value = 'エラー: 予期しない応答形式です。';
    }
  }

  // 翻訳テキストのコピー
  function copyTranslation() {
    const translationText = elements.inputs.translatedText.value;
    navigator.clipboard.writeText(translationText)
      .then(() => {
        const originalText = elements.buttons.copy.textContent;
        elements.buttons.copy.textContent = '✓';
        setTimeout(() => {
          elements.buttons.copy.innerHTML = '&#x2398;';
        }, 1000);
      })
      .catch(err => console.error('Failed to copy translation: ', err));
  }

  // フルポップアップに展開
  function expandToFullPopup() {
    chrome.storage.local.set({
      expandedText: elements.inputs.sourceText.value,
      expandedTranslation: elements.inputs.translatedText.value
    }, () => {
      chrome.runtime.sendMessage({ action: 'openFullPopup' });
    });
  }

  // 初期化の実行
  initialize();
}); 