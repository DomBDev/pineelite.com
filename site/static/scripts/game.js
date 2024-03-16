

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
        this.selected = null;
    }

    selectItem(slot) {
        this.activated = {
            0: false,
            1: false,
            2: false
        };
        this.selected = slot;
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

    updateCooldowns() {
        for (let key in this.cooldowns) {
            if (this.cooldowns[key] > 0) {
                this.cooldowns[key] -= 1;
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
        return this.selected;
    }

}
var player_size = 75;

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
        this.username = this.add.text(0, ((player_size/2)+5)*-1, player_id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
        this.username.setFontStyle('bold');
        this.username.setStroke('#000000', 6);
        this.username.setOrigin(0.5, 0.5);
        this.player.displayHeight = player_size;
        this.player.displayWidth = player_size;
        this.cameras.main.startFollow(this.player); // Enable camera follow
        this.inventory = new Inventory();

        // Create the player controls
        this.cursors = this.input.keyboard.createCursorKeys();

        this.cursors.one = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ONE);
        this.cursors.two = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.TWO);
        this.cursors.three = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.THREE);

        this.cursors.w = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
        this.cursors.a = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
        this.cursors.s = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
        this.cursors.d = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
    
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

        this.inventory.selectItem(0);

        var inv_gui_size = 75;

        // Set the origin of the slot numbers and scale them by setting their width and height
        for (let i = 0; i < this.slotNumbers.length; i++) {
            this.slotNumbers[i].setOrigin(1, 1);
            this.slotNumbers[i].displayWidth = inv_gui_size/4;
            this.slotNumbers[i].displayHeight = inv_gui_size/4;

            this.inventoryItems[i].setOrigin(0.5, 0.5);
            this.inventoryItems[i].displayWidth = inv_gui_size/2;
            this.inventoryItems[i].displayHeight = inv_gui_size/2;
            if (this.inventorySlots[i] === null) {
                this.inventoryItems[i].visible = false;
            } else {
                this.inventoryItems[i].visible = true;
            }

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

        this.inventory.updateCooldowns();
        this.username.setX(this.player.x);
        this.username.setY(this.player.y - ((player_size/2)+5));
    
        // Player movement arrow keys + wasd
        if (this.cursors.left.isDown || this.cursors.a.isDown) {
            this.player.setVelocityX(-160);
        } else if (this.cursors.right.isDown || this.cursors.d.isDown) {
            this.player.setVelocityX(160);
        } else {
            this.player.setVelocityX(0);
        }
        if (this.cursors.up.isDown || this.cursors.w.isDown) {
            this.player.setVelocityY(-160);
        } else if (this.cursors.down.isDown || this.cursors.s.isDown) {
            this.player.setVelocityY(160);
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
                if (this.inventory.cooldowns[i] > 0) {
                    this.inventorySlots[i].tint = 0xff0000;
                } else {
                    this.inventorySlots[i].tint = 0x00ff00;
                }
            } else {
                if (this.inventory.cooldowns[i] > 0) {
                    this.inventorySlots[i].tint = 0xff0000;
                } else {
                    this.inventorySlots[i].tint = 0xffffff;
                }
            }

            if (this.inventory.slots[i] === null) {
                this.inventoryItems[i].visible = false;
            } else {
                this.inventoryItems[i].visible = true;
            }
        }
        var c_count = 0;
        for (var item in this.inventoryItems) {
            c_count += 1;
            // Calculate the position
            var x = this.player.x + (c_count * 78) + 122;
            var y = this.player.y + 250;
        
            // Set the position
            this.inventoryItems[item].setX(x);
            this.inventoryItems[item].setY(y);
            this.inventorySlots[item].setX(x+2);
            this.inventorySlots[item].setY(y+2);
            this.slotNumbers[item].setX(x-4);
            this.slotNumbers[item].setY(y-4);
        }

        // Rotate player to face the mouse
        this.player.rotation = Phaser.Math.Angle.Between(this.player.x, this.player.y, this.input.x + this.cameras.main.scrollX, this.input.y + this.cameras.main.scrollY);

        // Click to activate inventory item
        if (this.input.activePointer.isDown) {
            // shoot item direction player is facing
            var active_slot = this.inventory.getActiveSlot();
            var active_item = this.inventory.slots[active_slot]
            if (active_item !== null && this.inventory.cooldowns[active_slot] === 0) {
                this.inventory.setCooldown(active_slot, 60);
                console.log("Item: ", active_item, "Slot: ", active_slot);
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
                    players[player]['sprite_text'].setY(players[player]['location']['y'] - (player_size/2)+5);
                    players[player]['sprite'].rotation = players[player]['location']['rotation'];
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
                        y: this.player.y,
                        rotation: this.player.rotation
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
            players[other_player_id]['sprite'] = game_state.physics.add.sprite(0, 0, 'other_player');
            players[other_player_id]['sprite_text'] = game_state.add.text(0, (player_size/2)+5, other_player_id, { fontFamily: 'Georgia, "Goudy Bookletter 1911", Times, serif' });
            players[other_player_id]['sprite_text'].setFontStyle('bold');
            players[other_player_id]['sprite_text'].setStroke('#000000', 6);
            players[other_player_id]['sprite'].displayHeight = player_size;
            players[other_player_id]['sprite'].displayWidth = player_size;
            players[other_player_id]['sprite'].setOrigin(0.5, 0.5);
            players[other_player_id]['sprite_text'].setOrigin(0.5, 0.5);
            players[other_player_id]['sprite_text'].tint = 0xfa736e;
            if (Object.keys(players[other_player_id]).includes('location')) {
                players[other_player_id]['sprite'].setX(players[other_player_id]['location']['x']);
                players[other_player_id]['sprite'].setY(players[other_player_id]['location']['y']);
                players[other_player_id]['sprite_text'].setX(players[other_player_id]['location']['x']);
                players[other_player_id]['sprite_text'].setY(players[other_player_id]['location']['y'] - (player_size/2)+5);
                players[other_player_id]['sprite'].rotation = players[other_player_id]['location']['rotation'];
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