// game.js
var canvas = document.getElementById('gameCanvas');

canvas.width = window.innerWidth * 0.8;
canvas.height = window.innerHeight * 0.8;

var ctx = canvas.getContext('2d');

var fps = 30;
var now;
var then = Date.now();
var interval = 1000 / fps;
var delta;

var friction = 0.8;

var gameOver = false;

var keys = {
    ArrowRight: false,
    ArrowLeft: false
};

var camera = {
    x: 0,
    y: 0,
    width: canvas.width,
    height: canvas.height
};

var player = {
    x: canvas.width / 2,
    y: canvas.height - 100,
    width: 50,
    height: 50,
    dy: 0,
    dx: 0,
    gravity: 1.25,
    jumpForce: 25,
    jumping: false,
    grounded: false,
    score: 0
};

var max_jump_height = player.jumpForce * player.jumpForce / (2 * player.gravity);

var lands = [];

var platforms = [];

function drawPlayer() {
    ctx.fillStyle = "#6495ED";
    ctx.fillRect(player.x - camera.x, player.y - camera.y, player.width, player.height);
}

function drawPlatforms() {
    ctx.fillStyle = "#FFA07A";
    for (var i = 0; i < platforms.length; i++) {
        ctx.fillRect(platforms[i].x - camera.x, platforms[i].y - camera.y, platforms[i].width, platforms[i].height);
    }
}

function drawLands() {
    ctx.fillStyle = "#90EE90";
    for (var i = 0; i < lands.length; i++) {
        ctx.fillRect(lands[i].x - camera.x, lands[i].y - camera.y, lands[i].width, lands[i].height);
    }
}


function drawScore() {
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "left"; // Set text alignment to left
    ctx.textBaseline = "top"; // Set text baseline to top
    ctx.font = "20px Arial";
    ctx.fillText("Score: " + player.score, 10, 10);
}

function playerDeath() {
    gameOver = true;
    ctx.fillStyle = "#000000";
    ctx.fillRect(canvas.width / 4, canvas.height / 4, canvas.width / 2, canvas.height / 2);
    ctx.fillStyle = "#FFFFFF";
    ctx.textAlign = "center"; // Set text alignment to center
    ctx.textBaseline = "middle"; // Set text baseline to middle
    ctx.font = "30px Arial";
    ctx.fillText("Game Over", canvas.width / 2, canvas.height / 2);
    ctx.font = "20px Arial";
    ctx.fillText("Click to Respawn", canvas.width / 2, canvas.height / 2 + 50);
}

function updatePlayer() {
    var max_speed = 35;
    player.dy += player.gravity;
    
    if (keys.ArrowRight && player.dx < max_speed) {
        player.dx += 2;
    }
    if (keys.ArrowLeft && player.dx > -max_speed) {
        player.dx -= 2;
    }

    player.x += player.dx;
    player.y += player.dy;

    camera.x = player.x - (camera.width / 2);
    
    if (camera.x < 0) {
        camera.x = 0;
    }

    if (player.dx > 0) {
        player.dx -= friction;
    }
    else if (player.dx < 0) {
        player.dx += friction;
    }
    
    if (Math.abs(player.dx) < 0.8) {
        player.dx = 0;
    }

    player.grounded = false;

    for (var i = 0; i < lands.length; i++) {
        var l = lands[i];
        if (player.x < l.x + l.width && player.x + player.width > l.x && player.y < l.y + l.height && player.y + player.height > l.y) {
            player.y = l.y - player.height;
            player.dy = 0;
            player.jumping = false;
            player.grounded = true;
        }
    }
    
    for (var i = 0; i < lands.length; i++) {
        var l = lands[i];
        if (player.x < l.x + l.width && player.x + player.width > l.x && player.y < l.y + l.height && player.y + player.height > l.y) {
            player.y = l.y - player.height;
            player.dy = 0;
            player.jumping = false;
            player.grounded = true;
        }
    }

    for (var i = 0; i < platforms.length; i++) {
        var p = platforms[i];
        if (player.x < p.x + p.width && player.x + player.width > p.x && player.y < p.y + p.height && player.y + player.height > p.y) {
            if (player.dy > 0 && player.y + player.height - player.dy <= p.y + p.height) {
                player.y = p.y - player.height;
                player.dy = 0;
                player.jumping = false;
                player.grounded = true;
            }
            else if (player.dy < 0 && player.y - player.dy >= p.y) {
                player.y = p.y + p.height;
                player.dy = 0;
            }
            else if (player.dx > 0 && player.x + player.width - player.dx <= p.x + p.width) {
                player.x = p.x - player.width;
                player.dx = 0;
            }
            else if (player.dx < 0 && player.x - player.dx >= p.x) {
                player.x = p.x + p.width;
                player.dx = 0;
            }
        }
    }

    if (player.y > canvas.height) {
        playerDeath();
    }

    player.score = Math.max(0, Math.floor(player.x / 100)-10);

}

var lastLandX;
var lastLandWidth;

function startGame() {
    lands = [];
    platforms = [];

    platforms.push({
        x: canvas.width / 3 * 2,
        y: canvas.height - (Math.random() * 100 + 100),
        width: Math.random() * 100 + 100,
        height: 20
    });

    lands.push({
        x: 0,
        y: canvas.height - 50,
        width: canvas.width,
        height: 50
    });

    lastLandX = 0;
    lastLandWidth = canvas.width;


}
startGame();

function generateNextLand() {

    var min_gap = 350*Math.max(1, Math.floor(player.score/100));
    var max_gap = 800*Math.max(1, Math.floor(player.score/100));
    var min_land = 250/Math.max(1, Math.floor(player.score/100));
    var max_land = 1500/Math.max(1, Math.floor(player.score/100));

    var gapWidth = Math.random() * (max_gap-min_gap) + min_gap; // Random gap width between 200 and 300
    var landWidth = Math.random() * (max_land-min_land) + min_land; // Random land width between 200 and 300

    // Generate new land
    lands.push({
        x: lastLandX + lastLandWidth + gapWidth,
        y: canvas.height - 50,
        width: landWidth,
        height: 50
    });

    // Update lastLandX and lastLandWidth
    lastLandX = lastLandX + lastLandWidth + gapWidth;
    lastLandWidth = landWidth;
}

function generateNextPlatform() {
    var min_gapX = 250*Math.max(1, Math.floor(player.score/100));
    var max_gapX = 600*Math.max(1, Math.floor(player.score/100));
    var min_platform_width = 50*Math.max(1, Math.floor(player.score/100));
    var max_platform_width = 150/Math.max(1, Math.floor(player.score/100));

    var min_gapY = 200;
    var max_gapY = max_jump_height;

    var gapX = Math.random() * (max_gapX-min_gapX) + min_gapX; // Random gap width between 200 and 300
    var platformWidth = Math.random() * (max_platform_width-min_platform_width) + min_platform_width; // Random land width between 200 and 300
    var direction = Math.random() > 0.5 ? "Up" : "Down";

    var lastGeneratedPlatform = platforms[platforms.length - 1];
    var lastGeneratedX = lastGeneratedPlatform.x;
    var lastGeneratedY = lastGeneratedPlatform.y;

    if (direction === "Up") {
        var newY = lastGeneratedY - (Math.random() * (max_gapY-min_gapY) + min_gapY);
        newY = Math.max(newY, 0); // Ensure newY is not less than 0
        platforms.push({
            x: lastGeneratedX + gapX,
            y: newY,
            width: platformWidth,
            height: 20
        });
    }
    else {
        var newY = Math.random() * (canvas.height-lastGeneratedY-min_gapY) + lastGeneratedY + min_gapY;
        newY = Math.min(newY, canvas.height - 150); // Ensure newY is not greater than canvas.height - 20
        platforms.push({
            x: lastGeneratedX + gapX,
            y: newY,
            width: platformWidth,
            height: 20
        });
    }
}

function restartGame() {
    gameOver = false;
    player.x = canvas.width / 4;
    player.y = canvas.height - 100;
    player.dx = 0;
    player.dy = 0;
    startGame();
}

canvas.addEventListener('click', function(e) {
    if (gameOver) {
        restartGame();
    }
});

function cleanup() {
    lands = lands.filter(function(l) {
        return l.x + l.width > camera.x;
    });

    platforms = platforms.filter(function(p) {
        return p.x + p.width > camera.x;
    });
}

function gameLoop() {
    now = Date.now();
    delta = now - then;

    if (delta > interval) {
        then = now - (delta % interval);
        if (!gameOver) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            drawPlayer();
            drawPlatforms();
            drawScore();
            drawLands();
            updatePlayer();
            cleanup();
            // Generate next land if necessary
            if (player.x > lastLandX + lastLandWidth - canvas.width / 2) {
                generateNextLand();
            }
            // Generate next platform if necessary
            if (player.x > platforms[platforms.length - 1].x + platforms[platforms.length - 1].width - canvas.width / 2) {
                generateNextPlatform();
            }
        }
    }
    requestAnimationFrame(gameLoop);
}

window.addEventListener('keydown', function(e) {
    if ((e.key === ' ' || e.key === 'ArrowUp') && !player.jumping && player.grounded) {
        player.dy = -player.jumpForce;
        player.jumping = true;
    }
    if (e.code === 'ArrowRight') {
        keys.ArrowRight = true;
    }
    if (e.key === 'ArrowLeft') {
        keys.ArrowLeft = true;
    }
});

window.addEventListener('keyup', function(e) {
    if (e.key === 'ArrowRight') {
        keys.ArrowRight = false;
    }
    if (e.key === 'ArrowLeft') {
        keys.ArrowLeft = false;
    }
});

gameLoop();