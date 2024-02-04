// security_feed.js
var socket = io.connect('https://' + window.location.hostname + ':' + location.port);
var video = document.querySelector('video');

socket.on('broadcast', function(data) {
    if (video) {
        video.src = data;
    } else {
        console.error('Video element not found');
    }
});