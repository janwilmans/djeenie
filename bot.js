const mineflayer = require("mineflayer");
const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const minecraftData = require("minecraft-data");

const fs = require("fs");
const path = require("path");

const WISH_DIR = path.join(__dirname, "wishes");
const LOG_DIR = path.join(__dirname, "logs");

function logWish(username, uuid, searchTerms, item) {

    if (!fs.existsSync(LOG_DIR)) {
        fs.mkdirSync(LOG_DIR, { recursive: true });
    }
    try {
        const file = path.join(LOG_DIR, "wishes.log");

        const timestamp = new Date().toISOString();

        const line =
            `[${timestamp}] ` +
            `user="${username}" ` +
            `uuid="${uuid}" ` +
            `wish="${searchTerms}" ` +
            `granted="${item.name}"\n`;

        fs.appendFileSync(file, line, "utf8");
    }
    catch (err) {
        console.log("logWish error:", err);
    }
}

function getWishFile(uuid) {
    return path.join(WISH_DIR, `${uuid}.json`);
}

function loadUserWish(uuid) {
    try {
        const file = getWishFile(uuid);

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

function saveUserWish(uuid, username, timestamp) {

    if (!fs.existsSync(WISH_DIR)) {
        fs.mkdirSync(WISH_DIR);
    }
    try {
        const file = getWishFile(uuid);
        const data = {
            uuid,
            name: username,
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

class DjeenieBot {
    constructor(options) {
        this.options = options;

        this.bot = null;
        this.mcData = null;

        this.lastWish = new Map();
        this.WISH_TIME = 60 * 1000;

        this.reconnectAttempts = 0;
        this.MAX_RECONNECTS = 10;

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
            "mace",
            "wither"
        ];
    }

    start() {
        this.attackerHits = new Map();
        this.bot = mineflayer.createBot(this.options);
        this.bot.loadPlugin(pathfinder);

        this.registerEvents();
        return this.bot;
    }

    registerHit(attacker) {
        if (!attacker) return;

        const name = attacker.username || attacker.name;
        if (!name) return;

        const count = this.attackerHits.get(name) || 0;
        this.attackerHits.set(name, count + 1);

        return this.attackerHits.get(name);
    }

    registerEvents() {
        this.bot.on("login", () => {
            console.log("Logged in");
        });

        this.bot.once("spawn", () => {
            console.log("Spawned!");
            this.reconnectAttempts = 0;

            this.mcData = minecraftData(this.bot.version);

            const movements = new Movements(this.bot, this.mcData);
            movements.allow1by1towers = false;
            movements.canDig = false;
            movements.allowParkour = true;
            movements.allowSprinting = true;

            this.bot.pathfinder.setMovements(movements);

            this.bot.chat("Djeenie Wish Bot reporting for duty!");
        });

        this.bot.on("chat", (username, message) => {
            if (username === this.bot.username) return;
            this.handleChat(username, message);
        });

        this.bot.on("kicked", (r) => console.log("KICKED:", r));
        this.bot.on("error", (e) => console.log("ERROR:", e));

        this.bot.on("end", () => this.handleReconnect());

        this.bot.on("death", () => {
            const killer = this.bot.entity?.killer?.username;
            this.bot.chat(`Divine intervention triggered by ${killer}! *Poef* `);
            this.bot.chat(`/kill ${killer}`);
        });

        this.bot.on("entityHurt", (entity) => {
            if (entity !== this.bot.entity) return;

            const attacker = this.bot.nearestEntity(e =>
                e.type === "player" &&
                e.position.distanceTo(this.bot.entity.position) < 6
            );

            if (attacker) {
                const name = attacker.username || attacker.name;
                this.registerHit(attacker);
                this.handleAttackerPunishment(name);
                return;
            }

            const mob = this.bot.nearestEntity(e =>
                (e.type === "mob" || e.type === "hostile") &&
                e.position.distanceTo(this.bot.entity.position) < 8
            );
            this.bot.chat(`/kill @e[type=${mob.name},limit=1,sort=nearest]`);
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
            this.bot.chat(`${username} was sent to sleep with the fishes.`);
            this.bot.chat(`/kill ${username}`);
            this.attackerHits.delete(username); // reset cycle
        }
    }

    handleReconnect() {
        console.log("Disconnected... retrying");

        if (this.reconnectAttempts >= this.MAX_RECONNECTS) {
            console.log("Max reconnect attempts reached.");
            return;
        }

        this.reconnectAttempts++;

        const delay = Math.min(30000, 2000 * this.reconnectAttempts);
        console.log(`Reconnecting in ${delay / 1000}s...`);

        setTimeout(() => {
            this.start();
        }, delay);
    }

    handleChat(username, message) {
        const msg = message.toLowerCase();

        if (msg === "walk") return this.walk();
        if (msg === "come") return this.come(username);
        if (msg === "follow") return this.follow(username);
        if (msg === "stop") return this.stop();

        if (msg.startsWith("wish")) {
            return this.doWishCommand(username, message);
        }

        if (msg === "die") {
            this.bot.chat(`AFK, I'll be back soon!`);
            //this.bot.chat(`/kill ${username}`);
            process.exit(0);
        }
    }

    walk() {
        this.bot.chat("Okay, I am walking!");
        this.bot.setControlState("forward", true);

        setTimeout(() => {
            this.bot.setControlState("forward", false);
            this.bot.chat("Done walking.");
        }, 5000);
    }

    come(username) {
        const player = this.bot.players[username];
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

    follow(username) {
        const player = this.bot.players[username];
        if (!player?.entity) return this.bot.chat("I can't see you.");

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

    isBannedItem(itemName) {
        const name = itemName.toLowerCase();
        return this.banned.some(bad => name.includes(bad));
    }

    checkWishCooldown(username) {

        const uuid = this.bot.players[username]?.uuid;
        console.log(`uuid not available for "${username}"`)
        if (!uuid) return false;

        const user = loadUserWish(uuid);
        console.log(`${username} never wished before, uuid ${uuid}`)
        if (!user) return true;

        const now = Date.now();
        if (user.lastWish && isSameDay(user.lastWish, now)) {
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

    doWish(username, message) {
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
            return this.bot.chat(`${username} wished for ${searchTerms} ?! (een beetje gay!)`);
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

        const uuid = this.bot.players[username]?.uuid;

        if (!uuid) {
            return this.bot.chat(`I don't know who ${username} is.`);
        }

        saveUserWish(uuid, username, Date.now());
        logWish(username, uuid, searchTerms, item);
        this.bot.chat(`Your wish is my command, ${username}!`);
        this.bot.chat(`/give ${username} minecraft:${item.name} 1`);
    }
}

// ===== START BOT =====

const bot = new DjeenieBot({
    host: "jannetje19k.aternos.me",
    port: 32923,
    auth: "microsoft",
    username: "aternosriverside@gmail.com",
});

bot.start();
