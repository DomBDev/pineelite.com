

// Multiplayer code
var players;
var socket;
var peer;
var player_id;
var connections;
var user_active;

function sendPlayerData(data) {
    // id, location(x,y)
    for (var key in connections) {
        if (key === player_id) {
            continue;
        }
        if (connections[key] === undefined) {
            continue;
        }
        connections[key].send(data);
    }
}


// Game code

class Inventory {
    constructor() {
        this.slots = ['fist', null, null]; // Fist in the first slot, two empty slots
        this.activated = {
            0: false,
            1: false,
            2: false
        };
        this.cooldowns = {
            0: 0,
            1: 0,
            2: 0
        };
    }

    selectItem(slot) {
        this.activated = {
            0: false,
            1: false,
            2: false
        };
        this.activated[slot] = true;
    }

    // Method to add an item to the inventory
    addItem(item) {
        for (let i = 0; i < this.slots.length; i++) {
            if (this.slots[i] === null) {
                this.slots[i] = item;
                return true; // Item was added
            }
        }
        return false; // Inventory is full
    }

    // Method to remove an item from the inventory
    removeItem(item) {
        const index = this.slots.indexOf(item);
        if (index !== -1) {
            this.slots[index] = null;
            return true; // Item was removed
        }
        return false; // Item was not found
    }

    // update the cooldowns
    updateCooldowns() {
        for (let i = 0; i < this.cooldowns.length; i++) {
            if (this.cooldowns[i] > 0) {
                this.cooldowns[i] -= 1;
            }
        }
    }

    setCooldown(slot, cooldown) {
        this.cooldowns[slot] = cooldown;
    }

    getActiveItem() {
        for (let i = 0; i < this.activated.length; i++) {
            if (this.activated[i] === true) {
                return this.slots[i];
            }
        }
    }

    getActiveSlot() {
        for (let i = 0; i < this.activated.length; i++) {
            if (this.activated[i] === true) {
                return i;
            }
        }
    }

}

var GameState = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize:
    function GameState() {
        Phaser.Scene.call(this, { key: 'GameState' });
    },

    create: function() {
        // Create the game world
        this.physics.world.setBounds(0, 0, 800, 600);
    
        // Create the background sprites
        this.background = this.add.image(0, 0, 'background');
    
        // Create the player sprite
        this.player = this.physics.add.sprite(0, 0, 'player');
        this.username = this.add.text(0, -30, player_id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
        this.username.setFontStyle('bold');
        this.username.setStroke('#000000', 6);
        this.username.setOrigin(0.5, 0.5);
        this.player.setScale(0.1);
        this.cameras.main.startFollow(this.player); // Enable camera follow
        this.inventory = new Inventory();

        // Create the player controls
        this.cursors = this.input.keyboard.createCursorKeys();
        this.cursors.one = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.cursors.two = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.cursors.three = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);
    
        // Set the player anchor to the center of the sprite
        this.player.setOrigin(0.5, 0.5);

        this.frame = 0;

        this.oldPosition = {
            x: this.player.x,
            y: this.player.y
        };

        // Create the inventory slots
        this.inventorySlots = [
            this.add.sprite(50, 50, 'slot'), // Change the coordinates as needed
            this.add.sprite(100, 50, 'slot'), // Change the coordinates as needed
            this.add.sprite(150, 50, 'slot') // Change the coordinates as needed
        ];

        // Create the item sprites
        this.inventoryItems = [
            this.add.sprite(50, 50, 'fist'), // Change the coordinates as needed
            this.add.sprite(100, 50, null), // Change the coordinates as needed
            this.add.sprite(150, 50, null) // Change the coordinates as needed
        ];

        // Create the slot numbers
        this.slotNumbers = [
            this.add.text(50, 50, '1', { fontFamily: 'Arial', fontSize: 24, color: '#ffffff' }), // Change the coordinates as needed
            this.add.text(100, 50, '2', { fontFamily: 'Arial', fontSize: 24, color: '#ffffff' }), // Change the coordinates as needed
            this.add.text(150, 50, '3', { fontFamily: 'Arial', fontSize: 24, color: '#ffffff' }) // Change the coordinates as needed
        ];

        var inv_gui_size = 60;

        // Set the origin of the slot numbers and scale them by setting their width and height
        for (let i = 0; i < this.slotNumbers.length; i++) {
            this.slotNumbers[i].setOrigin(0.5, 0.5);
            this.slotNumbers[i].displayWidth = inv_gui_size;
            this.slotNumbers[i].displayHeight = inv_gui_size;
        }

        // Set the origin of the item sprites
        for (let i = 0; i < this.inventoryItems.length; i++) {
            this.inventoryItems[i].setOrigin(0.5, 0.5);
            this.inventoryItems[i].displayWidth = inv_gui_size;
            this.inventoryItems[i].displayHeight = inv_gui_size;
        }

        // Set the origin of the inventory slots
        for (let i = 0; i < this.inventorySlots.length; i++) {
            this.inventorySlots[i].setOrigin(0.5, 0.5);
            this.inventorySlots[i].displayWidth = inv_gui_size;
            this.inventorySlots[i].displayHeight = inv_gui_size;
        }
        
        players = {};
        socket = io('/game');
        peer = new Peer();
        player_id = ""
        connections = {};
        user_active = false;

        peer.on('error', function(err) {
            console.log("Error: ", err);
        });
        
        peer.on('open', function(id) {
            player_id = id;
            socket.emit('join', player_id);
        });
        
        peer.on('connection', function(conn) {
            console.log("Connection established with: ", conn.peer);
            if (Object.keys(players).includes(conn.peer) === false) {
                players[conn.peer] = {};
            }
            players[conn.peer]['last_update'] = new Date().getTime();
        
            if (Object.keys(players).includes(conn.peer) === false) {
                players[conn.peer] = {};
            }
        
            conn.on('data', function(data) {
                if (Object.keys(data).includes('location')) {
                players[data.id]['location'] = data['location']
                }
                if (Object.keys(data).includes('username')) {
                    players[data.id]['username'] = data['username']
                }
                players[data.id]['last_update'] = new Date().getTime();
            });
        
        });
        
        socket.on('player_join', function(data) {
            if (data !== player_id && Object.keys(connections).includes(data) === false && user_active === true) {
                connections[data] = peer.connect(data);
            }
        });
        
        socket.on('player_leave', function(data) {
            console.log("Player leaving: ", data, "Player id: ", player_id)
            if (data === player_id) {
                user_active = false;
                for (var player in players) {
                    if (player !== player_id) {
                        players[player]['sprite'].destroy();
                        players[player]['sprite_text'].destroy();
                        delete players[player];
                        if (connections[player] !== undefined) {
                            connections[player].close();
                            delete connections[player];
                        }
                    }
                }
            }
            console.log("Removing player due to leaving: ", data)
            if (players[data] !== undefined) {
                players[data]['sprite'].destroy();
                players[data]['sprite_text'].destroy();
                delete players[data];
            }
            if (Object.keys(connections).includes(data) === true){
                connections[data].close();
                delete connections[data];
            }
        });
        
        socket.on('player_list', function(data) {
            user_active = true;
            for (var i = 0; i < data.length; i++) {
                if (data[i] !== player_id) {
                    for (let attempt = 0; attempt < 5; attempt++) {
                        try {
                            if (data[i] !== player_id) {
                                connections[data[i]] = peer.connect(data[i]);
                                if (connections[data[i]]) {
                                    break;
                                }
                            }
                        } catch (error) {
                            console.error(`Attempt ${attempt + 1} failed. Retrying...`);
                        }
                    }
                }
            }
        });
        $(window).on('focus', function() {
            console.log("Window focused")
            if (player_id !== undefined) {
                socket.emit('join', player_id);
            }
        });
    },

    preload: function() {
        this.load.image('background', background_sprite);
        this.load.image('player', player_sprite);
        this.load.image('other_player', enemy_sprite);
        this.load.image('slot', inventory_slot);
        this.load.image('fist', fist_sprite);
    },

    update: function() {
        this.frame += 1;
    
        // Player movement
        if (this.cursors.left.isDown) {
            this.player.setVelocityX(-160);
            this.username.setX(this.player.x);
        } else if (this.cursors.right.isDown) {
            this.player.setVelocityX(160);
            this.username.setX(this.player.x);
        } else {
            this.player.setVelocityX(0);
        }
        if (this.cursors.up.isDown) {
            this.player.setVelocityY(-160);
            this.username.setY(this.player.y - 30);
        } else if (this.cursors.down.isDown) {
            this.player.setVelocityY(160);
            this.username.setY(this.player.y - 30);
        } else {
            this.player.setVelocityY(0);
        }
        // Inventory controls

        if (this.cursors.one.isDown) {
            //create a border around
            this.inventory.selectItem(0);
        }
        if (this.cursors.two.isDown) {
            this.inventory.selectItem(1);
        }
        if (this.cursors.three.isDown) {
            this.inventory.selectItem(2);
        }

        // set border to active item
        for (let i = 0; i < this.inventory.slots.length; i++) {
            if (this.inventory.activated[i] === true) {
                this.inventorySlots[i].tint = 0x00ff00;
            } else {
                this.inventorySlots[i].tint = 0xffffff;
            }
        }
        var c_count = 0;
        for (var item in this.inventoryItems) {
            c_count += 1;
            // Calculate the position
            var x = this.player.x - (c_count * 50) + 50;
            var y = this.player.y + 50;
        
            // Set the position
            this.inventoryItems[item].setX(x);
            this.inventoryItems[item].setY(y);
            this.inventorySlots[item].setX(x);
            this.inventorySlots[item].setY(y);
            this.slotNumbers[item].setX(x);
            this.slotNumbers[item].setY(y);
        }

        // Rotate player to face the mouse
        this.player.rotation = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.input.x + this.cameras.main.scrollX, this.input.y + this.cameras.main.scrollY);

        // Click to activate inventory item
        if (this.input.activePointer.isDown) {
            // shoot item direction player is facing
            if (this.inventory.slots[this.inventory.getActiveSlot()] !== null && this.inventory.cooldowns[this.inventory.getActiveSlot()] === 0) {
                // shoot item
                console.log("Shooting item: ", this.inventory.slots[0]);
                this.inventory.setCooldown(this.inventory.getActiveSlot(), 60);
            }
        }
            


        this.username.text = this.registry.get('username');
        for (var player in players) {
            if (Object.keys(players[player]).includes('sprite') === false && player != player_id) {
                add_player(player, this);
            } else if (Object.keys(players[player]).includes('sprite') === true && player != player_id) {
                // If player location data exists, update the player sprite location
                if (Object.keys(players[player]).includes('location')) {
                    players[player]['sprite'].setX(players[player]['location']['x']);
                    players[player]['sprite'].setY(players[player]['location']['y']);
                    players[player]['sprite_text'].setX(players[player]['location']['x']);
                    players[player]['sprite_text'].setY(players[player]['location']['y'] - 30);
                    if (players[player]['sprite'].visible === false) {
                        if (Object.keys(players[player]).includes('username')) {
                            players[player]['sprite_text'].text = players[player]['username'];
                        }
                        players[player]['sprite'].visible = true;
                        players[player]['sprite_text'].visible = true;
                    }
                }
            }
        }

        // check if player position is defined yet
        if (this.player.x !== undefined && this.player.y !== undefined && this.player.oldPosition !== undefined) {
            // Send player data to other players
            if (this.player.x !== this.player.oldPosition.x || this.player.y !== this.player.oldPosition.y || this.frame % 10 === 0) {
                sendPlayerData({
                    id: player_id,
                    location: {
                        x: this.player.x,
                        y: this.player.y
                    },
                    username: this.registry.get('username')
                });
            }

        } else if (this.frame % 10 === 0) {
            sendPlayerData({
                id: player_id
            });
        }
        this.player.oldPosition = {
            x: this.player.x,
            y: this.player.y
        };
        for (let i = 0; i < this.inventory.slots.length; i++) {
            if (this.inventory.slots[i] !== null) {
                this.inventoryItems[i].setTexture(this.inventory.slots[i]);
            } else {
                this.inventoryItems[i].setTexture(null);
            }
        }
    }
});

function add_player(other_player_id, game_state) {
    console.log("player_id: ", player_id, "other_player_id: ", other_player_id)
    if (player_id === "") {
        console.log("Player not connected yet")
        return;
    }
    if (player_id == other_player_id) {
        console.log("Not adding player: ", other_player_id)
        return;
    } else {
        if (Object.keys(players).includes(other_player_id) === false) {
            console.log(players[other_player_id] + " Reset")
            players[other_player_id] = {};
        }

        if (players[other_player_id]['sprite'] === undefined) {

            console.log("Adding player: ", other_player_id)
            players[other_player_id]['sprite'] = game_state.physics.add.sprite(0, 0, 'player');
            players[other_player_id]['sprite_text'] = game_state.add.text(0, -50, other_player_id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
            players[other_player_id]['sprite_text'].setFontStyle('bold');
            players[other_player_id]['sprite_text'].setStroke('#000000', 6);
            players[other_player_id]['sprite'].setScale(0.1);
            players[other_player_id]['sprite'].setOrigin(0.5, 0.5);
            players[other_player_id]['sprite_text'].setOrigin(0.5, 0.5);
            players[other_player_id]['sprite'].tint = 0xffa1a1;
            players[other_player_id]['sprite_text'].tint = 0xfa736e;
            if (Object.keys(players[other_player_id]).includes('location')) {
                players[other_player_id]['sprite'].setX(players[other_player_id]['location']['x']);
                players[other_player_id]['sprite'].setY(players[other_player_id]['location']['y']);
                players[other_player_id]['sprite_text'].setX(players[other_player_id]['location']['x']);
                players[other_player_id]['sprite_text'].setY(players[other_player_id]['location']['y'] - 30);
            } else {
                players[other_player_id]['sprite'].visible = false;
                players[other_player_id]['sprite_text'].visible = false;
            }
        }

    }
}


var TitleScene = new Phaser.Class({
    Extends: Phaser.Scene,
    initialize:
    function TitleScene() {
        Phaser.Scene.call(this, { key: 'TitleScene' });
    },
    preload: function() {
        this.load.html('nameform', username_form);
    },
    create: function() {
        this.cameras.main.setBackgroundColor('#ffffff');
        const element = this.add.dom(0, 0).createFromCache('nameform');
    
        element.setOrigin(0);
        element.setPosition(0, 0);
    
        element.node.style.width = this.sys.game.config.width + 'px';
        element.node.style.height = this.sys.game.config.height + 'px';
    
        element.addListener('click');
    
        element.on('click', function (event) {
            if (event.target.name === 'playButton') {
                const inputText = this.getChildByName('nameField');
    
                //  Have they entered anything?
                if (inputText.value !== '') {
                    //  Ok, the Play Button was clicked or touched, so let's stop the form from doing anything
                    event.stopPropagation();
    
                    //  Hide the form
                    this.setVisible(false);
    
                    this.scene.registry.set('username', inputText.value);
    
                    //  Populate the text with whatever they typed in
                    this.scene.scene.start('GameState');
                }
            }
        });
    }
});


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
    dom: {
        createContainer: true
    },
    scene: [TitleScene, GameState]
};

// Phaser game code
var game = new Phaser.Game(config);

// set the scene to the title scene
game.scene.start('TitleScene');