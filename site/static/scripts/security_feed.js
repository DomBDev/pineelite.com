// security_feed.js
var socket = io.connect('http://' + window.location.hostname + ':' + location.port);
var video = document.querySelector('video');

socket.on('broadcast', function(data) {
    video.src = data;
});