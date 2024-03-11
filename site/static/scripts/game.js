

// Multiplayer code
var players = {};
var socket = io('/game');
var peer = new Peer();
var player_id = ""
var connections = {};

peer.on('open', function(id) {
    player_id = id;
    socket.emit('join', player_id);
});

peer.on('connection', function(conn) {

    conn.on('data', function(data) {
        players[data.id]['location'] = data.location;
    });

});

socket.on('player_join', function(data) {
    if (data !== player_id) {
        connections[data] = peer.connect(data);
        players[data] = {};
    }
});

socket.on('player_leave', function(data) {
    if (data === player_id) {
        peer.disconnect();
        return;
    }
    if (Object.keys(players).includes(data) === true){
        delete players[data];
    }
    if (Object.keys(connections).includes(data) === true){
        connections[data].close();
        delete connections[data];
    }
});

socket.on('player_list', function(data) {
    for (var i = 0; i < data.length; i++) {
        if (data[i] !== player_id) {
            connections[data[i]] = peer.connect(data[i]);
            players[data[i]] = {};
        }
    }
});

function sendPlayerData(data) {
    // x, y, rotation
    for (var key in connections) {
        connections[key].send(data);
    }
}


//
const config = {
    type: Phaser.AUTO,
    width: 800,
    height: 600,
    parent: 'gameCanvas',
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { y: 0 }
        }
    },
    scene: {
        preload: preload,
        create: create,
        update: update
    }
};

// Phaser game code
var game = new Phaser.Game(config);

var GameState = {
    create: function() {
        // Create the game world
        game.world.setBounds(0, 0, 2000, 2000); // Set the world bounds

        // Create the player sprite
        this.player = game.add.sprite(0, 0, 'player');
        game.physics.arcade.enable(this.player);
        game.camera.follow(this.player); // Enable camera follow

        // Create the player controls
        this.cursors = game.input.keyboard.createCursorKeys();

        // Set the player anchor to the center of the sprite
        this.player.anchor.setTo(0.5, 0.5);
    },
    render_player: function(data) {
        // render other players
        for (var key in players) {
            // ensure player is not the current player, and that the player doesnt already have a sprite.
            if (key !== player_id && Object.keys(players[key]).includes('sprite') === false) {
                players[key]['sprite'] = game.add.sprite(data.x, data.y, 'player');
            } else if (key !== player_id) {
                players[key]['sprite'].x = data.x;
                players[key]['sprite'].y = data.y;
            }
        }
        
    },

    update: function() {
        // Player movement
        this.player.body.velocity.x = 0;
        this.player.body.velocity.y = 0;

        if (this.cursors.up.isDown) {
            this.player.body.velocity.y = -200;
        } else if (this.cursors.down.isDown) {
            this.player.body.velocity.y = 200;
        }

        if (this.cursors.left.isDown) {
            this.player.body.velocity.x = -200;
        } else if (this.cursors.right.isDown) {
            this.player.body.velocity.x = 200;
        }

        // Send player data to other players
        sendPlayerData({
            location: {
                x: this.player.x,
                y: this.player.y
            }
        });
    }
};

game.state.add('GameState', GameState);
game.state.start('GameState');