# Local Radio

一个基于 Electron、Vite 和 React 的本地桌面电台播放器。

## 项目概览

这个仓库当前是源码最小化版本，适合直接同步到公开仓库或作为本地数据驱动桌面应用的基础模板。

主要特点：

1. 运行时不依赖后端服务。
2. 电台数据全部来自本地快照文件。
3. 保留地图浏览、播放、随机、收藏、搜索和筛选能力。
4. 仓库默认不携带第三方台站数据，只附带最小占位快照。

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

## 仓库结构

```text
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

## 运行与构建说明

1. 运行时的资源读取仅限本地静态文件和地图 GeoJSON。
2. 仓库不包含远端抓取脚本，也不内置任何远端 API 地址。
3. 当前仓库不会提交 node_modules、构建产物和 lockfile；同步后如果要运行，需要先执行一次 `npm install`。

## 适合的使用方式

这个仓库更适合下面两类场景：

1. 作为一个完全本地化的桌面播放器源码模板继续开发。
2. 作为私有或公开仓库中的前端壳层，再由你自己维护本地快照数据生成流程。