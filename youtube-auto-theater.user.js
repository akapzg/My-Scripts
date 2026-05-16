// ==UserScript==
// @name         YouTube Auto Theater Mode
// @name:zh-CN   YouTube 自动剧场模式
// @namespace    https://github.com/AKAPZG
// @version      1.2.1
// @description  Automatically enable theater mode and subtitles, and hide Shorts on the homepage.
// @description:zh-CN  在打开YouTube视频时默认自动切换为剧场模式并开启字幕，同时隐藏首页推荐的Shorts。
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

    // 隐藏 Shorts 的 CSS 规则
    const hideShortsCSS = `
        /* 1. 隐藏包含 Shorts 链接的整个推荐栏 (首页和搜索页) */
        ytd-rich-section-renderer:has(a[href^="/shorts/"]),
        ytd-reel-shelf-renderer:has(a[href^="/shorts/"]),
        
        /* 2. 隐藏混在普通视频网格中的单个 Shorts 视频 */
        ytd-rich-item-renderer:has(a[href^="/shorts/"]),
        
        /* 3. 隐藏右侧相关推荐里的 Shorts */
        ytd-compact-video-renderer:has(a[href^="/shorts/"]),
        
        /* 4. 左侧导航栏的 Shorts 按钮 */
        ytd-guide-entry-renderer:has(a[title="Shorts"]),
        ytd-mini-guide-entry-renderer[aria-label="Shorts"],
        a#endpoint[title="Shorts"] {
            display: none !important;
        }
    `;

    // 注入 CSS 到页面
    const styleNode = document.createElement('style');
    styleNode.innerHTML = hideShortsCSS;
    document.head.appendChild(styleNode);

    let lastVideoId = null;
    let attemptCount = 0;
    const MAX_ATTEMPTS = 15;
    
    let theaterApplied = false;
    let ccApplied = false;

    function applyVideoSettings() {
        if (!window.location.pathname.startsWith('/watch')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');

        if (!videoId) return;

        // 如果检测到打开了新的视频，重置状态
        if (lastVideoId !== videoId) {
            lastVideoId = videoId;
            attemptCount = 0;
            theaterApplied = false;
            ccApplied = false;
        }

        if (attemptCount >= MAX_ATTEMPTS || (theaterApplied && ccApplied)) return;

        const watchFlexy = document.querySelector('ytd-watch-flexy');
        const sizeButton = document.querySelector('.ytp-size-button');
        const ccButton = document.querySelector('.ytp-subtitles-button');

        // 等待播放器容器和调整大小按钮加载完毕
        if (watchFlexy && sizeButton) {
            
            // 1. 处理剧场模式
            if (!theaterApplied) {
                const isTheater = watchFlexy.hasAttribute('theater');
                if (!isTheater) {
                    sizeButton.click();
                    console.log('[YouTube 自动设置] 成功切换到剧场模式，视频ID:', videoId);
                }
                theaterApplied = true;
            }

            // 2. 处理自动字幕 (CC)
            if (!ccApplied) {
                if (ccButton) {
                    const isCcOn = ccButton.getAttribute('aria-pressed') === 'true';
                    // 仅当按钮存在且没有开启字幕时才点击
                    // display: none 通常意味着该视频没有字幕可用
                    if (ccButton.style.display !== 'none' && !isCcOn) {
                        ccButton.click();
                        console.log('[YouTube 自动设置] 成功开启字幕，视频ID:', videoId);
                    }
                }
                ccApplied = true;
            }

            // 如果两个都处理过了，强制结束尝试
            attemptCount = MAX_ATTEMPTS; 
            
        } else {
            attemptCount++;
        }
    }

    // 1. 监听 YouTube 特有的页面跳转事件 (SPA)
    window.addEventListener('yt-navigate-finish', () => {
        let intervalCount = 0;
        const interval = setInterval(() => {
            applyVideoSettings();
            intervalCount++;
            if (intervalCount >= MAX_ATTEMPTS) {
                clearInterval(interval);
            }
        }, 1000); // 每秒检查一次
    });

    // 2. 页面初次加载检查
    let initialCount = 0;
    const initialInterval = setInterval(() => {
        applyVideoSettings();
        initialCount++;
        if (initialCount >= MAX_ATTEMPTS) {
            clearInterval(initialInterval);
        }
    }, 1000);

})();
