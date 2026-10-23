# Pi Web

[English](../README.md) | [简体中文](./README.zh-CN.md) | [Русский](./README.ru.md)

[pi コーディングエージェント](https://github.com/earendil-works/pi) のローカルブラウザー UI です。Pi Web は pi と同じローカル設定とセッションファイルを使用し、ブラウザーから会話の検索と再開、エージェントの実行、モデルやリソースの設定、プロジェクトファイルの確認を行えます。

**このリポジトリは `pi-web-remote` フォークです。** npm パッケージ名は **`@hzrshz/pi-web-remote`**、インストール後のコマンドは **`pi-web-remote`** になります。上流の [agegr/pi-web](https://github.com/agegr/pi-web) の機能に加えて、1 コマンドのリモートアクセス（`--remote`、Cloudflare クイクトンネルまたは Tailscale アドレス経由。[リモートアクセス](#リモートアクセス)を参照）と、Node.js ランタイムを同梱したプラットフォーム別ポータブルバンドル（[ポータブルバンドル](#ポータブルバンドルオフラインインストール)を参照）を提供します。

**[インタラクティブデモを試す →](https://agegr.github.io/pi-web/)**：実際の Pi Web UI がブラウザー内だけで動作し、サンプルのセッション、ファイル、モデルを確認できます。インストールは不要です。返信はあらかじめ用意された内容で、モデルは呼び出しません。

![構造化された Markdown、ツール呼び出し、プロジェクトナビゲーションとともに pi セッションを表示する Pi Web](https://raw.githubusercontent.com/agegr/pi-web/main/docs/screenshot2.png)

## 機能

- **セッションワークスペース**：プロジェクトごとに会話を閲覧、再開、名前変更、エクスポート、削除し、実行状態、コンテキスト使用量、コスト、コンパクション情報を確認できます。
- **2 種類の分岐**：**New session** は以前のメッセージから独立したセッションファイルを作成し、**Edit from here** は現在のセッション内にブランチを作成します。
- **プロジェクトファイルツール**：ファイルの閲覧とアップロード、Git Diff の確認、ソース、Markdown、画像、音声、PDF、DOCX のプレビューに対応し、変更時は自動更新されます。
- **Git worktree**：同じリポジトリのセッションをまとめたまま、サイドバーからチェックアウトを切り替えられます。
- **Web での設定**：Pi Web を離れずに、Provider のログインと API Key、モデル、モデルテスト、プラグインパッケージ、スキルを管理できます。
- **1 コマンドのリモートアクセス**：`--remote` で UI を公衆トンネルまたは tailnet の後ろに置き、スマートフォンで読み取る QR コードを表示します。
- **英語、簡体字中国語、繁体字中国語の UI**：初回はブラウザーの言語に従い、トップバーから言語を切り替えられます。

## クイックスタート

Pi Web には Node.js 22.19.0 以降が必要です。`node --version` でバージョンを確認してから、次を実行します：

```bash
npx @hzrshz/pi-web-remote@latest
```

サーバーの準備が整うと、CLI はブラウザーを自動的に開こうとします。開かない場合は [http://127.0.0.1:30141](http://127.0.0.1:30141) にアクセスしてください。Pi Web はデフォルトで `127.0.0.1` のみをリッスンします。

モデル Provider が未設定の場合は、**Models** パネルを開いてログインするか API Key を追加してください。

`pi-web-remote` コマンドをグローバルにインストールする場合：

```bash
npm install -g @hzrshz/pi-web-remote@latest
pi-web-remote
```

コマンド：

```bash
pi-web-remote version          # インストール済みのバージョンを表示
pi-web-remote status           # 実行中のサーバーを一覧表示
pi-web-remote stop [--port N]  # 実行中のサーバーを停止
pi-web-remote open [--port N]  # 実行中のサーバーをブラウザーで開く
pi-web-remote update [--check] # グローバル npm インストールを更新
```

更新時は `pi-web-remote stop` を実行してから `pi-web-remote update` を実行します（同じインストールコマンドの再実行でも構いません）。アンインストールするには `npm uninstall -g @hzrshz/pi-web-remote` を実行します。

`pi-web-remote update` はこのパッケージのグローバル npm インストールのみを更新します。別の名前のものでインストールし直すことはしないので、上流の `@agegr/pi-web` は影響を受けません。

### ポータブルバンドル（オフラインインストール）

各 [Release](https://github.com/bluesky4485/pi-web/releases) には、プラットフォーム別に自己完結したポータブルバンドルも同梱されます。検証済みの Node.js ランタイムと本番依存関係を内包しているため、コピー先のマシンには Node.js もインターネット接続も不要です：

| バンドル | 動作する環境 |
| --- | --- |
| `pi-web-remote-v<version>-linux-x64.tar.gz` | Linux x86-64 |
| `pi-web-remote-v<version>-linux-arm64.tar.gz` | Linux arm64 |
| `pi-web-remote-v<version>-mac-arm64.tar.gz` | Apple Silicon の macOS |
| `pi-web-remote-v<version>-win-x64.zip` | Windows x64 |

任意の場所に展開し、そのフォルダにあるランチャーを実行するだけです（macOS/Linux は `./pi-web-remote`、Windows は `pi-web-remote.cmd`）。システムには何も書き込まず、ランチャーはバンドル内のランタイムを必ず使用するので、マシンに偶然入っている Node.js は使われません：

```bash
tar -xzf pi-web-remote-v1.0.0-linux-x64.tar.gz
cd pi-web-remote-v1.0.0-linux-x64
./pi-web-remote --remote
```

`node_modules` にプラットフォーム固有のネイティブバイナリが含まれるため、バンドルは作成対象としたプラットフォームでのみ動作します。対応するバンドルを使うか、npm からインストールしてください。バンドルの更新は新しい Release を同じ名前のフォルダに展開して置き換えます。セッション、設定、API Key は pi 自身のエージェントディレクトリ（`~/.pi/agent`、pi CLI と共通）に保存されるので、フォルダの入れ替えでは失われません。

## 設定

ポートとホスト名では、コマンドラインオプションが対応する環境変数より優先されます。`--no-open` と `PI_WEB_NO_OPEN=1` は、どちらを指定してもブラウザーの自動起動が無効になります。`pi-web-remote --help`（または `-h`）で起動オプションを表示して終了します。未知のオプションはエラーで終了します。

| オプションまたは環境変数 | 用途 | デフォルト |
| --- | --- | --- |
| `--help`、`-h` | 起動オプションを表示して終了 | — |
| `--port <port>`、`-p <port>`、または `PORT` | サーバーポート | `30141` |
| `--hostname <host>`、`-H <host>`、または `PI_WEB_HOSTNAME` | バインドするホスト名 | `127.0.0.1` |
| `--remote[=mode]` | Pi Web をリモート公開：`cloudflare`（デフォルト）、`tailscale`、`both`。[リモートアクセス](#リモートアクセス)を参照 | 無効 |
| `--no-open` または `PI_WEB_NO_OPEN=1` | ブラウザーを自動的に開かない | 自動的に開く |
| `PI_WEB_ALLOWED_HOSTS` | 追加で許可するプロキシまたはカスタムホスト名。複数指定はカンマ区切りで完全一致 | 未設定 |
| `PI_WEB_PASSWORD` | ブラウザーのパスワードログインを有効化。API はユーザー名 `pi` の Basic Auth も利用可能 | 認証なし |

例：

```bash
pi-web-remote --help
pi-web-remote -p 8080 -H 0.0.0.0 --no-open
```

### リモートアクセス

`--remote` は、トンネルを自分で設定せずに Pi Web をこのマシン外へ公開します。Pi Web がトンネル自体を起動し、パスワードを必須にしたうえで、アドレスとスマートフォンで読み取れる QR コードを表示します：

```bash
pi-web-remote --remote
```

```text
[pi-web-remote] Remote access enabled:
  https://a-random-hostname.trycloudflare.com

  Scan to open: https://a-random-hostname.trycloudflare.com
  <そのアドレスの QR コード>

  Password (log in with this on remote devices): 2db7e02e4e3ff9ec
```

| オプション | 動作 | 前提 |
| --- | --- | --- |
| `--remote` または `--remote=cloudflare` | Pi Web は `127.0.0.1` にバインドしたまま、前に Cloudflare クイクトンネルを置きます。ネットワーク上にポートを開く必要はありません。トンネルが取得した `*.trycloudflare.com` ホストは `PI_WEB_ALLOWED_HOSTS` に自動で追加されます。 | `cloudflared` のインストール済み |
| `--remote=tailscale` | このマシンの Tailscale アドレス（`100.x.y.z`）にバインドし、同じ tailnet 内のデバイスからだけアクセスできるようにします。通信は第三者を経由しません。 | Tailscale が接続済み |
| `--remote=both` | Tailscale アドレスにバインドしたうえで、それを Cloudflare 経由でもトンネルします。両方のアドレスが同時に使えます。 | 上記の両方 |

mode を誤ると起動前に失敗します：`Invalid --remote value "…". Use: cloudflare (default), tailscale, or both.`

リモートアクセスを有効にすると、サーバー自体は次のように変わります：

- **パスワードが必須になります。** `PI_WEB_PASSWORD` が未設定なら、Pi Web がランダムな値を生成し、上の出力に 1 回だけ表示します。値を自分で決める、または再起動後も同じものを使いたい場合は明示的に設定してください：`PI_WEB_PASSWORD='十分に長いランダムなパスワード' pi-web-remote --remote`。
- **トンネルとプロセスは運命を共にします。** `cloudflared` が終了するとトンネル URL は死ぬので、Pi Web も停止します。Pi Web を止めればトンネルも止まります。
- **API クライアントは Basic Auth** を使います。ユーザー名は `pi`、パスワードは `PI_WEB_PASSWORD` です。
- **クイクトンネルは使い捨てです。** 起動のたびに新しいランダムな `trycloudflare.com` ホストになり、無料のクイクトンネルにはレート制限があって稼働も保証されません。固定のホスト名が必要なら、Named Tunnel か任意のリバースプロキシを自分で運用し、`--hostname` と `PI_WEB_PASSWORD` を指定して Pi Web を起動してください。

#### cloudflared のインストール

Pi Web は `cloudflared` を同梱しません：インストール済みの CLI を起動するだけです。`PATH` に見つからない場合、`--remote` はエラーで終了します。いずれの方法も `cloudflared --version` で確認できます。パッケージの完全な一覧は [Cloudflare Tunnel downloads](https://developers.cloudflare.com/tunnel/downloads/) にあります。

**macOS**（Apple Silicon / Intel ともに）：

```bash
brew install cloudflared
```

**Windows** —— どちらのパッケージマネージャーも `cloudflared` を `PATH` に置きます：

```powershell
winget install --id Cloudflare.cloudflared
choco install cloudflared
```

**Debian / Ubuntu** —— 公式 apt リポジトリ（更新も一緒に管理されます）：

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

**Fedora / RHEL / CentOS / Stream** —— 公式 yum/dnf リポジトリ：

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflared.repo \
  | sudo tee /etc/yum.repos.d/cloudflared.repo
sudo dnf install cloudflared
```

**リポジトリを使わない場合（任意の Linux）** —— 単体バイナリを展開して `PATH` の上に置きます：

```bash
# x86-64。arm64（64 ビットの Raspberry Pi OS を含む）は cloudflared-linux-arm64 を使用
curl -L --output cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
```

同じリリースページには `.deb`（`cloudflared-linux-amd64.deb`、`cloudflared-linux-arm64.deb`）と `.rpm`（`cloudflared-linux-x86_64.rpm`、`cloudflared-linux-aarch64.rpm`）もあり、`dpkg -i` / `rpm -ivh` での単発インストールにも対応します。

**Tailscale** は `--remote=tailscale` のために追加の手間がほぼ不要です：このオプションは `tailscale ip -4` からアドレスを読むだけで、クライアントが未接続なら `--remote=tailscale requires Tailscale to be connected` と表示して終了します。未インストールの場合は [tailscale.com/download](https://tailscale.com/download) を参照してください。

#### `--remote` を使わずに公開する

ループバック以外のアドレスにバインドすると、高い権限の操作を実行できるエージェントがネットワークに公開されます。信頼できる LAN で使用する場合も、十分に長いランダムなパスワードを設定してください：

```bash
PI_WEB_PASSWORD='十分に長いランダムなパスワード' pi-web-remote --hostname 0.0.0.0
```

パスワード認証は接続を暗号化しません。平文 HTTP で Pi Web をインターネットに公開せず、信頼できるリバースプロキシによる HTTPS または信頼できる VPN を使用してください。リバースプロキシが外部ホスト名を転送する場合は、その名前を完全一致で `PI_WEB_ALLOWED_HOSTS` に追加します。この許可リストは Pi Web のバインド先を変更しません。

### HTTP プロキシ

サーバー側のモデルリクエストと API リクエストは、標準の `HTTP_PROXY`、`HTTPS_PROXY`、`NO_PROXY` 環境変数を使用します。

macOS または Linux：

```bash
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1 \
npx @hzrshz/pi-web-remote@latest
```

Windows PowerShell：

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:NO_PROXY = "localhost,127.0.0.1"
npx @hzrshz/pi-web-remote@latest
```

## 注意事項

- **エージェントデータ**：Pi Web はデフォルトで `~/.pi/agent` の pi データを読み込みます。セッションファイルは `sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl` にあります。別の pi エージェントディレクトリを使用するには `PI_CODING_AGENT_DIR` を設定してください。
- **ファイルシステムへのアクセス**：Pi Web はエージェントデータディレクトリと、セッションに記録された作業ディレクトリを読み取れる必要があります。既存の pi セッションを共有する場合は、pi と同じファイルシステム環境で Pi Web を実行してください。
- **共有設定**：Models パネルは pi のモデル、設定、認証情報ストレージを使用するため、変更は両方のインターフェースに反映されます。
- **ファイルアクセスの範囲**：ファイルブラウザーは、Pi Web で選択した作業ディレクトリと、既知のプロジェクトまたはセッションルートに限定されます。汎用のファイルシステムブラウザーではありません。
- **Git worktree**：スイッチャーの表示条件、worktree の作成、削除時の動作については [Worktrees in Pi Web](./worktrees.md) を参照してください。

## 開発

```bash
npm install
npm run dev
```

開発サーバーは [http://127.0.0.1:30141](http://127.0.0.1:30141) で動作します。一般的なチェックは次のコマンドで実行します：

```bash
npm test
node_modules/.bin/tsc --noEmit
npm run lint
```

通常の開発中は `next build` または `npm run build` を実行しないでください。`.next/` に書き込まれ、開発サーバーに影響する可能性があります。ビルドはリリース作業時にのみ実行してください。

新機能に取りかかる前に、[Contributing](../CONTRIBUTING.md) で対象範囲とプルリクエスト前のチェック項目を確認してください。

コントリビューター向けガイド：[Internationalization](./i18n.md) と [Release process](./release.md)。

## リポジトリ構成

```text
app/             Next.js UI と API ルート
components/      React UI コンポーネント
hooks/           クライアントの状態と操作に関する hooks
lib/             セッション、エージェント、モデル、ファイル、Git、セキュリティのロジック
public/          静的アセットと PWA ファイル
bin/             npm CLI エントリポイントと起動オプションの解析
scripts/         ポータブルバンドルの作成と検証スクリプト
docs/            ユーザーおよびコントリビューター向けの個別ガイド
demo/            GitHub Pages で公開する静的デモ（demo/README.md を参照）
```

アーキテクチャの説明と詳細なファイルマップについては [AGENTS.md](../AGENTS.md) を参照してください。

## ライセンス

[MIT](../LICENSE)
