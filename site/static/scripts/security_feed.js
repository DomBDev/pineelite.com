// security_feed.js
var socket = io.connect('wss://' + window.location.hostname + ':' + location.port, {
    secure: true,
    multiplex: false,
    pingTimeout: 120000,
    pingInterval: 5000
});
var video = document.querySelector('video');

if ('MediaSource' in window) {
    var mediaSource = new MediaSource();
    video.src = URL.createObjectURL(mediaSource);
    mediaSource.addEventListener('sourceopen', sourceOpen);
} else {
    console.error('MediaSource API is not available in your browser');
}

function sourceOpen() {
    var sourceBuffer = mediaSource.addSourceBuffer('video/webm; codecs="vp8"');
    socket.on('broadcast', function(arrayBuffer) {
        if (sourceBuffer.updating || !arrayBuffer) return;

        // Check for sourceBuffer in mediaSource.sourceBuffers
        var isSourceBufferInBuffers = false;
        for (let i = 0; i < mediaSource.sourceBuffers.length; i++) {
            if (mediaSource.sourceBuffers[i] === sourceBuffer) {
                isSourceBufferInBuffers = true;
                break;
            }
        }
        
        if (!isSourceBufferInBuffers) return;
        
        sourceBuffer.appendBuffer(new Uint8Array(arrayBuffer));
    });
}