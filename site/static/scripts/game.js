

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
        if (data.id !== player_id && Object.keys(players[data.id]).includes('sprite')) {
            players[data.id]['sprite'].x = data.x;
            players[data.id]['sprite'].y = data.y;
        }
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
    // id, location(x,y)
    for (var key in connections) {
        connections[key].send(data);
    }
}



var GameState = {
    create: function() {
        // Create the game world
        this.physics.world.setBounds(0, 0, 1920, 1920);
    
        // Create the background sprites
        this.background1 = this.add.tileSprite(0, 0, 1920, 1920, 'background');
        this.background2 = this.add.tileSprite(0, 0, 1920, 1920, 'background');
    
        // Create the player sprite
        this.player = this.physics.add.sprite(0, 0, 'player');
        this.player.setScale(0.1);
        this.cameras.main.startFollow(this.player); // Enable camera follow
    
        // Create the player controls
        this.cursors = this.input.keyboard.createCursorKeys();
    
        // Set the player anchor to the center of the sprite
        this.player.setOrigin(0.5, 0.5);
    },

    preload: function() {
        this.load.image('background', background_sprite);
        this.load.image('player', player_sprite);
        this.load.image('other_player', enemy_sprite);
    },

    update: function() {
        // Move the background images based on the player's velocity
        this.background1.tilePositionX += this.player.body.velocity.x / 100;
        this.background1.tilePositionY += this.player.body.velocity.y / 100;
        this.background2.tilePositionX += this.player.body.velocity.x / 100;
        this.background2.tilePositionY += this.player.body.velocity.y / 100;
    
        // Player movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
        } else {
            this.player.setVelocityX(0);
        }
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-160);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(160);
        } else {
            this.player.setVelocityY(0);
        }
        for (var player in players) {
            if (Object.keys(players[player]).includes('sprite') === false && player != player_id) {
                add_player(player, this);
            } else if (Object.keys(players[player]).includes('sprite') === true && player != player_id) {
                    console.log("Player: ", player, "Location: ", players[player]['location'])
                    console.log("Player Data: ", players[player])
                    players[player]['sprite'].x = players[player]['location']['x'];
                    players[player]['sprite'].y = players[player]['location']['y'];
                    console.log("Error: ", error);
            }
        }
    
        // Send player data to other players
        sendPlayerData({
            id: player_id,
            location: {
                x: this.player.x,
                y: this.player.y
            }
        });
    }
};

function add_player(other_player_id, game_state) {
    if (player_id == other_player_id) {
        console.log("Not adding player: ", other_player_id)
        return;
    } else {
        console.log("Adding player: ", player_id)
        players[other_player_id]['sprite'] = game_state.physics.add.sprite(0, 0, 'other_player');
        players[other_player_id]['sprite'].setScale(0.1);
        players[other_player_id]['sprite'].setOrigin(0.5, 0.5);
    }
}

// Config
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
    scene: GameState
};

// Phaser game code
var game = new Phaser.Game(config);