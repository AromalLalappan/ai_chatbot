/**
 * CampusPulse AI - Real-time College Freshers Chatbot
 * Features: SSE Token Streaming (Zero Lag), Multi-turn Memory, Markdown Parsing,
 * Voice Recognition, Text-to-Speech, Dark/Light Themes, and Freshers Handbook Modal.
 */

(function () {
    'use strict';

    // -------------------------------------------------------------------------
    // DOM Elements
    // -------------------------------------------------------------------------
    const chatBody = document.getElementById("chat-body");
    const chatInput = document.getElementById("chat-input");
    const sendBtn = document.getElementById("send-btn");
    const micBtn = document.getElementById("mic-btn");
    const clearChatBtn = document.getElementById("clear-chat-btn");
    const themeToggleBtn = document.getElementById("theme-toggle-btn");
    const handbookBtn = document.getElementById("handbook-btn");
    const handbookModal = document.getElementById("handbook-modal");
    const modalCloseBtn = document.getElementById("modal-close-btn");
    const scrollBottomBtn = document.getElementById("scroll-bottom-btn");
    const ttsToggleBtn = document.getElementById("tts-toggle-btn");

    // -------------------------------------------------------------------------
    // State Management
    // -------------------------------------------------------------------------
    let conversationHistory = [];
    let isGenerating = false;
    let isSpeechEnabled = false;
    let recognition = null;
    let isRecording = false;

    // -------------------------------------------------------------------------
    // Theme Initialization
    // -------------------------------------------------------------------------
    function initTheme() {
        const savedTheme = localStorage.getItem("campuspulse_theme") || "dark";
        document.documentElement.setAttribute("data-theme", savedTheme);
        updateThemeIcon(savedTheme);
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute("data-theme") || "dark";
        const newTheme = currentTheme === "dark" ? "light" : "dark";
        document.documentElement.setAttribute("data-theme", newTheme);
        localStorage.setItem("campuspulse_theme", newTheme);
        updateThemeIcon(newTheme);
    }

    function updateThemeIcon(theme) {
        if (!themeToggleBtn) return;
        themeToggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
        themeToggleBtn.setAttribute("title", theme === "dark" ? "Switch to Light Mode" : "Switch to Dark Mode");
    }

    // -------------------------------------------------------------------------
    // Markdown Parser with Built-in Fallback
    // -------------------------------------------------------------------------
    function renderMarkdown(rawText) {
        if (!rawText) return "";

        // If marked.js CDN is available
        if (typeof window.marked !== "undefined" && typeof window.marked.parse === "function") {
            try {
                return window.DOMPurify ? window.DOMPurify.sanitize(window.marked.parse(rawText)) : window.marked.parse(rawText);
            } catch (err) {
                console.warn("Marked.js error, falling back to regex parser:", err);
            }
        }

        // Lightweight, safe built-in markdown parser
        let html = rawText
            // Escape HTML tags to prevent XSS
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;");

        // Code blocks
        html = html.replace(/```([a-z0-9]*)\n([\s\S]*?)```/gi, (match, lang, code) => {
            return `<pre><code class="lang-${lang}">${code.trim()}</code></pre>`;
        });

        // Inline code
        html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

        // Headers
        html = html.replace(/^### (.*$)/gim, "<h3>$1</h3>");
        html = html.replace(/^## (.*$)/gim, "<h2>$1</h2>");
        html = html.replace(/^# (.*$)/gim, "<h1>$1</h1>");

        // Bold & Italic
        html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
        html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");

        // Blockquotes
        html = html.replace(/^\> (.*$)/gim, "<blockquote>$1</blockquote>");

        // Unordered lists
        html = html.replace(/^\s*[-*]\s+(.*)$/gim, "<li>$1</li>");
        html = html.replace(/(<li>[\s\S]*?<\/li>)/gi, "<ul>$1</ul>");
        // Clean duplicate nested uls
        html = html.replace(/<\/ul>\s*<ul>/gi, "");

        // Links
        html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

        // Line breaks (preserving paragraphs)
        html = html.replace(/\n{2,}/g, "</p><p>");
        html = html.replace(/\n/g, "<br>");

        return `<p>${html}</p>`;
    }

    // -------------------------------------------------------------------------
    // Chat Message Rendering (High Performance DOM Manipulation)
    // -------------------------------------------------------------------------
    function hideWelcomeHero() {
        const welcomeHero = document.getElementById("welcome-hero");
        if (welcomeHero) {
            welcomeHero.style.display = "none";
        }
    }

    function showWelcomeHero() {
        const welcomeHero = document.getElementById("welcome-hero");
        if (welcomeHero) {
            welcomeHero.style.display = "flex";
        }
    }

    function scrollToBottom(smooth = true) {
        if (!chatBody) return;
        chatBody.scrollTo({
            top: chatBody.scrollHeight,
            behavior: smooth ? "smooth" : "auto"
        });
    }

    function formatTime() {
        const now = new Date();
        return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    function appendUserMessage(text) {
        hideWelcomeHero();

        const row = document.createElement("div");
        row.className = "message-row user";

        const wrap = document.createElement("div");
        wrap.className = "message-content-wrap";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.textContent = text;

        const meta = document.createElement("div");
        meta.className = "message-meta";
        meta.innerHTML = `<span>${formatTime()}</span>`;

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "👤";

        wrap.appendChild(bubble);
        wrap.appendChild(meta);
        row.appendChild(wrap);
        row.appendChild(avatar);

        chatBody.appendChild(row);
        scrollToBottom();

        // Save to local conversation history
        conversationHistory.push({ role: "user", content: text });
    }

    function createTypingIndicator() {
        hideWelcomeHero();

        const row = document.createElement("div");
        row.className = "message-row bot typing-indicator-row";
        row.id = "active-typing-indicator";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "🎓";

        const wrap = document.createElement("div");
        wrap.className = "message-content-wrap";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble typing-bubble";
        bubble.innerHTML = `
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <span class="typing-text">CampusPulse is finding the best advice...</span>
        `;

        wrap.appendChild(bubble);
        row.appendChild(avatar);
        row.appendChild(wrap);

        chatBody.appendChild(row);
        scrollToBottom();
        return row;
    }

    function removeTypingIndicator() {
        const indicator = document.getElementById("active-typing-indicator");
        if (indicator) {
            indicator.remove();
        }
    }

    function createBotMessageContainer() {
        hideWelcomeHero();

        const row = document.createElement("div");
        row.className = "message-row bot";

        const avatar = document.createElement("div");
        avatar.className = "message-avatar";
        avatar.textContent = "🎓";

        const wrap = document.createElement("div");
        wrap.className = "message-content-wrap";

        const bubble = document.createElement("div");
        bubble.className = "message-bubble";
        bubble.innerHTML = '<span class="streaming-caret"></span>';

        const meta = document.createElement("div");
        meta.className = "message-meta";

        const timeSpan = document.createElement("span");
        timeSpan.textContent = formatTime();

        const copyBtn = document.createElement("button");
        copyBtn.className = "message-action-btn";
        copyBtn.innerHTML = '📋 Copy';
        copyBtn.title = "Copy answer to clipboard";

        const speakBtn = document.createElement("button");
        speakBtn.className = "message-action-btn";
        speakBtn.innerHTML = '🔊 Read';
        speakBtn.title = "Read aloud";

        meta.appendChild(timeSpan);
        meta.appendChild(copyBtn);
        meta.appendChild(speakBtn);

        wrap.appendChild(bubble);
        wrap.appendChild(meta);
        row.appendChild(avatar);
        row.appendChild(wrap);

        chatBody.appendChild(row);
        scrollToBottom();

        return { row, bubble, copyBtn, speakBtn };
    }

    // -------------------------------------------------------------------------
    // Send Message with SSE Token Streaming (Zero Lag)
    // -------------------------------------------------------------------------
    async function sendMessage(overrideText = null) {
        if (isGenerating) return;

        const message = (overrideText || chatInput.value).trim();
        if (!message) return;

        // Reset input immediately
        chatInput.value = "";
        autoResizeInput();

        // Render user message
        appendUserMessage(message);

        // UI states
        isGenerating = true;
        sendBtn.disabled = true;
        sendBtn.innerHTML = '⏳';

        // Show immediate typing pulse
        createTypingIndicator();

        let accumulatedResponse = "";
        let botElements = null;

        try {
            // Attempt Server-Sent Events (SSE) streaming
            const response = await fetch("/chat/stream", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    message: message,
                    history: conversationHistory.slice(-6)
                })
            });

            if (!response.ok || !response.body) {
                throw new Error("Streaming endpoint unavailable, using standard chat.");
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder("utf-8");
            let buffer = "";

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n\n");
                buffer = lines.pop(); // keep partial line for next iteration

                for (const line of lines) {
                    const trimmed = line.trim();
                    if (!trimmed.startsWith("data:")) continue;

                    const dataStr = trimmed.replace(/^data:\s*/, "");
                    if (dataStr === "[DONE]") {
                        break;
                    }

                    try {
                        const parsed = JSON.parse(dataStr);
                        if (parsed.chunk) {
                            if (!botElements) {
                                removeTypingIndicator();
                                botElements = createBotMessageContainer();
                            }
                            accumulatedResponse += parsed.chunk;
                            botElements.bubble.innerHTML = renderMarkdown(accumulatedResponse) + '<span class="streaming-caret"></span>';
                            
                            // Auto scroll if near bottom
                            if (chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight < 250) {
                                scrollToBottom(false);
                            }
                        }
                    } catch (e) {
                        // In case chunk is raw text
                        if (dataStr) {
                            if (!botElements) {
                                removeTypingIndicator();
                                botElements = createBotMessageContainer();
                            }
                            accumulatedResponse += dataStr;
                            botElements.bubble.innerHTML = renderMarkdown(accumulatedResponse) + '<span class="streaming-caret"></span>';
                        }
                    }
                }
            }

        } catch (streamErr) {
            console.warn("SSE Streaming notice:", streamErr);

            // Fallback to standard /chat endpoint
            try {
                const fallbackRes = await fetch("/chat", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        message: message,
                        history: conversationHistory.slice(-6)
                    })
                });
                const data = await fallbackRes.json();
                accumulatedResponse = data.response || "I could not retrieve an answer. Please try again.";
            } catch (err) {
                accumulatedResponse = "⚠️ Network glitch occurred. Please check your connection or ask again.";
            }
        } finally {
            removeTypingIndicator();

            if (!botElements) {
                botElements = createBotMessageContainer();
            }

            // Final render without blinking caret
            botElements.bubble.innerHTML = renderMarkdown(accumulatedResponse);
            scrollToBottom();

            // Setup copy action
            botElements.copyBtn.addEventListener("click", () => {
                navigator.clipboard.writeText(accumulatedResponse).then(() => {
                    botElements.copyBtn.innerHTML = '✅ Copied!';
                    setTimeout(() => {
                        botElements.copyBtn.innerHTML = '📋 Copy';
                    }, 2000);
                });
            });

            // Setup speech action
            botElements.speakBtn.addEventListener("click", () => {
                speakText(accumulatedResponse);
            });

            // Auto read if global TTS is enabled
            if (isSpeechEnabled) {
                speakText(accumulatedResponse);
            }

            // Save bot response to history
            conversationHistory.push({ role: "assistant", content: accumulatedResponse });

            // Reset controls
            isGenerating = false;
            sendBtn.disabled = false;
            sendBtn.innerHTML = '➤';
            chatInput.focus();
        }
    }

    // -------------------------------------------------------------------------
    // Text-To-Speech (TTS)
    // -------------------------------------------------------------------------
    function speakText(text) {
        if (!('speechSynthesis' in window)) {
            alert("Text-to-speech is not supported in this browser.");
            return;
        }

        window.speechSynthesis.cancel(); // Stop current speech

        // Strip markdown characters for natural voice reading
        const plainText = text
            .replace(/[#*`_~>[\]]/g, '')
            .replace(/\((http[s]?:\/\/[^\)]+)\)/g, '')
            .replace(/\n+/g, ' ');

        const utterance = new SpeechSynthesisUtterance(plainText);
        utterance.rate = 1.0;
        utterance.pitch = 1.0;

        window.speechSynthesis.speak(utterance);
    }

    // -------------------------------------------------------------------------
    // Speech-To-Text (Voice Dictation)
    // -------------------------------------------------------------------------
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            if (micBtn) micBtn.style.display = "none";
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = "en-US";

        recognition.onstart = function () {
            isRecording = true;
            if (micBtn) {
                micBtn.classList.add("recording");
                micBtn.title = "Listening... Speak your college question!";
            }
        };

        recognition.onresult = function (event) {
            const transcript = event.results[0][0].transcript;
            chatInput.value = transcript;
            autoResizeInput();
            chatInput.focus();
        };

        recognition.onerror = function (event) {
            console.warn("Speech recognition error:", event.error);
            stopRecording();
        };

        recognition.onend = function () {
            stopRecording();
        };
    }

    function toggleRecording() {
        if (!recognition) return;
        if (isRecording) {
            recognition.stop();
        } else {
            recognition.start();
        }
    }

    function stopRecording() {
        isRecording = false;
        if (micBtn) {
            micBtn.classList.remove("recording");
            micBtn.title = "Click to speak your question";
        }
    }

    // -------------------------------------------------------------------------
    // Input Auto-Resizing & Event Listeners
    // -------------------------------------------------------------------------
    function autoResizeInput() {
        if (!chatInput) return;
        chatInput.style.height = "auto";
        const newHeight = Math.min(chatInput.scrollHeight, 120);
        chatInput.style.height = newHeight + "px";
    }

    // -------------------------------------------------------------------------
    // Freshers Handbook Modal Handling
    // -------------------------------------------------------------------------
    function openHandbook() {
        if (handbookModal) {
            handbookModal.classList.add("active");
            document.body.style.overflow = "hidden";
        }
    }

    function closeHandbook() {
        if (handbookModal) {
            handbookModal.classList.remove("active");
            document.body.style.overflow = "auto";
        }
    }

    function setupHandbookTabs() {
        const tabBtns = document.querySelectorAll(".tab-btn");
        const tabPanes = document.querySelectorAll(".tab-pane");

        tabBtns.forEach(btn => {
            btn.addEventListener("click", () => {
                const targetTab = btn.getAttribute("data-tab");

                tabBtns.forEach(b => b.classList.remove("active"));
                tabPanes.forEach(p => p.classList.remove("active"));

                btn.classList.add("active");
                const targetPane = document.getElementById(targetTab);
                if (targetPane) {
                    targetPane.classList.add("active");
                }
            });
        });
    }

    // -------------------------------------------------------------------------
    // Clear Chat
    // -------------------------------------------------------------------------
    function clearChat() {
        if (confirm("Clear conversation history and restart fresher guide?")) {
            conversationHistory = [];
            window.speechSynthesis && window.speechSynthesis.cancel();
            chatBody.innerHTML = "";
            showWelcomeHero();
            // Re-render hero section
            window.location.reload();
        }
    }

    // -------------------------------------------------------------------------
    // Scroll-to-Bottom Button Visibility
    // -------------------------------------------------------------------------
    function handleScroll() {
        if (!chatBody || !scrollBottomBtn) return;
        const scrollDistance = chatBody.scrollHeight - chatBody.scrollTop - chatBody.clientHeight;
        if (scrollDistance > 300) {
            scrollBottomBtn.classList.add("visible");
        } else {
            scrollBottomBtn.classList.remove("visible");
        }
    }

    // -------------------------------------------------------------------------
    // Setup Global Quick Prompts
    // -------------------------------------------------------------------------
    function setupQuickPrompts() {
        document.querySelectorAll(".prompt-card").forEach(card => {
            card.addEventListener("click", () => {
                const promptQuery = card.getAttribute("data-query");
                if (promptQuery) {
                    sendMessage(promptQuery);
                }
            });
        });
    }

    // -------------------------------------------------------------------------
    // Initialization Entrypoint
    // -------------------------------------------------------------------------
    function init() {
        initTheme();
        initSpeechRecognition();
        setupHandbookTabs();
        setupQuickPrompts();

        // Input events
        if (chatInput) {
            chatInput.addEventListener("input", autoResizeInput);

            chatInput.addEventListener("keydown", function (e) {
                if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                }
            });
        }

        // Send Button
        if (sendBtn) {
            sendBtn.addEventListener("click", () => sendMessage());
        }

        // Microphone Button
        if (micBtn) {
            micBtn.addEventListener("click", toggleRecording);
        }

        // Theme Toggle
        if (themeToggleBtn) {
            themeToggleBtn.addEventListener("click", toggleTheme);
        }

        // Handbook Modal
        if (handbookBtn) {
            handbookBtn.addEventListener("click", openHandbook);
        }

        if (modalCloseBtn) {
            modalCloseBtn.addEventListener("click", closeHandbook);
        }

        if (handbookModal) {
            handbookModal.addEventListener("click", (e) => {
                if (e.target === handbookModal) {
                    closeHandbook();
                }
            });
        }

        // Clear Chat
        if (clearChatBtn) {
            clearChatBtn.addEventListener("click", clearChat);
        }

        // TTS Toggle
        if (ttsToggleBtn) {
            ttsToggleBtn.addEventListener("click", () => {
                isSpeechEnabled = !isSpeechEnabled;
                ttsToggleBtn.classList.toggle("active", isSpeechEnabled);
                ttsToggleBtn.title = isSpeechEnabled ? "Voice Narration: ON" : "Voice Narration: OFF";
            });
        }

        // Scroll listener
        if (chatBody) {
            chatBody.addEventListener("scroll", handleScroll);
        }

        if (scrollBottomBtn) {
            scrollBottomBtn.addEventListener("click", () => scrollToBottom(true));
        }

        // ESC key to close modal
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") {
                closeHandbook();
            }
        });
    }

    // Launch on DOMContentLoaded
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }

})();
