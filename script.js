document.addEventListener('DOMContentLoaded', () => {
    // --- UI & THEME LOGIC (Runs on all pages) ---
    const menuBtn = document.getElementById('menu-btn');
    const menu = document.getElementById('off-screen-menu');
    const darkModeSwitch = document.getElementById('dark-mode-switch');
    const cookieBanner = document.getElementById('cookie-consent-banner');
    const acceptCookiesBtn = document.getElementById('accept-cookies-btn');
    let menuCloseTimer;

    if (menuBtn && menu) {
        const toggleMenu = () => {
            menu.classList.toggle('active');
            clearTimeout(menuCloseTimer);
            if (menu.classList.contains('active')) {
                menuCloseTimer = setTimeout(() => menu.classList.remove('active'), 10000); // Auto-close after 10 seconds
            }
        };
        menuBtn.addEventListener('click', toggleMenu);
        
        document.addEventListener('click', (e) => {
            if (menu.classList.contains('active') && !menu.contains(e.target) && !menuBtn.contains(e.target)) {
                menu.classList.remove('active');
            }
        });
    }

    const applyTheme = (isDark) => {
        document.body.classList.toggle('dark-mode', isDark);
        if (darkModeSwitch) darkModeSwitch.checked = isDark;
        localStorage.setItem('ticTacRealmTheme', isDark ? 'dark' : 'light');
    };

    if (darkModeSwitch) {
        darkModeSwitch.addEventListener('change', (e) => applyTheme(e.target.checked));
    }
    const savedTheme = localStorage.getItem('ticTacRealmTheme') === 'dark';
    applyTheme(savedTheme);

    if (cookieBanner && acceptCookiesBtn) {
        if (!localStorage.getItem('cookieConsent')) {
            cookieBanner.style.display = 'flex';
        }
        acceptCookiesBtn.addEventListener('click', () => {
            localStorage.setItem('cookieConsent', 'true');
            cookieBanner.style.display = 'none';
        });
    }

    // --- GAME LOGIC (Only runs if game board exists on the page) ---
    if (document.getElementById('board')) {
        const controller = (() => {
            const elements = {
                board: document.getElementById('board'),
                status: document.getElementById('status'),
                winLine: document.getElementById('win-line'),
                adModal: document.getElementById('adModal'),
                adTimerText: document.getElementById('ad-timer-text'),
                adModalTitle: document.getElementById('ad-modal-title'),
                levelDisplay: document.getElementById('level'),
                timerDisplay: document.getElementById('timer'),
                hintBtn: document.getElementById('hint-btn'),
                undoBtn: document.getElementById('undo-btn'),
            };

            const winCombos = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];
            let state = {};
            let gameTimerInterval;

            const defaultState = {
                board: Array(9).fill(null), history: [],
                currentPlayer: 'X', gameMode: 'ai', level: 1, isGameOver: false, timeElapsed: 0,
            };
            
            const loadState = () => {
                const savedLevel = parseInt(localStorage.getItem('ticTacRealmLevel'), 10);
                state = { ...defaultState };
                if (savedLevel && !isNaN(savedLevel)) {
                    state.level = savedLevel;
                }
            };
            
            const saveState = () => {
                localStorage.setItem('ticTacRealmLevel', state.level);
            };
            
            const startTimer = () => {
                stopTimer();
                state.timeElapsed = 0;
                gameTimerInterval = setInterval(() => {
                    state.timeElapsed++;
                    const mins = Math.floor(state.timeElapsed / 60).toString().padStart(2, '0');
                    const secs = (state.timeElapsed % 60).toString().padStart(2, '0');
                    elements.timerDisplay.textContent = `${mins}:${secs}`;
                }, 1000);
            };
            
            const stopTimer = () => {
                clearInterval(gameTimerInterval);
            };

            const render = () => {
                elements.board.innerHTML = '';
                state.board.forEach((cell, index) => {
                    const div = document.createElement('div');
                    div.className = 'cell';
                    if (cell) {
                        const span = document.createElement('span');
                        span.className = 'symbol';
                        span.textContent = cell;
                        div.appendChild(span);
                        div.classList.add(cell.toLowerCase(), 'occupied');
                    }
                    div.addEventListener('click', () => handleMove(index));
                    elements.board.appendChild(div);
                });
                updateStatus();
            };
            
            const updateStatus = () => {
                elements.levelDisplay.textContent = state.level;
                if (state.isGameOver) return;
                let statusText = state.gameMode === 'ai' ? `Your Turn (X)` : `Player ${state.currentPlayer}'s Turn`;
                elements.status.textContent = statusText;
            };

            const handleMove = (index) => {
                if (state.board[index] || state.isGameOver || (state.gameMode === 'ai' && state.currentPlayer === 'O')) return;
                state.history.push([...state.board]);
                state.board[index] = state.currentPlayer;
                render();
                const winnerInfo = checkWinner();
                if (winnerInfo) {
                    endGame(winnerInfo);
                    return;
                }
                state.currentPlayer = state.currentPlayer === 'X' ? 'O' : 'X';
                updateStatus();
                if (state.gameMode === 'ai' && state.currentPlayer === 'O') {
                    setTimeout(aiMove, 400);
                }
            };

            const aiMove = () => {
                const bestMove = findBestMove(state.board);
                if (bestMove.index !== -1) {
                    state.history.push([...state.board]);
                    state.board[bestMove.index] = 'O';
                    render();
                    const winnerInfo = checkWinner();
                    if (winnerInfo) { endGame(winnerInfo); return; }
                    state.currentPlayer = 'X';
                    updateStatus();
                }
            };

            const checkWinner = () => {
                for (let i = 0; i < winCombos.length; i++) {
                    const combo = winCombos[i];
                    if (state.board[combo[0]] && state.board[combo[0]] === state.board[combo[1]] && state.board[combo[0]] === state.board[combo[2]]) {
                        return { winner: state.board[combo[0]], index: i };
                    }
                }
                return state.board.every(cell => cell) ? { winner: 'Tie' } : null;
            };

            const endGame = (info) => {
                state.isGameOver = true;
                stopTimer();
                elements.status.textContent = info.winner === 'Tie' ? "It's a tie!" : `${info.winner} wins!`;
                if (info.winner !== 'Tie') drawWinLine(info.index);
                
                const completedLevel = state.level;
                if (state.gameMode === 'ai' && (info.winner === 'X' || info.winner === 'Tie')) {
                     state.level++;
                     saveState();
                }

                // Show ad every 5 levels
                if (state.gameMode === 'ai' && completedLevel > 0 && completedLevel % 5 === 0) {
                    showAd("Level Complete!", nextLevel);
                } else {
                    setTimeout(nextLevel, 2500);
                }
            };
            
            const nextLevel = () => {
                resetBoard();
            };

            const resetBoard = () => {
                state.board = Array(9).fill(null);
                state.history = [];
                state.currentPlayer = 'X';
                state.isGameOver = false;
                elements.winLine.style.transform = 'scaleX(0)';
                startTimer();
                render();
            };
            
            const drawWinLine = (comboIndex) => {
                const data = {0:[15,5,90,0],1:[48.5,5,90,0],2:[82,5,90,0],3:[5,15.5,90,90],4:[5,48.5,90,90],5:[5,82,90,90],6:[5,5,120,45],7:[5,95,120,135]}[comboIndex];
                elements.winLine.style.top = `${data[0]}%`;
                elements.winLine.style.left = `${data[1]}%`;
                elements.winLine.style.width = `${data[2]}%`;
                elements.winLine.style.transform = `rotate(${data[3]}deg) scaleX(1)`;
            };
            
            const showAd = (title, callback) => {
                if(!elements.adModal) return;
                elements.adModalTitle.textContent = title;
                elements.adModal.classList.add('visible');
                let countdown = 5;
                elements.adTimerText.innerHTML = `Your reward will be ready in <strong>${countdown}</strong> seconds.`;
                const interval = setInterval(() => {
                    countdown--;
                    elements.adTimerText.innerHTML = `Your reward will be ready in <strong>${countdown}</strong> seconds.`;
                    if (countdown <= 0) {
                        clearInterval(interval);
                        elements.adModal.classList.remove('visible');
                        if(callback) callback();
                    }
                }, 1000);
            };
            
            const findBestMove = (board, player = 'O') => {
                let bestVal = -Infinity;
                let move = { index: -1 };
                for (let i = 0; i < board.length; i++) {
                    if (board[i] === null) {
                        board[i] = player;
                        let moveVal = minimax(board, 0, false, player);
                        board[i] = null;
                        if (moveVal > bestVal) { move.index = i; bestVal = moveVal; }
                    }
                }
                return move;
            };
            
            const minimax = (board, depth, isMaximizing, aiPlayer) => {
                const humanPlayer = aiPlayer === 'O' ? 'X' : 'O';
                const winner = (() => {
                    for (const combo of winCombos) {
                        if (board[combo[0]] && board[combo[0]] === board[combo[1]] && board[combo[0]] === board[combo[2]]) return board[combo[0]];
                    }
                    return board.every(cell => cell) ? 'Tie' : null;
                })();

                if (winner === aiPlayer) return 10 - depth;
                if (winner === humanPlayer) return depth - 10;
                if (winner === 'Tie') return 0;

                if (isMaximizing) {
                    let best = -Infinity;
                    for (let i = 0; i < 9; i++) {
                        if (board[i] === null) {
                            board[i] = aiPlayer;
                            best = Math.max(best, minimax(board, depth + 1, !isMaximizing, aiPlayer));
                            board[i] = null;
                        }
                    }
                    return best;
                } else {
                    let best = Infinity;
                    for (let i = 0; i < 9; i++) {
                        if (board[i] === null) {
                            board[i] = humanPlayer;
                            best = Math.min(best, minimax(board, depth + 1, !isMaximizing, aiPlayer));
                            board[i] = null;
                        }
                    }
                    return best;
                }
            };

            const init = () => {
                loadState();
                resetBoard();
                elements.hintBtn.addEventListener('click', () => controller.requestHint());
                elements.undoBtn.addEventListener('click', () => controller.requestUndo());
            };
            init();

            // Expose public methods to be used by onclick attributes in HTML
            return {
                startGame: (mode) => {
                    loadState(); // reload state including level
                    state.gameMode = mode;
                    if(mode === '2p') state.level = 1; // Reset level for 2P mode
                    resetBoard();
                },
                requestHint: () => {
                    if (state.isGameOver || state.currentPlayer !== 'X' || state.gameMode !== 'ai') return;
                    showAd("Hint Reward", () => {
                        const hintMove = findBestMove(state.board, 'X');
                        if (hintMove.index !== -1) {
                            const cell = elements.board.children[hintMove.index];
                            if(cell) {
                                cell.classList.add('hint-cell');
                                setTimeout(() => cell.classList.remove('hint-cell'), 1500);
                            }
                        }
                    });
                },
                requestUndo: () => {
                    if (state.isGameOver || state.history.length < 1) return;
                    showAd("Undo Reward", () => {
                        state.board = state.history.pop();
                        // In AI mode, undo the AI's move as well
                        if (state.gameMode === 'ai' && state.history.length > 0 && state.currentPlayer === 'X') {
                            state.board = state.history.pop();
                        }
                        state.currentPlayer = 'X';
                        state.isGameOver = false;
                        elements.winLine.style.transform = 'scaleX(0)';
                        render();
                        startTimer(); // Restart timer after undo
                    });
                }
            };
        })();
        
        window.controller = controller;
    }
});