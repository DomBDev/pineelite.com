// security_feed.js
var socket = io.connect(window.location.protocol + '//' + window.location.hostname + ':' + location.port, {
    secure: true,
    multiplex: false
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
        sourceBuffer.appendBuffer(new Uint8Array(arrayBuffer));
    });
}