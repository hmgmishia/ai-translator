let models = {}; // models.jsonから読み込んだモデル情報を保持する変数

// models.jsonを読み込む関数
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

// 拡張機能インストール時にデフォルト設定を保存
chrome.runtime.onInstalled.addListener(() => {
  console.log('AI Translator extension installed.');
  // デフォルトモデルをgpt-4o-miniに設定
  chrome.storage.sync.set({ selectedModel: 'gpt-4o-mini' }, () => {
    console.log('Default model set to gpt-4o-mini');
  });
  // models.jsonを読み込む
  loadModels();
});

// Keep the service worker alive
chrome.runtime.onStartup.addListener(() => {
  console.log('AI Translator extension started.');
  // models.jsonを読み込む
  loadModels();
});


chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    const { text, sourceLang, targetLang, api, model, apiKey } = request; // modelパラメータを追加

    let apiUrl = '';
    let headers = {
      'Content-Type': 'application/json'
    };
    let body = {};

    const sourceLangPrompt = sourceLang === 'auto' ? 'Detect language and translate' : `Translate from ${getLanguageName(sourceLang)}`;
    const prompt = `${sourceLangPrompt} to ${getLanguageName(targetLang)}: "${text}"`;

    // モデルがmodels.jsonに存在するか確認 (オプション)
    // if (!models[api] || !models[api].includes(model)) {
    //   sendResponse({ error: `Invalid model selected for ${api}: ${model}` });
    //   return true;
    // }

    if (api === 'chatgpt') {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      headers['Authorization'] = `Bearer ${apiKey}`;
      body = {
        model: model, // リクエストで受け取ったモデルを使用
        messages: [
          { role: 'system', content: 'You are a translation assistant. Provide only the translated text without any additional comments or explanations.' }, // システムプロンプトを追加
          { role: 'user', content: prompt }
        ],
        temperature: 0.3, // Adjust for desired creativity/accuracy
      };
    } else if (api === 'gemini') {
      // Note: The Gemini API endpoint and request structure might differ.
      // This is a placeholder and needs to be adjusted based on the actual Gemini API documentation.
      // Gemini APIでのシステムプロンプトの指定方法はAPIドキュメントに依存します。
      // Gemini APIでのシステムプロンプトの指定方法はAPIドキュメントに依存します。
      // ここでは、ユーザープロンプトの前にシステム的な指示を追加する例を示します。
      apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`; // モデル名をURLに含める例
      body = {
        contents: [
          { role: 'user', parts: [{ text: 'Provide only the translated text without any additional comments or explanations.' }] }, // システム的な指示をuserロールで追加
          { role: 'user', parts: [{ text: prompt }] } // 実際のユーザープロンプトをuserロールで追加
        ],
        // generationConfig: { // Optional: configure generation parameters
        //   temperature: 0.3,
        // }
      };
    } else {
      sendResponse({ error: 'Invalid API selected' });
      return true; // Indicates that the response is sent asynchronously
    }

    fetch(apiUrl, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(body)
    })
    .then(response => {
      if (!response.ok) {
        return response.json().then(err => {
          console.error('API Error:', err);
          let errorMessage = `API request failed with status ${response.status}.`;
          if (err && err.error && err.error.message) {
            errorMessage += ` Message: ${err.error.message}`;
          } else if (err && err.message) {
             errorMessage += ` Message: ${err.message}`;
          }
          throw new Error(errorMessage);
        });
      }
      return response.json();
    })
    .then(data => {
      let translation = '';
      if (api === 'chatgpt') {
        if (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) {
          translation = data.choices[0].message.content.trim();
        } else {
          throw new Error('Unexpected response structure from ChatGPT API');
        }
      } else if (api === 'gemini') {
        // Adjust based on actual Gemini API response structure
        if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text) {
          translation = data.candidates[0].content.parts[0].text.trim();
        } else {
          console.error('Unexpected Gemini API response:', data);
          throw new Error('Unexpected response structure from Gemini API');
        }
      }
      sendResponse({ translation: translation });
    })
    .catch(error => {
      console.error('Translation fetch error:', error);
      sendResponse({ error: error.message || 'Failed to fetch translation.' });
    });

    return true; // Indicates that the response is sent asynchronously
  }
});

// Helper function to get full language names for the prompt
function getLanguageName(code) {
  const languageMap = {
    'en': 'English',
    'ja': 'Japanese',
    'es': 'Spanish',
    'fr': 'French',
    'de': 'German',
    'zh-CN': 'Chinese (Simplified)',
    'ko': 'Korean',
    // Add more as needed
  };
  return languageMap[code] || code; // Return code if name not found
}
