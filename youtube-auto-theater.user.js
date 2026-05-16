// ==UserScript==
// @name         YouTube Auto Theater Mode
// @name:zh-CN   YouTube 自动剧场模式
// @namespace    https://github.com/AKAPZG
// @version      1.0.0
// @description  Automatically enable theater mode when watching YouTube videos
// @description:zh-CN  在打开YouTube视频时默认自动切换为剧场模式
// @author       AKAPZG
// @license      MIT
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @downloadURL  https://raw.githubusercontent.com/akapzg/My-Scripts/main/youtube-auto-theater.user.js
// @updateURL    https://raw.githubusercontent.com/akapzg/My-Scripts/main/youtube-auto-theater.user.js
// @run-at       document-end
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let lastVideoId = null;
    let attemptCount = 0;
    const MAX_ATTEMPTS = 15;

    function checkAndEnableTheaterMode() {
        if (!window.location.pathname.startsWith('/watch')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');

        if (!videoId) return;

        // 如果检测到打开了新的视频，重置尝试次数
        if (lastVideoId !== videoId) {
            lastVideoId = videoId;
            attemptCount = 0;
        }

        if (attemptCount >= MAX_ATTEMPTS) return;

        const watchFlexy = document.querySelector('ytd-watch-flexy');
        const sizeButton = document.querySelector('.ytp-size-button');

        // 等待播放器容器和调整大小按钮加载完毕
        if (watchFlexy && sizeButton) {
            // 通过判断是否有 theater 属性来确认是否已经是剧场模式
            const isTheater = watchFlexy.hasAttribute('theater');
            
            if (!isTheater) {
                // 不是剧场模式时，点击按钮
                sizeButton.click();
                console.log('[YouTube 自动剧场模式] 成功切换到剧场模式，视频ID:', videoId);
                // 成功后设置为最大尝试次数，停止继续检查
                attemptCount = MAX_ATTEMPTS; 
            } else {
                // 如果已经是剧场模式，也停止检查
                attemptCount = MAX_ATTEMPTS;
            }
        } else {
            attemptCount++;
        }
    }

    // 1. 监听 YouTube 特有的页面跳转事件 (SPA)
    window.addEventListener('yt-navigate-finish', () => {
        let intervalCount = 0;
        const interval = setInterval(() => {
            checkAndEnableTheaterMode();
            intervalCount++;
            if (intervalCount >= MAX_ATTEMPTS) {
                clearInterval(interval);
            }
        }, 1000); // 每秒检查一次
    });

    // 2. 页面初次加载检查
    let initialCount = 0;
    const initialInterval = setInterval(() => {
        checkAndEnableTheaterMode();
        initialCount++;
        if (initialCount >= MAX_ATTEMPTS) {
            clearInterval(initialInterval);
        }
    }, 1000);

})();
