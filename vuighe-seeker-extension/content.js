let lastSeekedTime = -1;
let broadcastInterval = null;

function handleMainWindow() {
    startBroadcasting();

    window.addEventListener('hashchange', startBroadcasting);

    window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SEEK_DONE") {
            console.log("[Parent] Video báo đã tua xong. Dọn dẹp URL...");   
            if (broadcastInterval) clearInterval(broadcastInterval);
            removeAutoSeekHash();
        }
    });
}

function startBroadcasting() {
    const hash = window.location.hash;
    if (hash && hash.includes('autoseek=')) {
        const seconds = parseFloat(hash.split('autoseek=')[1]);
        console.log(`[Parent] Bắt đầu gửi lệnh tua tới: ${seconds}s`);

        if (broadcastInterval) clearInterval(broadcastInterval);

        let attempts = 0;
        broadcastInterval = setInterval(() => {
            attempts++;
            const msg = { type: "SEEK_COMMAND", time: seconds };
            
            window.postMessage(msg, "*");
            
            const frames = document.querySelectorAll('iframe');
            frames.forEach(frame => {
                try {
                    frame.contentWindow.postMessage(msg, "*");
                } catch(e) {}
            });

            if (attempts > 30) clearInterval(broadcastInterval);
        }, 500);
    }
}

function removeAutoSeekHash() {
    const cleanUrl = window.location.pathname + window.location.search;
    history.replaceState(null, "", cleanUrl);
}

function handleVideoPlayer() {
    window.addEventListener("message", (event) => {
        if (event.data && event.data.type === "SEEK_COMMAND") {
            const requestedTime = event.data.time;

            if (requestedTime === lastSeekedTime) {
                notifyDone(); 
                return;
            }

            trySeekTo(requestedTime);
        }
    });
}

function trySeekTo(targetTime) {
    const video = document.querySelector('video');
    
    if (!video || video.readyState === 0) {
        return; 
    }
    
    video.currentTime = targetTime;
    lastSeekedTime = targetTime;
    
    video.play().catch(() => {
        video.muted = true;
        video.play();
    });

    notifyDone();
}

function notifyDone() {
    window.top.postMessage({ type: "SEEK_DONE" }, "*");
}

handleMainWindow();
handleVideoPlayer();