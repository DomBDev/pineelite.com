// security_feed.js
var socket = io.connect('http://' + document.domain + ':' + location.port);
var video = document.querySelector('video');

socket.on('broadcast', function(data) {
    var arrayBufferView = new Uint8Array(data);
    var blob = new Blob([arrayBufferView], { type: "video/mp4" });
    var urlCreator = window.URL || window.webkitURL;
    var imageUrl = urlCreator.createObjectURL(blob);
    video.src = imageUrl;
});