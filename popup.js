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
  const translateButton = document.getElementById('translate-button');

  // Load saved API keys and preferences
  chrome.storage.sync.get(['apiKeyChatGPT', 'apiKeyGemini', 'selectedAPI', 'sourceLang', 'targetLang'], (data) => {
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
  });

  // Save API keys
  saveKeysButton.addEventListener('click', () => {
    const apiKeyChatGPT = apiKeyChatGPTInput.value.trim();
    const apiKeyGemini = apiKeyGeminiInput.value.trim();
    chrome.storage.sync.set({ apiKeyChatGPT, apiKeyGemini }, () => {
      alert('API keys saved!');
    });
  });

  // Save selected API
  apiSelect.addEventListener('change', () => {
    chrome.storage.sync.set({ selectedAPI: apiSelect.value });
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
            sourceLang: sourceLang,
            targetLang: targetLang,
            api: selectedAPI,
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
});
