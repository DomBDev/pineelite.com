// security_feed.js
var socket = io.connect('http://' + document.domain + ':' + location.port);
var video = document.querySelector('video');

socket.on('broadcast', function(data) {
    video.src = data;
});