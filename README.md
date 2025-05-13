# AI Translator Chrome Extension

[English](#english) | [日本語](#japanese)

## English

A Chrome extension that provides translation using ChatGPT or Gemini AI models.

### Security Information

#### API Key Handling
- API keys are stored only in local Chrome Storage and are never sent to external servers
- Each user must use their own API key
- API keys are stored in encrypted format

#### Data Handling
- Translation text and history are stored locally only
- History data is limited to 20 entries, with older data automatically deleted
- Text length is restricted (1000 characters for source text, 500 characters for additional information)

#### Privacy
- Selected text is sent only to the API provider (OpenAI or Google)
- Only minimal information necessary for translation is transmitted
- History data is stored only in the user's browser

### Installation

1. Clone or download this repository
2. Open Chrome extension management page (chrome://extensions/)
3. Enable "Developer mode"
4. Click "Load unpacked extension"
5. Select the cloned directory

### API Key Setup

1. Get OpenAI API Key (for ChatGPT)
   - Create an account at [OpenAI website](https://platform.openai.com/)
   - Generate API key

2. Get Google Cloud API Key (for Gemini)
   - Create a project in [Google Cloud Console](https://console.cloud.google.com/)
   - Enable Gemini API
   - Generate API key

3. Enter the API key in the extension settings

### Important Notes

- This tool is intended for educational and personal use
- Avoid translating text containing sensitive or personal information
- Check each provider's terms regarding API usage limits and fees

### License

MIT License

---

## Japanese

Chrome拡張機能を使用してChatGPTまたはGeminiで翻訳を行うツールです。

### セキュリティ情報

#### APIキーの取り扱い
- APIキーはローカルのChrome Storageにのみ保存され、外部サーバーには送信されません
- 各ユーザーは自身のAPIキーを使用する必要があります
- APIキーは暗号化されて保存されます

#### データの取り扱い
- 翻訳テキストと履歴はローカルにのみ保存されます
- 履歴データは最大20件まで保存され、古いデータは自動的に削除されます
- テキストの長さは制限されています（原文1000文字、補足情報500文字まで）

#### プライバシー
- 選択したテキストはAPIプロバイダー（OpenAIまたはGoogle）にのみ送信されます
- 送信されるデータは翻訳に必要な最小限の情報のみです
- 履歴データはユーザーのブラウザ内にのみ保存されます

### インストール方法

1. このリポジトリをクローンまたはダウンロード
2. Chrome拡張機能の管理ページを開く（chrome://extensions/）
3. 「デベロッパーモード」を有効化
4. 「パッケージ化されていない拡張機能を読み込む」をクリック
5. クローンしたディレクトリを選択

### APIキーの設定

1. OpenAI APIキーの取得（ChatGPT使用時）
   - [OpenAIのウェブサイト](https://platform.openai.com/)でアカウントを作成
   - APIキーを生成

2. Google Cloud APIキーの取得（Gemini使用時）
   - [Google Cloud Console](https://console.cloud.google.com/)でプロジェクトを作成
   - Gemini APIを有効化
   - APIキーを生成

3. 拡張機能の設定画面でAPIキーを入力

### 注意事項

- このツールは教育目的および個人使用を想定しています
- 機密情報や個人情報を含むテキストの翻訳は避けてください
- APIの利用制限や料金については、各プロバイダーの規約を確認してください

### ライセンス

MITライセンス 