// ==UserScript==
// @name         Microsoft Bing Rewards Script by AKAPZG
// @namespace    https://github.com/AKAPZG
// @version      1.0.2
// @description  Automatically completes Microsoft Rewards daily search tasks with a built-in English keyword list.
// @author       AKAPZG
// @license      MIT
// @match        https://www.bing.com/*
// @match        https://cn.bing.com/*
// @match        https://rewards.bing.com/*
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

(function() {
    'use strict';
    // Only run in the top frame
    if (window.top !== window.self) {
        return;
    }

    // This script no longer uses an external API. Keywords are provided in defaultKeywords.

    const rewardHost = 'https://rewards.bing.com'; // Rewards page
    const searchHost = 'https://www.bing.com'; // Search page
    const pathnames = ['/', '/search']; // Trigger search on these pages
    const autoRunSearch = '?runMode=auto&runKey=1362311'; // Auto-run parameter

    const searchTimes = 50; // Total number of searches to perform

    const searchDelaySecondsMin = 15; // Minimum delay between searches (seconds)
    const searchDelaySecondsMax = 30; // Maximum delay between searches (seconds)
    const searchDelaySecondsFirst = 3; // Initial delay before the first search (seconds)
    const closeTaskCardDelaySeconds = 5; // Delay before the "Completed" card closes (seconds)

    const searchSafeDelayTimes = 4; // Trigger a long pause after every N searches
    const searchSafeDelaySeconds = 0 * 60; // Duration of the long pause (seconds)

    const clickDelaySecondsFirst = 3; // Initial delay for daily activity clicks (seconds)

    const startBtn = true; // Show a "Start Tasks" button near the search bar
    const startBtnText = 'Start Tasks'; // Text for the button

    const dailyBtn = true; // Show a "Daily Set" button for reward page tasks
    const dailyBtnText = 'Daily Set'; // Text for the button

    // Default keywords list. The script will use these as a fallback since the API is disabled.
    const defaultKeywords = [
        'Artificial Intelligence breakthroughs', 'Machine Learning applications', 'Quantum computing explained',
        'Latest advancements in biotechnology', 'CRISPR gene editing ethics', 'Renewable energy sources',
        'Future of electric vehicles', 'SpaceX Starship progress', 'NASA Artemis mission',
        'James Webb Space Telescope discoveries', 'The history of ancient Rome', 'Philosophy of Stoicism',
        'Beginner guide to Python programming', 'JavaScript frameworks comparison', 'How does blockchain work',
        'Introduction to cybersecurity', 'Graphic design principles', 'Basics of music theory',
        'World War II major events', 'The Silk Road history', 'Climate change impact',
        'Sustainable agriculture techniques', 'Mental health awareness', 'Benefits of mindfulness meditation',
        'Classic literature recommendations', 'How to learn a new language', 'DIY home improvement ideas',
        'Healthy breakfast recipes', 'Effective workout routines', 'Understanding global economics',
        'Theories of the universe', 'Exploring the deep sea', 'National Geographic documentaries',
        'The British Royal Family', 'History of the Olympic Games', 'Famous painters and their works',
        'Architectural wonders of the world', 'Basics of landscape photography', 'Financial planning for beginners',
        'Stock market investment strategies', 'The rise of social media', 'Understanding digital marketing',
        'How to write a novel', 'Learning to play the guitar', 'Famous speeches in history',
        'The Industrial Revolution', 'Ancient Egyptian civilization', 'Greatest inventions of all time',
        'Travel destinations in Southeast Asia', 'The physics of black holes', 'How do vaccines work',
        'The importance of bees in the ecosystem', 'Learning about classical music composers', 'Volcanoes and plate tectonics',
        'The human genome project'
    ];


    const timeKey = 'time'; // Timestamp
    const countKey = 'count'; // Counter
    const pointsKey = 'points'; // Initial points for the day
    const searchPointsKey = 'searchPoints'; // Initial points for the search task
    const keywordsKey = 'search'; // Keywords
    const searchParamKey = 'param'; // Search parameters

    // web worker
    let delayWorker = null; // Search task
    let scrollWorker = null; // Page scrolling simulation

    GM_addStyle('#reward-task { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: rgba(0, 0, 0, .2); z-index: 99999; }');
    GM_addStyle('#reward-task > .reward-task-content { max-width: 460px; margin: calc(50vh - 32px) auto 0; padding: 20px; background-color: #ffffff; border: 1px solid #e4e7ed; border-radius: 20px; color: #303133; overflow: hidden; transition: 0.3s; box-shadow: 0px 0px 12px rgba(0,0,0,0.12); }');
    GM_addStyle('#reward-task > .reward-task-content > div { display: flex; flex-flow: row wrap; align-items: center; column-gap: 12px; }');
    GM_addStyle('#reward-task > .reward-task-content > div > .item { width: 160px; padding: 7px 0; }');
    GM_addStyle('#reward-task > .reward-task-content > div > .tips { padding: 7px 0; color: #E6A23C; }');
    GM_addStyle('#reward-task > .reward-task-content > div > .btn-wrap { flex-grow: 1; text-align: right; }');
    GM_addStyle('.reward-task-btn { display: inline-block; line-height: 1; white-space: nowrap; cursor: pointer; background: #fff; border: 1px solid #dcdfe6; -webkit-appearance: none; text-align: center; -webkit-box-sizing: border-box; box-sizing: border-box; outline: 0; margin: 0; -webkit-transition: .1s; transition: .1s; font-weight: 500; padding: 8px 16px; font-size: 14px; border-radius: 4px; color: #606266; background-color: #ffffff; border: 1px solid #dcdfe6; border-color: #dcdfe6; }');
    GM_addStyle('.reward-task-btn.warning { color: #fff; background-color: #ebb563; border-color: #ebb563; }');
    GM_addStyle('#ScopeRow { margin-top: 48px; }');
    
    /**
     * Helper function to wait for an element to appear in the DOM.
     * @param {string} selector - The CSS selector of the element to wait for.
     * @param {function} callback - The function to execute once the element is found.
     */
    const waitForElement = (selector, callback) => {
        const maxTries = 50; // Try for 10 seconds (50 * 200ms)
        let currentTry = 0;
        const interval = setInterval(() => {
            const element = document.querySelector(selector);
            if (element) {
                clearInterval(interval); // Element found, stop polling
                callback(element);      // Execute the callback
            } else if (++currentTry >= maxTries) {
                clearInterval(interval); // Max tries reached, stop polling
                console.error(`Bing Rewards Script: Could not find element '${selector}'.`);
            }
        }, 200); // Check every 200ms
    };

    // Register menu commands
    const registerMenuCommand = () => {
        GM_registerMenuCommand('Start Searches', () => {
            start();
        });

        GM_registerMenuCommand('Start Daily Set & Searches', () => {
            navigateToRewardPage();
        });

        GM_registerMenuCommand('Stop', () => {
            stop();
            removeTaskCard();
        });
    };

    // Start the search task
    const start = () => {
        GM_setValue(countKey, 1);
        GM_setValue(searchPointsKey, -1);
        search();
    };

    // Stop the search task
    const stop = () => {
        GM_setValue(countKey, 0);
        GM_setValue(searchPointsKey, -1);
        if (scrollWorker) {
            scrollWorker.postMessage({ type: "end" });
        }
    };

    // Navigate to the rewards page for daily tasks
    const navigateToRewardPage = () => {
        location.href = rewardHost + autoRunSearch;
    };

    // Navigate to the search page to start searches
    const navigateToSearchPage = () => {
        location.href = searchHost + autoRunSearch;
    };

    // Automatically click and complete daily reward activities
    const autoClickRewardActivity = () => {
        insertActivityTaskCard(() => {
            navigateToSearchPage();
        });
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
                const param = `?q=${ encodeURIComponent(keyword) }&form=${ Math.random() > 0.4 ? 'QBLH' : 'QBRE' }&sp=-1&lq=0&pq=${ queryInput ? encodeURIComponent(queryInput.value) || '' : '' }&sc=0-0&qs=n&sk=&cvid=${ generateRandomString(32) }&ghsh=0&ghacc=0&ghpl=`;

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

            // Fallback to defaultKeywords since API is disabled
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

    // Generate a randomized list from default keywords
    const generateKeywordList = (size) => {
        if (size <= 0) {
            return [];
        }
        // Shuffle the array to ensure randomness each day
        const shuffled = [...defaultKeywords].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, size);
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

        waitForElement('#sb_form', (queryForm) => {
            queryForm.appendChild(btn);
        });
    };

    // Insert the "Daily Set" button
    const insertDailyBtn = () => {
        if (document.getElementById('reward-task-daily')) {
            document.getElementById('reward-task-daily').remove();
        }
        if (!dailyBtn) {
            return;
        }
        
        const btn = document.createElement('button');
        btn.appendChild(document.createTextNode(dailyBtnText));
        btn.setAttribute('id', 'reward-task-daily');
        btn.setAttribute('type', 'button');
        btn.classList.add('reward-task-btn');
        btn.style.setProperty('margin', '8px');
        btn.style.setProperty('padding', '8px 24px');
        btn.style.setProperty('border-radius', '24px');
        btn.onclick = () => {
            navigateToRewardPage();
        };

        waitForElement('#sb_form', (queryForm) => {
            queryForm.appendChild(btn);
        });
    };

    // Insert the search task card UI
    const insertTaskCard = (times, delay, finish) => {
        removeTaskCard();

        const h = `<div id="reward-task">
            <div class="reward-task-content">
                <div>
                    <p id="reward-points" class="item">Current Points: ${ getCurrPoints() || '...' }</p>
                </div>
                <div>
                    <p id="task-points" class="item">Points This Run: ${ getTaskPoints() }</p>
                    <p id="task-today-points" class="item">Points Today: ${ getTodayPoints() }</p>
                </div>
                <div>
                    <p class="item">Progress: ${ times } / ${ searchTimes }</p>
                    <p id="reward-task-delay" class="item">${ times >= searchTimes ? `Completed${ closeTaskCardDelaySeconds > 0 ? ', closing in ' + closeTaskCardDelaySeconds + 's' : '' }` : `Waiting: ${ delay } s` }</p>
                    <div class="btn-wrap">${ times >= searchTimes ? '<button id="reward-task-cancel" type="button" class="reward-task-btn warning">Close</button>' : '<button id="reward-task-stop" type="button" class="reward-task-btn warning">Stop</button>' }</div>
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

        const btnCancel = document.querySelector('#reward-task-cancel');
        if (btnCancel) {
            btnCancel.onclick = () => {
                stop();
                removeTaskCard();
            };
        }

        if (times >= searchTimes && closeTaskCardDelaySeconds > 0) {
            setTimeout(() => {
                removeTaskCard();
            }, closeTaskCardDelaySeconds * 1000);
        }

        let remainDelay = times >= searchTimes ? 10 : delay;
        delayWorker = getWorker(getCountDown, { times: remainDelay });
        delayWorker.onmessage = e => {
            const domCurrPoints = document.getElementById('reward-points');
            const domTaskPoints = document.getElementById('task-points');
            const domTaskTodayPoints = document.getElementById('task-today-points');
            if(domCurrPoints) domCurrPoints.innerText = `Current Points: ${ getCurrPoints() || '...' }`;
            if(domTaskPoints) domTaskPoints.innerText = `Points This Run: ${ getTaskPoints() }`;
            if(domTaskTodayPoints) domTaskTodayPoints.innerText = `Points Today: ${ getTodayPoints() }`;

            if (times >= searchTimes) {
                return;
            }

            if (e.data.times === 0) {
                finish();
                return;
            }

            const domDelay = document.getElementById('reward-task-delay');
            if (!domDelay) {
                return;
            }
            domDelay.innerText = `Waiting: ${ e.data.times } s`;
        };
        delayWorker.postMessage({ type: "start", interval: 1000 });
    };

    // Insert the daily activity task card UI
    const insertActivityTaskCard = (finish) => {
        removeTaskCard();

        const daily = { todo: [], total: 0, finish: 0 };
        const dailyActivitys = document.querySelectorAll('mee-rewards-daily-set-section mee-card.ng-scope.c-card:not([disabled=disabled]) a.ds-card-sec');
        for (let i = 0; i < dailyActivitys.length; i++) {
            daily.total++;
            if (dailyActivitys[i].querySelectorAll('.mee-icon.mee-icon-AddMedium').length > 0) {
                daily.todo.push(dailyActivitys[i]);
            } else {
                daily.finish++;
            }
        }

        const more = { todo: [], total: 0, finish: 0 };
        const moreActivitys = document.querySelectorAll('mee-rewards-more-activities-card mee-card.ng-scope.c-card:not([disabled=disabled]) a.ds-card-sec');
        for (let i = 0; i < moreActivitys.length; i++) {
            more.total++;
            if (moreActivitys[i].querySelectorAll('.mee-icon.mee-icon-AddMedium').length > 0) {
                more.todo.push(moreActivitys[i]);
            } else {
                more.finish++;
            }
        }
        
        let delay = more.todo.length + clickDelaySecondsFirst;
        const today = new Date();
        if (today.getHours() >= 12) {
            delay += daily.todo.length;
        }

        const h = `<div id="reward-task">
            <div class="reward-task-content">
                <div>
                    <p id="reward-points" class="item">Current Points: ${ getCurrPoints() || '...' }</p>
                </div>
                <div>
                    <p id="task-points" class="item">Points This Run: ${ getTaskPoints() }</p>
                    <p id="task-today-points" class="item">Points Today: ${ getTodayPoints() }</p>
                </div>
                <div>
                    <p id="daily-progress" class="item">Daily Tasks: ${ daily.finish } / ${ daily.total }</p>
                    <p id="more-progress" class="item">More Tasks: ${ more.finish } / ${ more.total }</p>
                </div>
                <div>
                    <p id="reward-task-delay" class="item">Waiting
})();
