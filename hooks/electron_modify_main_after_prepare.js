#!/usr/bin/env node
'use strict';

const fs = require('fs');
const { platform } = require('os');
const path = require('path');

module.exports = function (context) {
    const { projectRoot, plugin } = context.opts;

    const platformPath = path.resolve(projectRoot, 'platforms/electron');
    
    const electronMainPath = path.resolve(platformPath, 'platform_www/cdv-electron-main.js');
    const electronMainHooksPath = path.resolve(plugin.dir, 'src/electron/MainProcessHooks.js');

    const electronPreloadPath = path.resolve(platformPath, 'platform_www/cdv-electron-preload.js');
    const electronPreloadHooksPath = path.resolve(plugin.dir, 'src/electron/PreloadHooks.js');

    let electronMain = fs.readFileSync(electronMainPath).toString();
    let electronMainHooks = fs.readFileSync(electronMainHooksPath).toString();

    if(!electronMain.includes(electronMainHooks)){
        electronMain += electronMainHooks;
        fs.writeFileSync(electronMainPath, electronMain);
    }

    let electronPreload = fs.readFileSync(electronPreloadPath).toString();
    let electronPreloadHooks = fs.readFileSync(electronPreloadHooksPath).toString();

    if(!electronPreload.includes(electronPreloadHooks)){
        electronPreload += electronPreloadHooks;
        fs.writeFileSync(electronPreloadPath, electronPreload);
    }
};
