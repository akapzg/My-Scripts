// ==UserScript==
// @name         Microsoft Bing Rewards Script by AKAPZG
// @namespace    https://github.com/AKAPZG
// @version      1.1.0
// @description  Automatically completes Microsoft Rewards daily search tasks with a built-in English keyword list.
// @author       AKAPZG
// @license      MIT
// @match        https://www.bing.com/*
// @match        https://cn.bing.com/*
// @icon         https://www.bing.com/favicon.ico
// @downloadURL  https://raw.githubusercontent.com/akapzg/My-Scripts/main/Bing-Rewards-Script.user.js
// @updateURL    https://raw.githubusercontent.com/akapzg/My-Scripts/main/Bing-Rewards-Script.user.js
// @run-at       document-end
// @grant        GM_registerMenuCommand
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// ==/UserScript==

(function () {
    'use strict';
    // Only run in the top frame
    if (window.top !== window.self) {
        return;
    }

    // This script no longer uses an external API. Keywords are provided in defaultKeywords.

    const searchHost = 'https://www.bing.com'; // Search page
    const pathnames = ['/', '/search']; // Trigger search on these pages
    const autoRunSearch = '?runMode=auto&runKey=1362311'; // Auto-run parameter

    const searchTimes = 30; // Total number of searches to perform

    const searchDelaySecondsMin = 15; // Minimum delay between searches (seconds)
    const searchDelaySecondsMax = 30; // Maximum delay between searches (seconds)
    const searchDelaySecondsFirst = 3; // Initial delay before the first search (seconds)
    const closeTaskCardDelaySeconds = 5; // Delay before the "Completed" card closes (seconds)

    const searchSafeDelayTimes = 4; // Trigger a long pause after every N searches
    const searchSafeDelaySeconds = 0 * 60; // Duration of the long pause (seconds)

    const startBtn = true; // Show a "Start Tasks" button near the search bar
    const startBtnText = 'Start Tasks'; // Text for the button

    // Default keywords list customized for interests.
    const defaultKeywords = [
        // Music & Digital Products
        'High-fidelity audio headphones review',
        'Digital Audio Workstation (DAW) software comparison',
        'Vinyl record collecting community Australia',
        'How to build a guitar pedalboard',
        'Comparing studio monitor speakers for home setup',
        'Best lossless audio streaming services 2025',
        'Latest flagship smartphone reviews',
        'Building a custom mechanical keyboard',

        // NAS & PC Hardware
        'Building a home NAS with TrueNAS Scale',
        'Synology vs QNAP NAS for Plex server',
        'Benefits of a modular ATX 3.0 power supply',
        'RAID 5 vs RAID 6 performance and reliability',
        'Using Docker on a home NAS',
        'Best hard drives for NAS storage 2025',
        'Next generation CPU and GPU rumors',

        // Car Enthusiast
        'Turbocharger vs Supercharger differences explained',
        'Car power-to-weight ratio calculator',
        'How dual-clutch transmissions work',
        'JDM car import laws Western Australia',
        'Classic Holden and Ford muscle car restoration',
        'Formula 1 aerodynamic concepts',
        'Perth cars and coffee events',
        'Off-road 4x4 accessories for Toyota Hilux',

        // Gaming
        'Upcoming open-world RPG games for PC',
        'Building a high refresh rate 1440p gaming PC',
        'History of the soulslike video game genre',
        'Best cooperative board games for adults',
        'Reviews of PlayStation 5 exclusives',
        'Valorant Champions Tour APAC league',
        'How to reduce input lag for competitive gaming',
        "Baldur's Gate 3 build guides",

        // Civil Engineering in Australia (Perth/WA focus)
        'Engineers Australia (EA) accreditation process',
        'National Engineering Register (NER) requirements',
        'Australian Height Datum (AHD) Perth',
        'Building Code of Australia (BCA/NCC) updates',
        'AutoCAD vs BricsCAD for civil design',
        'Geotechnical site investigation procedures',
        'Sustainable infrastructure and green construction',
        'Major infrastructure projects in Perth 2025',
        'METRONET rail project progress',
        'Structural analysis of concrete structures',
        'Stormwater drainage design Main Roads WA',
        'Project management in the construction industry',
        'Career pathways for Chartered Civil Engineers in Australia',
        'Use of Building Information Modeling (BIM) on WA projects',
        'AS 3600 Concrete Structures standard'
    ];

    // --- Dynamic Keyword Generation Logic ---
    // Create a pool of individual words from the main keyword list for splicing.
    const wordPool = [...new Set(defaultKeywords
        .join(' ') // 1. Join all phrases into one giant string
        .toLowerCase() // 2. Convert to lowercase
        .replace(/[^\w\s]/g, '') // 3. Remove all punctuation
        .split(' ') // 4. Split into individual words
        .filter(word => word.length > 2) // 5. Filter out short words
    )];
    // --- End of Dynamic Logic ---

    const countKey = 'count'; // Counter
    const keywordsKey = 'search'; // Keywords
    const searchParamKey = 'param'; // Search parameters

    // web worker
    let delayWorker = null; // Search task
    let scrollWorker = null; // Page scrolling simulation

    GM_addStyle(`
        #reward-task { 
            position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; 
            background: rgba(0, 0, 0, 0.4); backdrop-filter: blur(8px); 
            z-index: 99999; display: flex; align-items: center; justify-content: center;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            animation: fadeIn 0.3s ease;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        #reward-task .reward-task-content { 
            width: 90%; max-width: 400px; padding: 24px; 
            background: rgba(255, 255, 255, 0.85); 
            backdrop-filter: blur(16px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            border-radius: 24px; color: #1a1a1a; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.2);
            transform: translateY(0); transition: 0.3s;
        }
        #reward-task .reward-task-content h2 { margin: 0 0 16px; font-size: 20px; font-weight: 600; color: #0078d4; }
        #reward-task .item-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
        #reward-task .label { color: #666; font-size: 14px; }
        #reward-task .value { font-weight: 600; font-size: 15px; }
        #reward-task .progress-container { width: 100%; height: 6px; background: rgba(0,0,0,0.05); border-radius: 3px; margin: 20px 0; overflow: hidden; }
        #reward-task .progress-bar { height: 100%; background: linear-gradient(90deg, #0078d4, #00bcf2); width: 0%; transition: width 1s linear; }
        #reward-task .btn-wrap { display: flex; justify-content: flex-end; margin-top: 10px; }
        .reward-task-btn { 
            cursor: pointer; border: none; font-weight: 600; padding: 10px 20px; 
            font-size: 14px; border-radius: 12px; transition: all 0.2s;
            background: #0078d4; color: white; box-shadow: 0 4px 12px rgba(0, 120, 212, 0.3);
        }
        .reward-task-btn:hover { transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0, 120, 212, 0.4); background: #0086ed; }
        .reward-task-btn:active { transform: translateY(0); }
        .reward-task-btn.warning { background: #ff4d4f; box-shadow: 0 4px 12px rgba(255, 77, 79, 0.3); }
        .reward-task-btn.warning:hover { background: #ff7875; }
    `);

    // Register menu commands
    const registerMenuCommand = () => {
        GM_registerMenuCommand('Start Searches', () => {
            start();
        });

        GM_registerMenuCommand('Stop', () => {
            stop();
            removeTaskCard();
        });
    };

    // Start the search task
    const start = () => {
        GM_setValue(countKey, 1);
        search();
    };

    // Stop the search task
    const stop = () => {
        GM_setValue(countKey, 0);
        if (scrollWorker) {
            scrollWorker.postMessage({ type: "end" });
        }
    };

    // The main search function
    const search = () => {
        const count = GM_getValue(countKey);
        if (!count || count <= 0 || count > searchTimes + 1) {
            stop();
            return;
        }

        const delay = count === 1 ? searchDelaySecondsFirst : Math.floor(Math.random() * (searchDelaySecondsMax - searchDelaySecondsMin + 1)) + searchDelaySecondsMin + (count % searchSafeDelayTimes !== 1 ? 0 : searchSafeDelaySeconds);

        insertTaskCard(count - 1, delay, () => {
            getSearchInfo().then(keyword => {
                const queryInput = document.getElementById('sb_form_q');
                const param = `?q=${encodeURIComponent(keyword)}&form=QBLH&sp=-1&lq=0&pq=${queryInput ? encodeURIComponent(queryInput.value) || '' : ''}&sc=0-0&qs=n&sk=&cvid=${generateRandomString(32)}&brs=1`;

                GM_setValue(countKey, count + 1);
                GM_setValue(searchParamKey, param);

                location.href = searchHost + '/search' + param;
            }).catch(err => {
                stop();
                removeTaskCard();
                alert('Failed to get keywords: ' + err.message);
            });
        });

        if (count > searchTimes) {
            return;
        }

        pretendHuman();
    };

    // Get a keyword for searching
    const getSearchInfo = () => {
        return new Promise((resolve, reject) => {
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const saveConfig = GM_getValue(keywordsKey);
            if (saveConfig && saveConfig.time === today.getTime() && saveConfig.keywords.length > 0) {
                const keyword = saveConfig.keywords[0];
                saveConfig.keywords.splice(0, 1);
                GM_setValue(keywordsKey, saveConfig);
                resolve(keyword);
                return;
            }

            // Fallback to the new dynamic keyword generator
            const keywords = generateKeywordList(100);
            if (keywords && keywords.length > 0) {
                const keyword = keywords[0];
                keywords.splice(0, 1);
                GM_setValue(keywordsKey, {
                    time: today.getTime(),
                    source: 0,
                    keywords: keywords,
                });
                resolve(keyword);
            } else {
                reject(new Error("Default keyword list is empty."));
            }
        });
    };

    // Generate a list of keywords using a 70/30 probability rule.
    const generateKeywordList = (size) => {
        if (size <= 0) {
            return [];
        }

        const generatedKeywords = [];
        for (let i = 0; i < size; i++) {
            if (Math.random() < 0.7) {
                // 70% chance: Pick a full phrase from the original list
                const randomIndex = Math.floor(Math.random() * defaultKeywords.length);
                generatedKeywords.push(defaultKeywords[randomIndex]);
            } else {
                // 30% chance: Splice together a new phrase from the word pool
                const wordCount = Math.floor(Math.random() * 3) + 2; // Generate a phrase of 2, 3, or 4 words
                let newPhrase = [];
                for (let j = 0; j < wordCount; j++) {
                    const randomWordIndex = Math.floor(Math.random() * wordPool.length);
                    newPhrase.push(wordPool[randomWordIndex]);
                }
                generatedKeywords.push(newPhrase.join(' '));
            }
        }

        // Return a unique set of the generated keywords to avoid duplicates in a single run
        return [...new Set(generatedKeywords)];
    };

    // Insert the "Start Tasks" button
    const insertStartBtn = () => {
        if (document.getElementById('reward-task-start')) {
            document.getElementById('reward-task-start').remove();
        }
        if (!startBtn) {
            return;
        }

        const btn = document.createElement('button');
        btn.appendChild(document.createTextNode(startBtnText));
        btn.setAttribute('id', 'reward-task-start');
        btn.setAttribute('type', 'button');
        btn.classList.add('reward-task-btn');
        btn.style.setProperty('margin', '8px');
        btn.style.setProperty('padding', '8px 24px');
        btn.style.setProperty('border-radius', '24px');
        btn.onclick = () => {
            start();
        };

        // Reverted to the original, working setTimeout logic
        setTimeout(() => {
            const queryForm = document.getElementById('sb_form');
            if (queryForm) {
                queryForm.appendChild(btn);
            }
        }, location.pathname !== '/' ? 0 : 5000);
    };

    // Insert the search task card UI
    const insertTaskCard = (times, delay, finish) => {
        removeTaskCard();

        const h = `
        <div id="reward-task">
            <div class="reward-task-content">
                <h2>Rewards Task</h2>
                <div class="item-row">
                    <span class="label">Progress</span>
                    <span class="value">${times} / ${searchTimes}</span>
                </div>
                <div class="item-row">
                    <span class="label">Status</span>
                    <span id="reward-task-status" class="value">${times >= searchTimes ? 'Completed' : 'Waiting...'}</span>
                </div>
                <div class="progress-container">
                    <div id="reward-progress-bar" class="progress-bar"></div>
                </div>
                <div class="item-row">
                    <span id="reward-task-delay" class="value" style="font-size: 13px; color: #888;">
                        ${times >= searchTimes ? 'Closing soon' : `Next search in ${delay}s`}
                    </span>
                    <div class="btn-wrap">
                        <button id="reward-task-stop" type="button" class="reward-task-btn warning">
                            ${times >= searchTimes ? 'Close' : 'Stop'}
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeEnd', h);

        const btnStop = document.querySelector('#reward-task-stop');
        if (btnStop) {
            btnStop.onclick = () => {
                stop();
                removeTaskCard();
            };
        }

        if (times >= searchTimes && closeTaskCardDelaySeconds > 0) {
            setTimeout(() => {
                stop();
                removeTaskCard();
            }, closeTaskCardDelaySeconds * 1000);
        }

        let remainDelay = times >= searchTimes ? 10 : delay;
        const totalDelay = remainDelay;
        const progressBar = document.getElementById('reward-progress-bar');

        delayWorker = getWorker(getCountDown, { times: remainDelay });
        delayWorker.onmessage = e => {
            if (times >= searchTimes) return;

            if (e.data.times === 0) {
                const statusDom = document.getElementById('reward-task-status');
                if (statusDom) statusDom.innerText = 'Searching...';
                finish();
                return;
            }

            const domDelay = document.getElementById('reward-task-delay');
            if (domDelay) domDelay.innerText = `Next search in ${e.data.times}s`;

            if (progressBar) {
                const percent = ((totalDelay - e.data.times) / totalDelay) * 100;
                progressBar.style.width = percent + '%';
            }
        };
        delayWorker.postMessage({ type: "start", interval: 1000 });
    };

    // Remove the task card UI
    const removeTaskCard = () => {
        if (delayWorker) {
            delayWorker.postMessage({ type: 'end' });
        }
        const taskCard = document.getElementById('reward-task');
        if (taskCard) {
            taskCard.remove();
        }
    };

    // Simulate human browsing by scrolling
    const pretendHuman = () => {
        if (scrollWorker) {
            scrollWorker.postMessage({ type: "end" });
        }

        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });

        scrollWorker = getWorker(getCountDown, { times: 120 });
        scrollWorker.onmessage = e => {
            if (e.data.times === 0 || document.documentElement.scrollTop >= document.documentElement.scrollHeight - document.documentElement.clientHeight) {
                scrollWorker.postMessage({ type: "end" });
                window.scrollTo({
                    top: 0,
                    behavior: 'smooth'
                });
                return;
            }
            const number = Math.floor(Math.random() * 10) + 1;
            if (number < 3) {
                window.scrollTo({
                    top: document.documentElement.scrollTop - 200,
                    behavior: 'smooth'
                });
            } else if (number > 5) {
                window.scrollTo({
                    top: document.documentElement.scrollTop + 100,
                    behavior: 'smooth'
                });
            }
        };
        scrollWorker.postMessage({ type: "start", interval: 500 });
    };



    // Web worker helper
    function getWorker(worker, param) {
        const code = worker.toString();
        const blob = new Blob([`(${code})(${JSON.stringify(param)})`]);
        return new Worker(URL.createObjectURL(blob));
    }

    // Countdown function for web worker
    function getCountDown(param) {
        let _timer = null;
        let times = param.times;
        this.onmessage = e => {
            const data = e.data;
            if (data.type === 'start') {
                _timer = setInterval(() => {
                    times--;
                    this.postMessage({ times });
                    if (times <= 0) {
                        clearInterval(_timer);
                    }
                }, data.interval);
            } else if (data.type === 'end') {
                clearInterval(_timer);
            }
        };
    }

    // Generate a random string of a given length
    const generateRandomString = length => {
        const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        const charactersLength = characters.length;
        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }
        return result;
    };

    // --- SCRIPT ENTRY POINT ---

    registerMenuCommand();

    if (pathnames.includes(location.pathname)) {
        insertStartBtn();

        const count = GM_getValue(countKey);
        if (count && count > 0 && count <= searchTimes + 1) {
            search();
            return;
        }

        if (location.search === autoRunSearch) {
            start();
        }
        return;
    }
})();
