// security_feed.js
var socket = io.connect('https://' + window.location.hostname + ':' + location.port);
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
    socket.on('broadcast', function(data) {
        var uint8Array = new Uint8Array(data);
        sourceBuffer.appendBuffer(uint8Array);
    });
}