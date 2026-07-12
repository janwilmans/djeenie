// @ts-check

const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const minecraftData = require("minecraft-data");

const fs = require("fs");
const path = require("path");

const WISH_DIR = path.join(__dirname, "wishes");
const LOG_DIR = path.join(__dirname, "logs");

function logWish(player, searchTerms, item) {

    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    try {
        const file = path.join(LOG_DIR, "wishes.log");

        const timestamp = new Date().toISOString();

        const line =
            `[${timestamp}] ` +
            `user="${player.username}" ` +
            `uuid="${player.uuid}" ` +
            `wish="${searchTerms}" ` +
            `granted="${item.name}"\n`;

        fs.appendFileSync(file, line, "utf8");
    }
    catch (err) {
        console.log("logWish error:", err);
    }
}

function getWishFile(player) {
    return path.join(WISH_DIR, `${player.username}.json`);
}

function loadUserWish(player) {

    try {
        const file = getWishFile(player);

        if (!fs.existsSync(file)) {
            return null;
        }

        const data = fs.readFileSync(file, "utf8");
        return JSON.parse(data);
    }
    catch (err) {
        console.log("loadUserWish error:", err);
        return null;
    }
}

function saveUserWish(player, timestamp) {

    if (!fs.existsSync(WISH_DIR)) {
        fs.mkdirSync(WISH_DIR);
    }
    try {
        const file = getWishFile(player);
        const data = {
            uuid: player.uuid,
            name: player.username,
            lastWish: timestamp
        };

        fs.writeFileSync(
            file,
            JSON.stringify(data, null, 2),
            "utf8"
        );
        console.log(`saved wish: ${file}`)
    }
    catch (err) {
        console.log("saveUserWish error:", err);
    }
}

function isSameDay(timestampA, timestampB) {
    const a = new Date(timestampA).toDateString();
    const b = new Date(timestampB).toDateString();
    return a === b;
}

function getTimeUntilTomorrow(now) {
    const d = new Date(now);
    const tomorrow = new Date(d);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return tomorrow.getTime() - now;
}

class Player {
    constructor(bot, username) {
        this.bot = bot;
        this.username = username;
        this.player = this.bot.players[username];

        if (!this.player) {
            this.player = this.bot.players["." + username];
        }

        if (!this.player) {
            console.log(`No player object could be constructed for username "{username}"`);
            return
        }
        this.uuid = this.player.uuid;
        this.entity = this.player.entity
    }
}

class DjeenieBot {
    constructor(options) {
        this.options = options;

        this.bot = null;
        this.mcData = null;

        this.reconnectAttempts = 0;
        this.MAX_RECONNECTS = 10;

        this.lastPosition = null;
        this.lastMoveTime = Date.now();
        this.stuckInterval = null;

        this.banned = [
            "command_block",
            "chain_command_block",
            "repeating_command_block",
            "command_block_minecart",
            "structure_block",
            "structure_void",
            "jigsaw",
            "debug_stick",
            "bedrock",
            "barrier",
            "light",
            "allay_spawn_egg",
            "ender_dragon_spawn_egg",
            "wither_spawn_egg",
            "end_crystal",
            "nether",
            "diamond",
            "token",
            "core",
            "mace",
            "wither",
            "beacon",
            "netherite_sword",
            "netherite_pickaxe",
            "netherite_axe",
            "netherite_armor",
            "netherite_block",
            "netherite_ingot",
            "enchanted_golden_apple",
            "totem",
            "totem_of_undying",
            "elytra",
            "firework_rocket",
            "trident",
            "shulker_box",
            "shulker_shell",
            "dragon_egg",
            "respawn_anchor",
            "mending_book",
            "sharpness_5_book",
            "power_5_book",
            "protection_4_book",
            "efficiency_5_book",
            "sweeping_edge_3_book",
            "villager_spawn_egg",
            "creeper_spawn_egg",
            "ghast_spawn_egg",
            "warden_spawn_egg",
            "mob_spawner",
            "end_portal_frame",
            "nether_star"
        ];
    }

    start() {
        this.attackerHits = new Map();
        this.bot = mineflayer.createBot(this.options);
        this.bot.loadPlugin(pathfinder);

        this.registerEvents();
        return this.bot;
    }

    resetConnectionState() {
        this.reconnectAttempts = 0;
        this.lastPosition = null;
        this.lastMoveTime = Date.now();
        if (this.stuckInterval) {
            clearInterval(this.stuckInterval);
            this.stuckInterval = null;
        }
    }

    registerHit(username) {
        const count = this.attackerHits.get(username) || 0;
        this.attackerHits.set(username, count + 1);
        return this.attackerHits.get(username);
    }

    registerEvents() {
        this.bot.on("login", () => {
            console.log("Logged in");
        });

        // this.bot.on('path_update', (r) => {
        //     console.log('Path status:', r.status);
        // });

        // this.bot.on('goal_reached', () => {
        //     console.log('Goal reached');
        // });

        this.bot.once("spawn", () => {
            console.log("Djeenie Spawned!");
            this.reconnectAttempts = 0;
            this.resetConnectionState();

            this.mcData = minecraftData(this.bot.version);

            const movements = new Movements(this.bot, this.mcData);
            movements.canDig = false;
            movements.allow1by1towers = true;
            movements.allowParkour = true;
            movements.allowSprinting = true;
            movements.maxDropDown = 4;
            movements.allowFreeMotion = true;
            movements.canPlaceBlocks = true
            movements.canOpenDoors = true;
            movements.dontCreateFlow = true;
            movements.dontMineUnderFallingBlock = true;
            movements.allowEntityDetection = true;
            this.bot.pathfinder.setMovements(movements);

            this.bot.chat("Djeenie Wish Bot reporting for duty!");
        });

        this.bot.on("chat", (username, message) => {
            if (username === this.bot.username) return;
            this.handleChat(username, message);
        });

        this.bot.on("kicked", (reason) => {
            if (reason.includes("Outdated")) {
                console.log(`KICKED: ${reason}, Install the ViaBackwards plugin to support older clients on newer server versions.`);
            }
            else {
                console.log(`KICKED: ${reason}`);
            }
            this.handleReconnect();
        });

        this.bot.on("error", (e) => {
            console.log("ERROR:", e);
            if (e?.code === 'ECONNRESET' || e?.message?.includes('ECONNRESET')) {
                this.handleReconnect();
            }
        });

        this.bot.on("end", () => this.handleReconnect());

        this.bot.on("entityHurt", (entity) => {
            if (entity !== this.bot.entity) return;

            const skeletonShootingDistance = 16;
            const hostile = this.bot.nearestEntity(e =>
                (e.type === "hostile" || e.type === "mob") &&
                e.position.distanceTo(this.bot.entity.position) < skeletonShootingDistance
            );

            if (hostile?.name) {
                this.bot.chat(`A ${hostile.name} is hurting Djeenie!`);
                this.bot.chat(`/kill @e[type=${hostile.name},limit=2,sort=nearest]`);
                return
            }

            const playerStrikingDistance = 4;
            const player = this.bot.nearestEntity(e =>
                e.type === "player" &&
                e.position.distanceTo(this.bot.entity.position) < playerStrikingDistance
            );

            if (player?.username) {
                this.registerHit(player.username);
                this.handleAttackerPunishment(player.username)
                return
            }
        });

        const MAX_DISTANCE = 15; // Adjust this value based on your need

        this.bot.on("physicsTick", () => {
            if (!this.isFollowing()) {
                return;
            }

            const playerPos = this.bot.pathfinder.goal?.entity?.position;
            if (!playerPos) return;

            const botPos = this.bot.entity.position;
            const distance = playerPos.distanceTo(botPos);
            if (distance > MAX_DISTANCE) {
                // Direction from player -> bot
                let dx = botPos.x - playerPos.x;
                let dz = botPos.z - playerPos.z;

                const len = Math.sqrt(dx * dx + dz * dz);

                // If we're exactly on top of the player, choose an arbitrary direction.
                if (len < 0.001) {
                    dx = 1;
                    dz = 0;
                } else {
                    dx /= len;
                    dz /= len;
                }

                this.bot.chat(`/tp @s ${playerPos.x + dx * 2} ${playerPos.y} ${playerPos.z + dz * 2}`);
            }
        });

    }

    handleAttackerPunishment(username) {
        const hits = this.attackerHits.get(username) || 0;

        if (hits === 1) {
            this.bot.chat(`Auw, ${username} do not hurt me!`);
        }

        if (hits === 2) {
            this.bot.chat(`${username}, stop that, I recommend to not do that again!`);
        }

        if (hits >= 3) {
            console.log(`${username} hurt Djeenie 3 times and was killed`);
            this.bot.chat(`${username} was sent to sleep with the fishes.`);
            this.bot.chat(`/kill ${username}`);
            this.attackerHits.delete(username); // reset cycle
        }
    }

    handleReconnect() {
        console.log("Disconnected... retrying");

        const MAX_RECONNECTS = 3;

        if (this.reconnectAttempts >= MAX_RECONNECTS) {
            console.log("Max reconnect attempts reached.");
            return;
        }

        this.reconnectAttempts++;

        // 2s, 4s, 8s
        const delay = 2000 * Math.pow(2, this.reconnectAttempts - 1);

        console.log(`Reconnecting in ${delay / 1000}s...`);

        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
        }

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            this.start();
        }, delay);
    }

    handleChat(username, message) {
        const msg = message.toLowerCase();

        if (msg === "come") return this.come(username);
        if (msg === "follow") return this.follow(username);
        if (msg === "sleep") return this.sleep(username);
        if (msg === "stop") return this.stop();
        if (msg === "list") return this.listPlayers();
        if (msg === "tp") return this.tp(username, "");

        if (msg.startsWith("tp ")) {
            this.tp(username, msg.slice(3));
            return
        }

        if (msg.startsWith("wish")) {
            return this.doWishCommand(username, message);
        }

        if (msg === "die") {
            this.bot.chat(`AFK, I'll be back soon!`);
            //this.bot.chat(`/kill ${username}`);
            process.exit(0);
        }
    }

    come(username) {
        const player = new Player(this.bot, username)
        if (!player?.entity) return this.bot.chat("I can't see you.");

        this.bot.chat(`Coming to you, ${username}!`);

        this.bot.pathfinder.setGoal(
            new goals.GoalNear(
                player.entity.position.x,
                player.entity.position.y,
                player.entity.position.z,
                1
            )
        );
    }

    isFollowing() {
        return this.bot.pathfinder.goal instanceof goals.GoalFollow &&
            this.bot.pathfinder.isMoving();
    }

    follow(username) {
        const player = this.bot.players[username];
        if (!player?.entity) {
            return this.bot.chat("I can't see you.");
        }

        this.bot.chat(`Following you, ${username}!`);

        this.bot.pathfinder.setGoal(
            new goals.GoalFollow(player.entity, 2),
            true
        );
    }

    stop() {
        this.bot.pathfinder.setGoal(null);
        this.bot.chat("Stopped.");
    }

    sleep(username) {
        console.log(`Djeenie sets day-time because ${username} asked`);
        this.bot.chat(`OK ${username} I will sleep now!`);
        this.bot.chat(`/time set minecraft:day`);
    }

    tp(username, coordinates) {
        console.log(`Djeenie was asked to tp ${username} to ${coordinates}`);
        this.bot.chat(`/tp ${username} ${this.bot.username}`);
    }

    isBannedItem(itemName) {
        const name = itemName.toLowerCase();
        return this.banned.some(bad => name.includes(bad));
    }

    checkWishCooldown(username) {

        const player = new Player(this.bot, username);
        const data = loadUserWish(player);
        if (!data) {
            console.log(`${username} never wished before, id ${player.uuid}`);
            return true;
        }

        const now = Date.now();
        if (data.lastWish && isSameDay(data.lastWish, now)) {
            const remaining = getTimeUntilTomorrow(now);
            const h = Math.floor(remaining / (60 * 60 * 1000));
            const m = Math.floor((remaining % (60 * 60 * 1000)) / 60000);
            const s = Math.floor((remaining % 60000) / 1000);
            this.bot.chat(`${username}, you already wished today. Try again in ${h}h ${m}m ${s}s.`);
            return false;
        }
        return true;
    }

    doWishCommand(username, message) {
        if (!this.checkWishCooldown(username)) return;
        this.doWish(username, message);
    }

    listPlayers() {
        console.log(this.bot.players);
    }

    doWish(username, message) {
        console.log(`${username} wished: "${message}"`);
        if (!this.mcData) {
            this.bot.chat("Not ready for wishes yet.");
            return;
        }

        const parts = message.toLowerCase().trim().split(/\s+/);
        if (parts.length < 2) {
            return this.bot.chat("Usage: wish <item>");
        }

        const args = parts.slice(1, 5); // accept up to 4 words
        const searchTerms = args.join(" ");

        // console.log(`searchTerms: "${searchTerms}"`)

        // EXACT MATCH MODE
        // =========================
        if (args.length === 1 && args[0].startsWith("minecraft:")) {
            const exactName = args[0].slice(10);
            const item = this.mcData.itemsByName[exactName];

            if (!item) {
                return this.bot.chat(`"${searchTerms}" is not valid.`);
            }

            return this.fulfillWish(username, searchTerms, item);
        }

        // =========================
        // PARTIAL MATCH MODE (ALL WORD MATCH)
        // =========================
        const undesirables = ["stone", "wooden"];

        const match = Object.entries(this.mcData.itemsByName)
            .find(([name]) => {
                const n = name.toLowerCase();

                // all words must match
                const allWordsMatch = args.every(word => n.includes(word));
                if (!allWordsMatch) return false;

                // filter undesirable materials
                for (const bad of undesirables) {
                    if (n.includes(bad)) return false;
                }

                return true;
            });

        if (!match) {
            return this.bot.chat(`${username} wished for ${searchTerms} ?! (not sure what that is!)`);
        }

        const item = match[1];
        return this.fulfillWish(username, searchTerms, item);
    }

    fulfillWish(username, searchTerms, item) {
        if (!item) {
            return this.bot.chat(`"${searchTerms}" is invalid.`);
        }

        if (this.isBannedItem(item.name)) {
            return this.bot.chat(`"${searchTerms}" is Evil, OP of niet lief!`);
        }

        console.log(`${username} received "${item.name}" based on "${searchTerms}"`)

        const player = new Player(this.bot, username);
        saveUserWish(player, Date.now());
        logWish(player, searchTerms, item);
        this.bot.chat(`Your wish is my command, ${username}!`);
        this.bot.chat(`/give ${username} minecraft:${item.name} 1`);
    }
}


// 26.2 -> does not work
// 1.21.11 -> does not work
// 1.21.10 -> does not work
// 1.21.8 -> follow works
// ===== START BOT =====

// const bot = new DjeenieBot({
//     host: "jannetje19k.aternos.me",
//     port: 47708,
//     auth: "microsoft",
//     username: "aternosriverside@gmail.com",
// });

const bot = new DjeenieBot({
    host: "riverside5.aternos.me",
    port: 40438,
    auth: "microsoft",
    username: "aternosriverside@gmail.com",
    version: "1.21.8",
});


bot.start();
