# Pi Web

[English](../README.md) | [中文文档](./README.zh-CN.md) | [日本語](./README.ja.md)

Локальный браузерный интерфейс для [pi coding agent](https://github.com/earendil-works/pi). Pi Web использует те же локальные настройки и файлы сессий, что и pi, поэтому в браузере можно находить и продолжать диалоги, запускать агента, настраивать модели и ресурсы, а также просматривать файлы проекта.

**Этот репозиторий — форк `pi-web-remote`.** Пакет на npm называется **`@hzrshz/pi-web-remote`**, установленная команда — **`pi-web-remote`**. По сравнению с апстримом [agegr/pi-web](https://github.com/agegr/pi-web) добавлены две вещи: удалённый доступ одной командой (`--remote` через Cloudflare quick tunnel или адрес Tailscale, см. [Удалённый доступ](#удалённый-доступ)) и переносимые сборки для каждой платформы вместе с собственным рантаймом Node.js (см. [Переносимая сборка](#переносимая-сборка-установка-без-интернета)).

**[Попробовать интерактивное демо →](https://agegr.github.io/pi-web/)** Настоящий интерфейс Pi Web работает прямо в браузере, с примерами сессий, файлов и моделей. Ничего устанавливать не нужно; ответы подготовлены заранее, модели не вызываются.

![Pi Web показывает сессию pi со структурированным Markdown, вызовами инструментов и навигацией по проекту](https://raw.githubusercontent.com/agegr/pi-web/main/docs/screenshot2.png)

## Возможности

- **Рабочее пространство сессий**: просмотр, продолжение, переименование, экспорт и удаление диалогов, сгруппированных по проектам, с отображением состояния выполнения, использования контекста, стоимости и сведений о сжатии.
- **Два способа создать ветку**: **New session** создаёт независимый файл сессии из более раннего сообщения, а **Edit from here** создаёт ветку внутри текущей сессии.
- **Инструменты для файлов проекта**: просмотр и загрузка файлов, проверка Git Diff, предпросмотр исходного кода, Markdown, изображений, аудио, PDF и DOCX с автоматическим обновлением.
- **Git worktree**: переключение рабочих деревьев в боковой панели с сохранением общей группы сессий одного репозитория.
- **Настройка через Web**: управление входом в Provider и API Key, моделями, тестами моделей, пакетами плагинов и навыками без выхода из Pi Web.
- **Удалённый доступ одной командой**: `--remote` выводит интерфейс за публичный туннель или в tailnet и печатает QR-код, который можно считать телефоном.
- **Интерфейс на английском, упрощённом и традиционном китайском**: при первом запуске Pi Web учитывает язык браузера, а затем язык можно переключить в верхней панели.

## Быстрый старт

Для работы Pi Web требуется Node.js 22.19.0 или новее. Проверьте версию командой `node --version`, затем выполните:

```bash
npx @hzrshz/pi-web-remote@latest
```

Когда сервер будет готов, CLI попытается открыть браузер автоматически. Если этого не произошло, откройте [http://127.0.0.1:30141](http://127.0.0.1:30141). По умолчанию Pi Web прослушивает только `127.0.0.1`.

Если Provider модели ещё не настроен, откройте панель **Models**, войдите в учётную запись или добавьте API Key.

Чтобы установить команду `pi-web-remote` глобально:

```bash
npm install -g @hzrshz/pi-web-remote@latest
pi-web-remote
```

Команды:

```bash
pi-web-remote version          # вывести установленную версию
pi-web-remote status           # список запущенных серверов
pi-web-remote stop [--port N]  # остановить запущенный сервер
pi-web-remote open [--port N]  # открыть запущенный сервер в браузере
pi-web-remote update [--check] # обновить глобальную установку npm
```

Для обновления выполните `pi-web-remote stop`, затем `pi-web-remote update` (или повторите ту же команду установки). Для удаления выполните `npm uninstall -g @hzrshz/pi-web-remote`.

`pi-web-remote update` обновляет только глобальную установку этого пакета и ничего не ставит под другим именем, так что апстрим-пакет `@agegr/pi-web` остаётся нетронутым.

### Переносимая сборка (установка без интернета)

В каждом [релизе](https://github.com/bluesky4485/pi-web/releases) есть также самодостаточная сборка для каждой платформы. Она включает проверенный рантайм Node.js и продакшн-зависимости, поэтому на машине, куда её копируют, не нужны ни Node.js, ни доступ в интернет:

| Сборка | Для чего |
| --- | --- |
| `pi-web-remote-v<версия>-linux-x64.tar.gz` | Linux x86-64 |
| `pi-web-remote-v<версия>-linux-arm64.tar.gz` | Linux arm64 |
| `pi-web-remote-v<версия>-mac-arm64.tar.gz` | macOS на Apple Silicon |
| `pi-web-remote-v<версия>-win-x64.zip` | Windows x64 |

Распакуйте архив в любое место и запустите находящийся рядом запускатель — `./pi-web-remote`, а в Windows `pi-web-remote.cmd`. Ничего в систему не устанавливается, и запускатель всегда использует рантайм из архива, а не тот Node.js, который случайно оказался в машине:

```bash
tar -xzf pi-web-remote-v1.0.0-linux-x64.tar.gz
cd pi-web-remote-v1.0.0-linux-x64
./pi-web-remote --remote
```

`node_modules` внутри сборки содержит платформенно-зависимые нативные бинарники, поэтому сборка работает только на той платформе, для которой собрана: берите соответствующий архив или устанавливайте из npm. Обновление сборки — это распаковка нового релиза на то же место: сессии, настройки и API Key хранятся в собственном каталоге агента pi (`~/.pi/agent`, тот же использует CLI pi) и переживают замену папки.

## Настройка

Для порта и имени хоста параметры командной строки имеют приоритет над соответствующими переменными окружения. И `--no-open`, и `PI_WEB_NO_OPEN=1` отключают автоматическое открытие браузера независимо друг от друга. `pi-web-remote --help` (или `-h`) выводит параметры запуска и завершает работу без старта сервера. Неизвестные параметры завершают процесс с ошибкой.

| Параметр или переменная окружения | Назначение | Значение по умолчанию |
| --- | --- | --- |
| `--help`, `-h` | Показать параметры запуска и выйти | — |
| `--port <port>`, `-p <port>` или `PORT` | Порт сервера | `30141` |
| `--hostname <host>`, `-H <host>` или `PI_WEB_HOSTNAME` | Имя хоста для привязки | `127.0.0.1` |
| `--remote[=режим]` | Открыть Pi Web вовне: `cloudflare` (по умолчанию), `tailscale` или `both`, см. [Удалённый доступ](#удалённый-доступ) | Выключено |
| `--no-open` или `PI_WEB_NO_OPEN=1` | Не открывать браузер автоматически | Браузер открывается |
| `PI_WEB_ALLOWED_HOSTS` | Дополнительные точные имена прокси или пользовательских хостов через запятую | Не задано |
| `PI_WEB_PASSWORD` | Включить вход по паролю в браузере; API также поддерживает Basic Auth с именем `pi` | Аутентификация отключена |

Пример:

```bash
pi-web-remote --help
pi-web-remote -p 8080 -H 0.0.0.0 --no-open
```

### Удалённый доступ

`--remote` открывает Pi Web за пределы этой машины без самостоятельной настройки туннеля. Pi Web сам запускает туннель, делает пароль обязательным и выводит адрес с QR-кодом:

```bash
pi-web-remote --remote
```

```text
[pi-web-remote] Remote access enabled:
  https://a-random-hostname.trycloudflare.com

  Scan to open: https://a-random-hostname.trycloudflare.com
  <QR-код этого адреса>

  Password (log in with this on remote devices): 2db7e02e4e3ff9ec
```

| Параметр | Что делает | Требует |
| --- | --- | --- |
| `--remote` или `--remote=cloudflare` | Pi Web остаётся привязан к `127.0.0.1`, а спереди ставится Cloudflare quick tunnel — ничего открывать в сети не нужно. Полученный хост `*.trycloudflare.com` автоматически добавляется в `PI_WEB_ALLOWED_HOSTS`. | установленный `cloudflared` |
| `--remote=tailscale` | Pi Web привязывается к адресу Tailscale этой машины (`100.x.y.z`), так что доступ есть только у устройств вашего tailnet. Трафик не проходит через третьи стороны. | подключённый Tailscale |
| `--remote=both` | Привязка к адресу Tailscale **плюс** тот же туннель Cloudflare поверх него; работают оба адреса. | и то и другое |

Неверный режим приводит к ошибке ещё до запуска: `Invalid --remote value "…". Use: cloudflare (default), tailscale, or both.`

Что меняется в самом сервере:

- **Пароль становится обязательным.** Если `PI_WEB_PASSWORD` не задан, Pi Web генерирует случайный и печатает его ровно один раз — в блоке выше. Задайте его сами, чтобы выбрать значение или сохранить его между перезапусками: `PI_WEB_PASSWORD='длинный-случайный-пароль' pi-web-remote --remote`.
- **Туннель живёт вместе с процессом.** Если `cloudflared` завершается, его URL мёртв, поэтому Pi Web тоже останавливается; остановка Pi Web убирает туннель.
- **API-клиенты проходят Basic Auth** с именем пользователя `pi` и паролем `PI_WEB_PASSWORD`.
- **Quick tunnel одноразовый.** При каждом запуске выдаётся новый случайный хост `trycloudflare.com`, бесплатные quick tunnel ограничены по частоте и без гарантий доступности. Нужен постоянный адрес — поднимите [named tunnel](https://developers.cloudflare.com/cloudflare-one/networks/connectors/cloudflared/) или любой обратный прокси сами и запустите Pi Web с `--hostname` и `PI_WEB_PASSWORD`.

### Установка cloudflared

Pi Web не включает `cloudflared` в себя: он лишь запускает тот CLI, который установили вы; если команда не найдена в `PATH`, `--remote` завершится с ошибкой. Любой из способов ниже проверяется командой `cloudflared --version`; полный список пакетов — на странице [Cloudflare Tunnel downloads](https://developers.cloudflare.com/tunnel/downloads/).

**macOS** (Apple Silicon и Intel):

```bash
brew install cloudflared
```

**Windows** — оба пакетных менеджера кладут `cloudflared` в `PATH`:

```powershell
winget install --id Cloudflare.cloudflared
choco install cloudflared
```

**Debian и Ubuntu** — официальный apt-репозиторий, клиент обновляется вместе с системой:

```bash
sudo mkdir -p --mode=0755 /usr/share/keyrings
curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg \
  | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo 'deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main' \
  | sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt-get update && sudo apt-get install cloudflared
```

**Fedora, RHEL, CentOS и Stream** — официальный yum/dnf-репозиторий:

```bash
curl -fsSL https://pkg.cloudflare.com/cloudflared.repo \
  | sudo tee /etc/yum.repos.d/cloudflared.repo
sudo dnf install cloudflared
```

**Любой Linux без репозитория** — одиночный бинарник, которому выдают право на исполнение и кладут на `PATH`:

```bash
# x86-64; для arm64 (включая 64-битный Raspberry Pi OS) берите cloudflared-linux-arm64
curl -L --output cloudflared \
  https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-amd64
chmod +x cloudflared && sudo mv cloudflared /usr/local/bin/
```

На той же странице релиза есть файлы `.deb` (`cloudflared-linux-amd64.deb`, `cloudflared-linux-arm64.deb`) и `.rpm` (`cloudflared-linux-x86_64.rpm`, `cloudflared-linux-aarch64.rpm`) — для установки разовым `dpkg -i` / `rpm -ivh`.

**Tailscale** для `--remote=tailscale` не требует ничего, кроме подключённого клиента: параметр просто читает адрес из `tailscale ip -4` и завершается с `--remote=tailscale requires Tailscale to be connected`, если клиент не подключён. Если Tailscale не установлен — [tailscale.com/download](https://tailscale.com/download).

### Открыть доступ без `--remote`

Привязка к адресу, отличному от loopback, открывает сетевой доступ к агенту, способному выполнять операции с широкими полномочиями. Даже в доверенной локальной сети используйте длинный случайный пароль:

```bash
PI_WEB_PASSWORD='длинный-случайный-пароль' pi-web-remote --hostname 0.0.0.0
```

Парольная аутентификация не шифрует соединение. Не публикуйте Pi Web в интернете по обычному HTTP; используйте HTTPS через доверенный обратный прокси или надёжное VPN-подключение. Если обратный прокси передаёт внешнее имя хоста, добавьте это точное имя в `PI_WEB_ALLOWED_HOSTS`. Этот список разрешённых имён не меняет адрес, к которому привязывается Pi Web.

### HTTP-прокси

Для серверных запросов к моделям и API используются стандартные переменные окружения `HTTP_PROXY`, `HTTPS_PROXY` и `NO_PROXY`.

В macOS и Linux:

```bash
HTTP_PROXY=http://127.0.0.1:7890 \
HTTPS_PROXY=http://127.0.0.1:7890 \
NO_PROXY=localhost,127.0.0.1 \
npx @hzrshz/pi-web-remote@latest
```

В Windows PowerShell:

```powershell
$env:HTTP_PROXY = "http://127.0.0.1:7890"
$env:HTTPS_PROXY = "http://127.0.0.1:7890"
$env:NO_PROXY = "localhost,127.0.0.1"
npx @hzrshz/pi-web-remote@latest
```

## Примечания

- **Данные агента**: по умолчанию Pi Web читает данные pi из `~/.pi/agent`, включая файлы сессий в `sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl`. Чтобы использовать другой каталог агента pi, задайте `PI_CODING_AGENT_DIR`.
- **Доступ к файловой системе**: Pi Web должен иметь доступ для чтения к каталогу данных агента и рабочим каталогам, записанным в сессиях. При совместном использовании существующих сессий запускайте Pi Web в той же файловой среде, что и pi.
- **Общие настройки**: панель Models использует хранилища моделей, настроек и учётных данных pi, поэтому изменения видны в обоих интерфейсах.
- **Граница доступа к файлам**: файловый браузер ограничен рабочими каталогами, выбранными в Pi Web, и уже известными корнями проектов или сессий; это не универсальный файловый менеджер.
- **Git worktree**: условия отображения переключателя, создание рабочих деревьев и их удаление описаны в документе [Worktrees in Pi Web](./worktrees.md).

## Разработка

```bash
npm install
npm run dev
```

Сервер разработки доступен по адресу [http://127.0.0.1:30141](http://127.0.0.1:30141). Основные проверки запускаются командами:

```bash
npm test
node_modules/.bin/tsc --noEmit
npm run lint
```

Не запускайте `next build` или `npm run build` во время обычной разработки. Эти команды записывают данные в `.next/` и могут помешать работе сервера разработки; выполняйте сборку только при подготовке релиза.

Прежде чем браться за новую функцию, прочитайте [Contributing](../CONTRIBUTING.md): там описано, какие изменения входят в рамки проекта, и что проверить перед pull request.

Руководства для участников: [Internationalization](./i18n.md) и [Release process](./release.md).

## Структура репозитория

```text
app/             UI Next.js и маршруты API
components/      Компоненты интерфейса React
hooks/           Состояние клиента и обработчики взаимодействий
lib/             Логика сессий, агента, моделей, файлов, Git и безопасности
public/          Статические ресурсы и файлы PWA
bin/             Точка входа npm CLI и разбор параметров запуска
scripts/         Скрипты сборки и самопроверки переносимых сборок
docs/            Тематические руководства для пользователей и участников
demo/            Статическое демо для GitHub Pages (см. demo/README.md)
```

Описание архитектуры и подробная карта файлов приведены в [AGENTS.md](../AGENTS.md).

## Лицензия

[MIT](../LICENSE)
