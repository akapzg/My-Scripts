// ==UserScript==
// @name         YouTube Immersive Enhancer
// @name:zh-CN   YouTube 沉浸式观影增强
// @namespace    https://github.com/AKAPZG
// @version      1.6.0
// @description  Automatically enable theater mode, subtitles, auto-HD, speed through ads, close autoplay, and clean page ads/Shorts/pause overlay.
// @description:zh-CN  自动开启剧场模式、字幕、最高画质、秒跳广告、关闭连播，屏蔽Shorts、暂停推荐遮罩与页面推广广告。
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
        hideShorts: true,       // 隐藏首页和侧边栏的 Shorts
        hidePauseOverlay: true, // 隐藏暂停视频时弹出的“更多视频”半透明推荐卡片
        cleanPageAds: true      // 净化视频流与侧边栏的静态赞助商推广卡片
    };

    // 注入页面净化 CSS 规则 (Shorts、暂停遮罩、推广卡片)
    let customCSS = '';

    if (CONFIG.hideShorts) {
        customCSS += `
            /* 1. 隐藏包含 Shorts 链接的整个推荐栏 (首页和搜索页) */
            ytd-rich-section-renderer:has(a[href*="/shorts/"]),
            ytd-reel-shelf-renderer:has(a[href*="/shorts/"]),
            /* 1b. 新版 Shorts 货架容器 (2025-2026 A/B 测试) */
            ytd-rich-shelf-renderer[is-shorts],
            ytd-rich-section-renderer:has(ytd-rich-shelf-renderer[is-shorts]),
            /* 2. 隐藏混在普通视频网格中的单个 Shorts 视频 */
            ytd-rich-item-renderer:has(a[href*="/shorts/"]),
            /* 2b. 隐藏搜索结果和推荐中带 Shorts 时间标记的视频 */
            ytd-video-renderer:has(ytd-thumbnail-overlay-time-status-renderer[overlay-style="SHORTS"]),
            /* 3. 隐藏右侧相关推荐里的 Shorts */
            ytd-compact-video-renderer:has(a[href*="/shorts/"]),
            /* 4. 左侧导航栏的 Shorts 按钮 (完整侧栏 + 迷你侧栏) */
            ytd-guide-entry-renderer:has(a[title="Shorts"]),
            ytd-guide-entry-renderer:has(a#endpoint[title="Shorts"]),
            ytd-mini-guide-entry-renderer:has(a[title="Shorts"]),
            ytd-mini-guide-entry-renderer[aria-label="Shorts"],
            /* 5. 频道页的 Shorts 标签 */
            yt-tab-shape[tab-title="Shorts"],
            /* 6. 通用的 Shorts 链接入口 */
            a#endpoint[title="Shorts"] {
                display: none !important;
            }
        `;
    }

    if (CONFIG.hidePauseOverlay) {
        customCSS += `
            /* 7. 屏蔽暂停时弹出的“更多视频”半透明推荐遮罩 (提升暂停/截图纯净度) */
            .ytp-pause-overlay,
            .ytp-pause-overlay-container {
                display: none !important;
            }
        `;
    }

    if (CONFIG.cleanPageAds) {
        customCSS += `
            /* 8. 净化页面中的静态推广与广告插槽 (视频下方横幅、侧栏置顶推广等) */
            #player-ads,
            ytd-ad-slot-renderer,
            ytd-in-feed-ad-layout-renderer,
            ytd-banner-promo-renderer,
            ytd-statement-banner-renderer,
            #masthead-ad {
                display: none !important;
            }
        `;
    }

    if (customCSS) {
        const styleNode = document.createElement('style');
        styleNode.innerHTML = customCSS;
        document.head.appendChild(styleNode);
    }

    let lastVideoId = null;
    let appliedStates = {};
    let theaterAttempts = 0;
    let wasAdPlaying = false;
    let originalMutedState = false;

    // 触控设备检测 (如 iPad Safari 触屏环境)
    const isTouchDevice = ('ontouchstart' in window)
        || (navigator.maxTouchPoints > 0)
        || (/iPad|iPhone|iPod|Android/i.test(navigator.userAgent));

    // 视口检测：iPad 桌面版或桌面浏览器在横屏（宽度 >= 992px）下才支持剧场模式；竖屏下本身为单列全宽布局无需切换
    function shouldEnableTheater() {
        return window.innerWidth >= 992;
    }

    /**
     * 检测当前是否处于剧场模式（多重回退策略）
     * YouTube 的 A/B 测试可能随时更换属性名
     */
    function isInTheaterMode() {
        const watchFlexy = document.querySelector('ytd-watch-flexy');
        if (!watchFlexy) return false;

        // 策略1: 经典 theater 属性
        if (watchFlexy.hasAttribute('theater')) return true;

        // 策略2: full-bleed-player 属性（新版 A/B 测试）
        if (watchFlexy.hasAttribute('full-bleed-player')) return true;

        // 策略3: 播放器宽度启发式判断
        // 剧场模式下播放器宽度通常 > 视口宽度的 85%
        const player = document.getElementById('movie_player');
        if (player) {
            const ratio = player.clientWidth / window.innerWidth;
            if (ratio > 0.85) return true;
        }

        return false;
    }

    /**
     * 切换剧场模式（多重策略：触屏优先 DOM 点击，桌面优先按键快捷键）
     */
    function triggerTheaterMode() {
        const player = document.getElementById('movie_player');
        const sizeButton = document.querySelector('.ytp-size-button')
            || document.querySelector('button[data-tooltip-target-id="a11y-hint-theater"]')
            || document.querySelector('button[aria-label*="Theater"]')
            || document.querySelector('button[aria-label*="theater"]')
            || document.querySelector('button[aria-label*="剧场"]');

        // 触控设备 (如 iPad Safari 桌面模式): 优先通过 DOM 按钮触发点击
        if (isTouchDevice && sizeButton) {
            sizeButton.click();
            console.log('[YouTube 增强] 尝试开启剧场模式 (DOM 点击)');
            return true;
        }

        // 桌面端或无按钮时: 优先模拟键盘快捷键 'T'
        if (player) {
            try { player.focus(); } catch (e) {}
            const event = new KeyboardEvent('keydown', {
                key: 't',
                code: 'KeyT',
                keyCode: 84,
                which: 84,
                bubbles: true,
                cancelable: true
            });
            player.dispatchEvent(event);
            console.log('[YouTube 增强] 尝试开启剧场模式 (键盘快捷键)');

            // 针对部分触控设备可能需要双重触发保障
            if (sizeButton && isTouchDevice) {
                sizeButton.click();
            }
            return true;
        }

        if (sizeButton) {
            sizeButton.click();
            console.log('[YouTube 增强] 尝试开启剧场模式 (DOM 点击回退)');
            return true;
        }

        return false;
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
            
            // 1. 剧场模式 (多策略兼容：iPad Safari 触屏优先 DOM 点击，PC 优先快捷键，带确认重试机制)
            if (!appliedStates.theater) {
                if (!shouldEnableTheater()) {
                    // 视口宽度不足 992px（如 iPad 竖屏），原生已是单列通栏布局，无需且无法切换剧场模式
                    appliedStates.theater = true;
                } else if (isInTheaterMode()) {
                    // 已经是剧场模式，标记完成
                    appliedStates.theater = true;
                } else {
                    triggerTheaterMode();
                    theaterAttempts++;
                    // 延迟 500ms 确认状态，成功才标记完成；若未成功且未超限则允许后续轮询重试（最多重试 6 次）
                    setTimeout(() => {
                        if (isInTheaterMode()) {
                            appliedStates.theater = true;
                            console.log('[YouTube 增强] 剧场模式已成功开启');
                        } else if (theaterAttempts >= 6) {
                            appliedStates.theater = true; // 超过重试上限，停止尝试以防死循环
                        }
                    }, 500);
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
