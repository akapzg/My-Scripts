// ==UserScript==
// @name         YouTube Immersive Enhancer
// @name:zh-CN   YouTube 沉浸式观影增强
// @namespace    https://github.com/AKAPZG
// @version      1.7.0
// @description  Automatically enable theater mode, subtitles, auto-HD, speed through ads, close autoplay, and clean page ads/Shorts/pause overlay.
// @description:zh-CN  自动开启剧场模式、字幕、最高画质、秒跳广告、关闭连播，屏蔽Shorts、暂停推荐遮罩、片尾卡片与页面推广广告。
// @author       AKAPZG
// @license      MIT
// @match        *://*.youtube.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=youtube.com
// @downloadURL  https://raw.githubusercontent.com/akapzg/My-Scripts/main/youtube-immersive-enhancer.user.js
// @updateURL    https://raw.githubusercontent.com/akapzg/My-Scripts/main/youtube-immersive-enhancer.user.js
// @run-at       document-start
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
        hideShorts: true,       // 隐藏首页、搜索页和侧边栏的 Shorts
        hidePauseOverlay: true, // 隐藏暂停遮罩、片尾推荐卡片、右上角信息卡与水印
        cleanPageAds: true      // 净化视频流、商品栏与侧边栏的静态推广卡片
    };

    // 0. 预设 YouTube 官方剧场模式 Cookie (wide=1)，使页面原生以剧场模式初始化
    if (CONFIG.enableTheater) {
        document.cookie = 'wide=1; domain=.youtube.com; path=/; max-age=31536000; SameSite=Lax';
    }

    // 注入页面净化 CSS 规则 (Shorts、暂停遮罩、片尾干扰、推广卡片)
    let customCSS = '';

    if (CONFIG.hideShorts) {
        customCSS += `
            /* 1. 直接隐藏所有 Shorts 专用货架与新版 ViewModel 容器 (无需等待内部链接渲染) */
            ytd-reel-shelf-renderer,
            ytd-reel-item-renderer,
            ytm-shorts-lockup-view-model,
            ytm-shorts-lockup-view-model-v2,
            ytd-rich-shelf-renderer[is-shorts],
            [is-shorts],
            /* 2. 隐藏包含 Shorts 的新版组件容器 (2025-2026 ViewModel 架构) */
            ytd-rich-section-renderer:has(a[href*="/shorts/"]),
            ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
            ytd-rich-section-renderer:has(ytm-shorts-lockup-view-model),
            grid-shelf-view-model:has(a[href*="/shorts/"]),
            grid-shelf-view-model:has(ytm-shorts-lockup-view-model),
            ytd-shelf-renderer:has(a[href*="/shorts/"]),
            ytd-item-section-renderer:has(ytd-reel-shelf-renderer),
            ytd-item-section-renderer:has(grid-shelf-view-model:has(a[href*="/shorts/"])),
            /* 3. 隐藏混在列表与右侧推荐中的单个 Shorts 视频 */
            ytd-rich-item-renderer:has(a[href*="/shorts/"]),
            ytd-video-renderer:has(a[href*="/shorts/"]),
            ytd-compact-video-renderer:has(a[href*="/shorts/"]),
            yt-lockup-view-model:has(a[href*="/shorts/"]),
            ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
            /* 4. 左侧导航栏与底栏 Shorts 入口 */
            ytd-guide-entry-renderer:has(a[title="Shorts"]),
            ytd-guide-entry-renderer:has(a[href*="/shorts"]),
            ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
            ytd-mini-guide-entry-renderer[aria-label="Shorts"],
            yt-tab-shape[tab-title="Shorts"],
            a#endpoint[title="Shorts"],
            /* 5. 隐藏 Playables 小游戏推荐栏 */
            ytd-rich-section-renderer:has(a[href*="/playables"]),
            ytd-game-card-renderer {
                display: none !important;
            }
        `;
    }

    if (CONFIG.hidePauseOverlay) {
        customCSS += `
            /* 屏蔽暂停遮罩、片尾遮挡画面的推荐卡片(.ytp-ce-element)、右上角推荐气泡与右下角订阅水印 */
            .ytp-pause-overlay,
            .ytp-pause-overlay-container,
            .ytp-ce-element,
            .ytp-cards-teaser,
            .ytp-cards-button,
            .iv-branding,
            .annotation {
                display: none !important;
            }
        `;
    }

    if (CONFIG.cleanPageAds) {
        customCSS += `
            /* 净化页面静态推广、带货商品架、购票横幅、置顶赞助与会员促销弹窗 */
            #player-ads,
            #masthead-ad,
            ytd-ad-slot-renderer,
            ytd-in-feed-ad-layout-renderer,
            ytd-banner-promo-renderer,
            ytd-statement-banner-renderer,
            ytd-merch-shelf-renderer,
            ytd-ticket-shelf-renderer,
            ytd-brand-video-shelf-renderer,
            ytd-brand-video-singleton-renderer,
            ytd-promoted-sparkles-web-renderer,
            ytd-promoted-sparkles-text-search-renderer,
            ytd-engagement-panel-section-list-renderer[target-id="engagement-panel-structured-description-Product"] {
                display: none !important;
            }
        `;
    }

    function injectCSS() {
        if (!customCSS || document.getElementById('yt-immersive-style')) return;
        const styleNode = document.createElement('style');
        styleNode.id = 'yt-immersive-style';
        styleNode.textContent = customCSS;
        (document.head || document.documentElement).appendChild(styleNode);
    }
    injectCSS();
    document.addEventListener('DOMContentLoaded', injectCSS);

    let lastVideoId = null;
    let appliedStates = {};
    let theaterAttempts = 0;
    let wasAdPlaying = false;
    let originalMutedState = false;

    // 触控设备检测 (如 iPad Safari 触屏环境)
    const isTouchDevice = ('ontouchstart' in window)
        || (navigator.maxTouchPoints > 0)
        || (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent));

    /**
     * 检测当前是否处于剧场模式（严格校验 DOM 属性，移除在 iPad 上会误判的宽度比例检测）
     */
    function isInTheaterMode() {
        const watchFlexy = document.querySelector('ytd-watch-flexy');
        if (!watchFlexy) return false;
        return watchFlexy.hasAttribute('theater') || watchFlexy.hasAttribute('full-bleed-player');
    }

    /**
     * 切换剧场模式（四重策略：Cookie + Polymer 自定义事件 + DOM 按钮点击 + 属性强制挂载）
     */
    function triggerTheaterMode() {
        document.cookie = 'wide=1; domain=.youtube.com; path=/; max-age=31536000; SameSite=Lax';

        const watchFlexy = document.querySelector('ytd-watch-flexy');
        const player = document.getElementById('movie_player');
        const sizeButton = document.querySelector('.ytp-size-button')
            || document.querySelector('button[data-tooltip-target-id="a11y-hint-theater"]')
            || document.querySelector('button[aria-label*="Theater"]')
            || document.querySelector('button[aria-label*="theater"]')
            || document.querySelector('button[aria-label*="剧场"]');

        // 策略1: 触发 YouTube Polymer 组件原生内部剧场切换事件 (无视按钮隐藏与 WebKit 按键限制)
        if (watchFlexy) {
            watchFlexy.dispatchEvent(new CustomEvent('yt-set-theater-mode-enabled', {
                detail: { enabled: true },
                bubbles: true,
                composed: true
            }));
        }

        // 策略2: 点击尺寸切换按钮 (若当前未开启剧场模式)
        if (sizeButton && !isInTheaterMode()) {
            sizeButton.click();
        }

        // 策略3: 桌面端键盘快捷键 T
        if (player && !isTouchDevice && !isInTheaterMode()) {
            try { player.focus(); } catch (e) {}
            player.dispatchEvent(new KeyboardEvent('keydown', {
                key: 't',
                code: 'KeyT',
                keyCode: 84,
                which: 84,
                bubbles: true,
                cancelable: true
            }));
        }

        // 策略4: iPad Safari 终极兜底 —— 若第 2 次尝试仍未激活，直接挂载属性并通知播放器重算尺寸
        if (watchFlexy && !isInTheaterMode() && theaterAttempts >= 1) {
            watchFlexy.theater = true;
            watchFlexy.setAttribute('theater', '');
            watchFlexy.setAttribute('full-bleed-player', '');
            window.dispatchEvent(new Event('resize'));
        }

        return true;
    }

    function applyVideoSettings() {
        if (!window.location.pathname.startsWith('/watch')) return;

        const urlParams = new URLSearchParams(window.location.search);
        const videoId = urlParams.get('v');
        if (!videoId) return;

        // 如果检测到打开了新的视频，重置状态
        if (lastVideoId !== videoId) {
            lastVideoId = videoId;
            theaterAttempts = 0;
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
            
            // 1. 剧场模式 (四重策略兼容 iPad Safari 与桌面端，带确认重试机制)
            if (!appliedStates.theater) {
                if (isInTheaterMode()) {
                    appliedStates.theater = true;
                } else {
                    triggerTheaterMode();
                    theaterAttempts++;
                    setTimeout(() => {
                        if (isInTheaterMode()) {
                            appliedStates.theater = true;
                            console.log('[YouTube 增强] 剧场模式已成功开启');
                        } else if (theaterAttempts >= 8) {
                            appliedStates.theater = true;
                        }
                    }, 400);
                }
            }

            // 2. 关闭连播 (UI 按钮，兼容新旧两种 DOM 结构)
            if (!appliedStates.autoplay) {
                // 新版: 按钮使用 aria-label="Autoplay is on/off" 而非 aria-checked
                const autonavToggle = document.querySelector('.ytp-autonav-toggle-button')
                    || document.querySelector('button.ytp-autonav-toggle')
                    || document.querySelector('[data-tooltip-target-id="ytp-autonav-toggle-button"]');
                if (autonavToggle) {
                    const ariaLabel = (autonavToggle.getAttribute('aria-label') || '').toLowerCase();
                    const ariaChecked = autonavToggle.getAttribute('aria-checked');
                    // 兼容两种判断方式：aria-label 文本 或 aria-checked 属性
                    const isAutoplayOn = ariaLabel.includes('autoplay is on')
                        || ariaLabel.includes('连播已开启')
                        || ariaChecked === 'true';
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
                
                // 3. 自动字幕 (多重策略：内部 API → 触屏 DOM 点击 → 键盘快捷键 C)
                if (!appliedStates.cc) {
                    // 策略1: 内部 API (最直接)
                    if (typeof player.toggleSubtitlesOn === 'function') {
                        player.toggleSubtitlesOn();
                        console.log('[YouTube 增强] 已请求开启字幕 (API)');
                        appliedStates.cc = true;
                    } else {
                        const ccButton = document.querySelector('.ytp-subtitles-button');
                        if (ccButton) {
                            const ariaLabel = (ccButton.getAttribute('aria-label') || '').toLowerCase();
                            // 如果字幕不可用（unavailable），则跳过并标记完成
                            if (ariaLabel.includes('unavailable') || ariaLabel.includes('不可用')) {
                                appliedStates.cc = true;
                            } else {
                                const isCcOn = ccButton.getAttribute('aria-pressed') === 'true';
                                if (!isCcOn) {
                                    // 策略2: 触控设备 (如 iPad Safari) 优先点击 DOM 按钮
                                    if (isTouchDevice) {
                                        ccButton.click();
                                        console.log('[YouTube 增强] 已请求开启字幕 (DOM 点击)');
                                    } else {
                                        // 策略3: 桌面优先键盘快捷键 C
                                        const ccEvent = new KeyboardEvent('keydown', {
                                            key: 'c', code: 'KeyC', keyCode: 67, which: 67,
                                            bubbles: true, cancelable: true
                                        });
                                        player.dispatchEvent(ccEvent);
                                        console.log('[YouTube 增强] 已请求开启字幕 (键盘快捷键)');
                                    }
                                }
                                appliedStates.cc = true;
                            }
                        }
                    }
                }

                // 4. 自动最高画质 (增强策略：优先获取当前视频支持的最高画质档位)
                if (!appliedStates.quality) {
                    let targetQuality = 'highres';
                    if (typeof player.getAvailableQualityLevels === 'function') {
                        const levels = player.getAvailableQualityLevels();
                        if (Array.isArray(levels) && levels.length > 0) {
                            targetQuality = levels[0];
                        }
                    }
                    if (typeof player.setPlaybackQualityRange === 'function') {
                        player.setPlaybackQualityRange(targetQuality, targetQuality);
                    }
                    if (typeof player.setPlaybackQuality === 'function') {
                        player.setPlaybackQuality(targetQuality);
                    }
                    console.log(`[YouTube 增强] 已请求最高画质 (${targetQuality})`);
                    appliedStates.quality = true;
                }

                // 5. 自动播放倍速 (API + 原生 video 兜底)
                if (!appliedStates.speed) {
                    if (typeof player.setPlaybackRate === 'function') {
                        player.setPlaybackRate(CONFIG.preferredSpeed);
                    }
                    if (video && video.playbackRate !== CONFIG.preferredSpeed) {
                        video.playbackRate = CONFIG.preferredSpeed;
                    }
                    console.log(`[YouTube 增强] 已设置播放倍速为 ${CONFIG.preferredSpeed}x`);
                    appliedStates.speed = true;
                }
            }
        }

        // 绑定原生视频事件（专治 iOS/Safari 延迟加载）
        if (video && !video.dataset.enhancerAttached) {
            video.dataset.enhancerAttached = 'true';
            video.addEventListener('playing', () => {
                applyVideoSettings();
            });
            video.addEventListener('loadedmetadata', () => {
                applyVideoSettings();
            });
        }
    }

    // ==========================================
    // 核心监控与事件驱动
    // ==========================================

    // 1. YouTube 单页 SPA 导航监听 (切视频 0 延迟即时生效)
    document.addEventListener('yt-navigate-finish', () => {
        lastVideoId = null;
        applyVideoSettings();
    });
    window.addEventListener('yt-page-data-updated', () => {
        applyVideoSettings();
    });

    // 2. 轻量低频轮询 (每秒一次，全部设置完毕后内部极速 return)
    setInterval(applyVideoSettings, 1000);

    // ==========================================
    // 自动跳过广告 & 弹窗清理逻辑 (独立高频检测)
    // ==========================================
    setInterval(() => {
        if (CONFIG.autoSkipAds) {
            // 1. 尝试点击各类跳过按钮 (兼容新旧类名及插槽)
            const skipButtons = document.querySelectorAll(
                '.ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-skip-ad-button, button.ytp-ad-skip-button, .ytp-ad-skip-button-slot button'
            );
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

            // 2. 不可跳过广告极速快进 (秒过贴片广告)
            const player = document.getElementById('movie_player');
            const video = document.querySelector('video.html5-main-video');
            if (player && video) {
                const isAdShowing = player.classList.contains('ad-showing') || player.classList.contains('ad-interrupting');
                if (isAdShowing) {
                    if (!wasAdPlaying) {
                        wasAdPlaying = true;
                        originalMutedState = video.muted;
                    }
                    video.muted = true;
                    video.playbackRate = 16;
                    if (Number.isFinite(video.duration) && video.duration > 0) {
                        video.currentTime = video.duration;
                    }
                } else if (wasAdPlaying) {
                    // 广告播放完毕，恢复原声音与用户配置倍速
                    wasAdPlaying = false;
                    video.muted = originalMutedState;
                    video.playbackRate = CONFIG.preferredSpeed;
                }
            }
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
