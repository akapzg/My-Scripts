// ==UserScript==
// @name         YouTube Immersive Enhancer
// @name:zh-CN   YouTube 沉浸式观影增强
// @namespace    https://github.com/AKAPZG
// @version      1.4.2
// @description  Automatically enable theater mode, subtitles, auto-HD, auto-skip ads, and hide Shorts.
// @description:zh-CN  自动开启剧场模式、字幕、最高画质、跳过广告、关闭连播，并隐藏首页推荐的Shorts。
// @author       AKAPZG
// @license      MIT
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @downloadURL  https://raw.githubusercontent.com/akapzg/My-Scripts/main/youtube-immersive-enhancer.user.js
// @updateURL    https://raw.githubusercontent.com/akapzg/My-Scripts/main/youtube-immersive-enhancer.user.js
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
    let appliedStates = {};

    function applyVideoSettings() {
        if (!window.location.pathname.startsWith('/watch')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        if (!videoId) return;

        // 如果检测到打开了新的视频，重置状态
        if (lastVideoId !== videoId) {
            lastVideoId = videoId;
            appliedStates = {
                theater: !CONFIG.enableTheater,
                cc: !CONFIG.enableCC,
                quality: !CONFIG.autoHD,
                speed: false, // 倍速每次新视频都需要重新确认
                autoplay: !CONFIG.disableAutoplay
            };
        }

        // 检查是否全部应用完毕，完毕则直接返回以节省性能
        const allApplied = Object.values(appliedStates).every(v => v === true);
        if (allApplied) return;

        // 抓取核心控件
        const watchFlexy = document.querySelector('ytd-watch-flexy');
        const player = document.getElementById('movie_player');
        const video = document.querySelector('video.html5-main-video');

        // 【关键修复】判断视频是否真正开始加载或播放
        // iOS Safari 经常会在用户手动点击播放前，阻止视频的初始化和 UI 的完全渲染
        const isVideoReady = video && video.readyState > 0;
        const isVideoPlaying = video && !video.paused;

        if (watchFlexy && player) {
            
            // 1. 剧场模式 (UI 按钮，通常可以尽早点击)
            if (!appliedStates.theater) {
                const sizeButton = document.querySelector('.ytp-size-button');
                if (sizeButton) {
                    if (!watchFlexy.hasAttribute('theater')) {
                        sizeButton.click();
                        console.log('[YouTube 增强] 剧场模式已开启');
                    }
                    appliedStates.theater = true;
                }
            }

            // 2. 关闭连播 (UI 按钮)
            if (!appliedStates.autoplay) {
                const autonavToggle = document.querySelector('.ytp-autonav-toggle-button');
                if (autonavToggle) {
                    const isAutoplayOn = autonavToggle.getAttribute('aria-checked') === 'true';
                    if (isAutoplayOn) {
                        autonavToggle.click();
                        console.log('[YouTube 增强] 自动连播已关闭');
                    }
                    appliedStates.autoplay = true;
                }
            }

            // 3, 4, 5 的功能强依赖于播放器和视频流的实际加载
            // 在 iPad 上，必须等 video 至少 readyState > 0 或正在播放才能有效设置
            if (isVideoReady || isVideoPlaying) {
                
                // 3. 自动字幕 (优先内部 API，兼容移动端)
                if (!appliedStates.cc) {
                    if (typeof player.toggleSubtitlesOn === 'function') {
                        player.toggleSubtitlesOn();
                        console.log('[YouTube 增强] 已请求开启字幕 (API)');
                        appliedStates.cc = true;
                    } else {
                        const ccButton = document.querySelector('.ytp-subtitles-button');
                        if (ccButton) {
                            const isCcOn = ccButton.getAttribute('aria-pressed') === 'true';
                            if (!isCcOn) {
                                ccButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
                                console.log('[YouTube 增强] 已请求开启字幕 (点击)');
                            }
                            appliedStates.cc = true;
                        }
                    }
                }

                // 4. 自动最高画质
                if (!appliedStates.quality && typeof player.setPlaybackQualityRange === 'function') {
                    player.setPlaybackQualityRange('highres', 'highres'); 
                    console.log('[YouTube 增强] 已请求最高画质');
                    appliedStates.quality = true;
                }

                // 5. 自动播放倍速
                if (!appliedStates.speed && typeof player.setPlaybackRate === 'function') {
                    if (video.playbackRate !== CONFIG.preferredSpeed) {
                        player.setPlaybackRate(CONFIG.preferredSpeed);
                        console.log(`[YouTube 增强] 已设置播放倍速为 ${CONFIG.preferredSpeed}x`);
                    }
                    appliedStates.speed = true;
                }
            }
        }
    }

    // ==========================================
    // 核心监控逻辑
    // ==========================================

    // 1. 低频循环检测：移除原来的 MAX_ATTEMPTS 限制，
    // 因为在 Safari 上用户可能过了很久才点击播放。循环非常轻量，全部设置完毕后会自动休眠。
    setInterval(applyVideoSettings, 1000);

    // 2. 绑定原生视频事件（专治 iOS/Safari 延迟加载）
    // 当用户手动点击播放瞬间，视频状态会改变，此时立即触发设置
    setInterval(() => {
        const video = document.querySelector('video.html5-main-video');
        if (video && !video.dataset.enhancerAttached) {
            video.dataset.enhancerAttached = 'true';
            
            video.addEventListener('playing', () => {
                console.log('[YouTube 增强] 监听到视频开始播放，执行设置...');
                applyVideoSettings();
            });
            
            video.addEventListener('loadedmetadata', () => {
                applyVideoSettings();
            });
        }
    }, 2000); // 较低频率去寻找新的 video 元素

    // ==========================================
    // 自动跳过广告 & 弹窗清理逻辑 (独立高频检测)
    // ==========================================
    setInterval(() => {
        if (CONFIG.autoSkipAds) {
            const skipButtons = document.querySelectorAll('.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button');
            skipButtons.forEach(btn => {
                if (btn && btn.style.display !== 'none') {
                    btn.click();
                }
            });
            
            const closeButtons = document.querySelectorAll('.ytp-ad-overlay-close-button');
            closeButtons.forEach(btn => {
                if (btn && btn.style.display !== 'none') {
                    btn.click();
                }
            });
        }

        // 自动关闭因为强制切换画质导致的 "Experiencing interruptions?" (播放不流畅/中断) 提示
        const toasts = document.querySelectorAll('tp-yt-paper-toast');
        toasts.forEach(toast => {
            if (toast.style.display !== 'none') {
                const text = toast.textContent || '';
                if (text.includes('interruptions') || text.includes('不流畅') || text.includes('中断')) {
                    // 点击内部的按钮或直接隐藏
                    const actionBtn = toast.querySelector('button, yt-button-shape');
                    if (actionBtn) actionBtn.click();
                    toast.style.display = 'none';
                }
            }
        });
    }, 500);

})();
