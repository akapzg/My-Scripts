// ==UserScript==
// @name         YouTube Auto Theater Mode
// @name:zh-CN   YouTube 沉浸式观影增强
// @namespace    https://github.com/AKAPZG
// @version      1.3.0
// @description  Automatically enable theater mode, subtitles, auto-HD, auto-skip ads, and hide Shorts.
// @description:zh-CN  自动开启剧场模式、字幕、最高画质、跳过广告、关闭连播，并隐藏首页推荐的Shorts。
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

    // ==========================================
    // 配置区域 (可自行修改)
    // ==========================================
    const CONFIG = {
        enableTheater: true,    // 开启剧场模式
        enableCC: true,         // 开启字幕
        autoHD: true,           // 自动最高画质
        preferredSpeed: 1.0,    // 默认播放倍速 (1.0为正常速度, 可改为1.25, 1.5等)
        disableAutoplay: true,  // 关闭自动连播 (倒计时播放下一个视频)
        autoSkipAds: true,      // 自动跳过贴片和横幅广告
        hideShorts: true        // 隐藏首页和侧边栏的 Shorts
    };

    // 隐藏 Shorts 的 CSS 规则
    if (CONFIG.hideShorts) {
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
        const styleNode = document.createElement('style');
        styleNode.innerHTML = hideShortsCSS;
        document.head.appendChild(styleNode);
    }

    let lastVideoId = null;
    let attemptCount = 0;
    const MAX_ATTEMPTS = 20; // 增加一些尝试次数以适应网速慢的情况
    
    let appliedStates = {};

    function applyVideoSettings() {
        if (!window.location.pathname.startsWith('/watch')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        if (!videoId) return;

        // 如果检测到打开了新的视频，重置状态
        if (lastVideoId !== videoId) {
            lastVideoId = videoId;
            attemptCount = 0;
            appliedStates = {
                theater: !CONFIG.enableTheater,
                cc: !CONFIG.enableCC,
                quality: !CONFIG.autoHD,
                speed: false, // 每次新视频都要重置倍速，因为YouTube可能会重置它
                autoplay: !CONFIG.disableAutoplay
            };
        }

        // 如果所有配置的功能都已应用，则退出
        const allApplied = Object.values(appliedStates).every(v => v === true);
        if (attemptCount >= MAX_ATTEMPTS || allApplied) return;

        // 抓取播放器控件
        const watchFlexy = document.querySelector('ytd-watch-flexy');
        const sizeButton = document.querySelector('.ytp-size-button');
        const ccButton = document.querySelector('.ytp-subtitles-button');
        const autonavToggle = document.querySelector('.ytp-autonav-toggle-button');
        const player = document.getElementById('movie_player');
        const video = document.querySelector('video.html5-main-video');

        // 确保页面主体加载完毕再执行，避免空转
        if (watchFlexy && player) {
            
            // 1. 剧场模式
            if (!appliedStates.theater && sizeButton) {
                if (!watchFlexy.hasAttribute('theater')) {
                    sizeButton.click();
                    console.log('[YouTube 增强] 已开启剧场模式');
                }
                appliedStates.theater = true;
            }

            // 2. 自动字幕 (CC)
            if (!appliedStates.cc && ccButton) {
                const isCcOn = ccButton.getAttribute('aria-pressed') === 'true';
                if (ccButton.style.display !== 'none' && !isCcOn) {
                    ccButton.click();
                    console.log('[YouTube 增强] 已开启字幕');
                }
                appliedStates.cc = true;
            }

            // 3. 自动关闭连播 (Autoplay)
            if (!appliedStates.autoplay && autonavToggle) {
                const isAutoplayOn = autonavToggle.getAttribute('aria-checked') === 'true';
                if (isAutoplayOn) {
                    autonavToggle.click();
                    console.log('[YouTube 增强] 已关闭自动连播');
                }
                appliedStates.autoplay = true;
            }

            // 4. 自动最高画质 (通过 YouTube API)
            if (!appliedStates.quality && player.setPlaybackQualityRange) {
                player.setPlaybackQualityRange('highres', 'highres'); 
                console.log('[YouTube 增强] 已请求最高画质');
                appliedStates.quality = true;
            }

            // 5. 自动播放倍速
            if (!appliedStates.speed && video && player.setPlaybackRate) {
                if (video.playbackRate !== CONFIG.preferredSpeed) {
                    player.setPlaybackRate(CONFIG.preferredSpeed);
                    console.log(`[YouTube 增强] 已设置播放倍速为 ${CONFIG.preferredSpeed}x`);
                }
                // 即便是当前已经是设置的倍速，也将其标记为已处理
                appliedStates.speed = true;
            }
            
            attemptCount++;
        }
    }

    // ==========================================
    // 自动跳过广告逻辑 (独立循环，高频检测)
    // ==========================================
    if (CONFIG.autoSkipAds) {
        setInterval(() => {
            // 跳过贴片视频广告的按钮
            const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
            skipButtons.forEach(btn => {
                if (btn && btn.style.display !== 'none') {
                    btn.click();
                    console.log('[YouTube 增强] 已跳过广告');
                }
            });
            
            // 关闭底部横幅文字图文广告
            const closeButtons = document.querySelectorAll('.ytp-ad-overlay-close-button');
            closeButtons.forEach(btn => {
                if (btn && btn.style.display !== 'none') {
                    btn.click();
                    console.log('[YouTube 增强] 已关闭横幅广告');
                }
            });
        }, 500); // 每0.5秒检查一次
    }

    // ==========================================
    // 路由监听器
    // ==========================================
    window.addEventListener('yt-navigate-finish', () => {
        let intervalCount = 0;
        const interval = setInterval(() => {
            applyVideoSettings();
            intervalCount++;
            if (intervalCount >= MAX_ATTEMPTS) {
                clearInterval(interval);
            }
        }, 1000); 
    });

    let initialCount = 0;
    const initialInterval = setInterval(() => {
        applyVideoSettings();
        initialCount++;
        if (initialCount >= MAX_ATTEMPTS) {
            clearInterval(initialInterval);
        }
    }, 1000);

})();
