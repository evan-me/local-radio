# Local Radio

一个基于 Electron、Vite 和 React 的本地桌面电台播放器。

> 一个纯本地数据驱动的桌面电台应用模板，适合继续开发、私有部署或公开开源维护。

## 应用预览

<p align="center">
  <img src="docs/screenshots/app-preview-1.png" alt="Local Radio App Preview 1" width="48%" />
  <img src="docs/screenshots/app-preview-2.png" alt="Local Radio App Preview 2" width="48%" />
</p>

## 项目概览

这个仓库当前是源码最小化版本，适合直接同步到公开仓库，或作为本地数据驱动桌面应用的基础模板。

主要特点：

1. 运行时不依赖后端服务。
2. 电台数据全部来自本地快照文件。
3. 保留地图浏览、播放、随机、收藏、搜索和筛选能力。
4. 仓库默认不携带第三方台站数据，只附带最小占位快照。
5. README 顶部预览图随仓库一起提交，推送到 GitHub 后可直接浏览。

## 快速开始

首次拉取代码后先安装依赖：

```bash
npm install
```

启动桌面开发环境：

```bash
npm run electron:dev
```

构建应用：

```bash
npm run build
```

打包桌面应用：

```bash
npm run electron:build
```

如果只需要单平台打包，也可以使用：

```bash
npm run electron:build:mac
npm run electron:build:win
```

## 开源说明

本项目以 MIT License 开源发布。

这意味着你可以：

1. 自由使用、复制、修改和分发代码。
2. 将它用于个人项目、商业项目或内部工具。
3. 在保留许可证文本的前提下发布你的修改版本。

你需要注意：

1. 项目按“原样”提供，不附带任何明示或暗示担保。
2. 再分发时需要保留 [LICENSE](LICENSE) 文件中的版权与许可声明。

## 仓库结构

```text
docs/screenshots/          README 顶部预览图
electron/                  Electron 主进程与 preload
public/data/               本地电台快照文件
public/geo/                地图 GeoJSON 数据
src/                       React 渲染进程源码
src/components/            UI 组件
src/hooks/                 地图和动效 hooks
src/services/              本地数据读取与转换服务
src/store/                 Zustand 全局状态
```

## 本地数据文件

应用默认读取：

```text
public/data/radio-snapshot.json
```

仓库当前自带的是最小占位数据：

```json
{
	"snapshot_version": 1,
	"generated_at": "2026-05-09T00:00:00.000Z",
	"meta": {
		"total_stations": 0,
		"default_lang": "zh",
		"detail_failures": 0
	},
	"filters": {
		"continents": [],
		"genres": [],
		"countries": [],
		"vibes": []
	},
	"stations": []
}
```

如果你要接入自己的本地数据，只需要保持同样的 JSON 顶层结构即可。没有数据时，应用会以空状态运行，而不是回退到任何远端源。

## 发布与同步

README 顶部图片直接读取仓库内文件：

1. [docs/screenshots/app-preview-1.png](docs/screenshots/app-preview-1.png)
2. [docs/screenshots/app-preview-2.png](docs/screenshots/app-preview-2.png)

这意味着仓库推送到 GitHub 后，无需外部图床也能正常展示应用预览。

## 版本发布

仓库内置了基于 Git tag 的 GitHub Actions 发布流程。

当你推送形如 `v1.0.1` 的标签时，工作流会自动：

1. 在 GitHub Actions 上分别构建 macOS 和 Windows 安装包。
2. 收集构建产物。
3. 创建或更新对应版本的 GitHub Release，并附加安装包文件。

常用发布命令：

```bash
git add .
git commit -m "chore: release v1.0.1"
git push origin main
git tag v1.0.1
git push origin v1.0.1
```

如果你只想重新触发某个版本的发布流程，也可以删除远端 tag 后重新推送同名 tag，或者在 GitHub Actions 页面手动重跑该工作流。

## 运行与构建说明

1. 运行时的资源读取仅限本地静态文件和地图 GeoJSON。
2. 仓库不包含远端抓取脚本，也不内置任何远端 API 地址。
3. 当前仓库不会提交 node_modules、构建产物和 lockfile；同步后如果要运行，需要先执行一次 `npm install`。

## 适合的使用方式

这个仓库更适合下面两类场景：

1. 作为一个完全本地化的桌面播放器源码模板继续开发。
2. 作为私有或公开仓库中的前端壳层，再由你自己维护本地快照数据生成流程。

## License

本项目采用 [MIT License](LICENSE)。