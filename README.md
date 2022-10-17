# EZPPLauncher

Welcome to the EZPPLauncher! A new way to connect to the EZPPFarm server.

Just one click and you are ready to go!

## Installation
The Launcher is a "plug and play thing", download it, place it on the desktop and execute!

## Features

* Automatic osu! client updating before Launch
* Account saving (soon)

## Used Libraries

* [Electron](https://www.npmjs.com/package/electron)
* [custom-electron-titlebar](https://www.npmjs.com/package/custom-electron-titlebar)
* [axios](https://www.npmjs.com/package/axios)
* [jquery](https://www.npmjs.com/package/jquery)

## Build from source

- clone repo
- cd into the repo
- use `yarn install` to install all dependencies
- (if node-gyp cant build the natives try clearing the cache at `%localappdata%\node-gyp\Cache\`)
- run `yarn rebuild` to rebuild the natives to the current `NODE_MODULE_VERSION`
- use the buildscript `pack-win` to build a executeable

## License
[AGPL-3.0](https://choosealicense.com/licenses/agpl-3.0/)