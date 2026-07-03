const mineflayer = require("mineflayer");

const { pathfinder, Movements, goals } = require("mineflayer-pathfinder");
const minecraftData = require("minecraft-data");

// https://www.minecraftskins.com/skin/24157083/-what-s-real-what-s-fake-/


// Profile
// Jeenie5490
// aternosriverside@gmail.com
// bedrock port: 40438
//  riverside5.aternos.me, poort:  40438 versie: 26.2

// /gamerule sendCommandFeedback false
// /gamerule random_tick_speed 20
// host: 'riverside5.aternos.me',

// with port 32923:
//[16:45:36 ERROR]: Username 'Jeenie5490' tried to join with an invalid session
//[16:45:36 INFO]: Jeenie5490 (/37.251.123.192:1477) lost connection: Failed to verify username!

const bot = mineflayer.createBot({
    host: "jannetje19k.aternos.me",
    port: 32923,
    auth: "microsoft",
    username: "aternosriverside@gmail.com",
});

bot.loadPlugin(pathfinder);

bot.on("login", () => {
    console.log("Logged in");
});

function hasIronSword() {
    const item = bot.inventory.items().find((i) => i.name === "iron_sword");
    return !!item;
}

bot.on("spawn", () => {
    console.log("Spawned!");
    bot.chat("Hello from Djeenie!");

    const mcData = minecraftData(bot.version);
    const defaultMovements = new Movements(bot, mcData);
    defaultMovements.allow1by1towers = false;
    defaultMovements.canDig = false;
    defaultMovements.allowParkour = true;
    defaultMovements.allowSprinting = true;
    defaultMovements.allowParkour = true;
    bot.pathfinder.setMovements(defaultMovements);

    setTimeout(() => {
        if (!hasIronSword()) {
            bot.chat("I do not have an iron sword. Getting one...");
            bot.chat("/give @s minecraft:iron_sword 1");
        }
    }, 10000);
});

bot.on("error", (err) => {
    console.error("Error:", err);
});

bot.on("end", (reason) => {
    console.log("Disconnected:", reason);
});

const weapons = [
    "minecraft:iron_sword",
    "minecraft:wooden_sword",
    "minecraft:stone_sword",
    "minecraft:arrow",
    "minecraft:egg",
    "minecraft:crossbow",
    "minecraft:iron_axe",
    "minecraft:stone_axe",
    "minecraft:wooden_axe",
];

function getRandomWeapon() {
    return weapons[Math.floor(Math.random() * weapons.length)];
}

const lastWish = new Map();
const ONE_DAY = 24 * 60 * 60 * 1000;
const ONE_MINUTE = 60 * 1000;

bot.on("chat", (username, message) => {
    if (username === bot.username) return;

    if (message.toLowerCase() === "walk") {
        bot.chat("Okay, I am walking!");

        // Start walking forward
        bot.setControlState("forward", true);

        // Stop after 5 seconds
        setTimeout(() => {
            bot.setControlState("forward", false);
            bot.chat("Done walking.");
        }, 5000);
    }

    if (message.toLowerCase() === "come") {
        const player = bot.players[username];

        if (!player || !player.entity) {
            bot.chat("I can't see you.");
            return;
        }

        bot.chat(`Coming to you, ${username}!`);

        bot.pathfinder.setGoal(
            new goals.GoalNear(
                player.entity.position.x,
                player.entity.position.y,
                player.entity.position.z,
                1, // stop within 1 block
            ),
        );
    }

    if (message.toLowerCase() === "follow") {
        const player = bot.players[username];

        if (!player || !player.entity) {
            bot.chat("I can't see you.");
            return;
        }

        bot.chat(`Following you, ${username}!`);

        bot.pathfinder.setGoal(
            new goals.GoalFollow(player.entity, 2), // follow within 2 blocks
            true, // dynamic goal (keeps updating)
        );
    }

    if (message.toLowerCase() === "stop") {
        bot.pathfinder.setGoal(null);
        bot.chat("Stopped.");
    }

    if (message.toLowerCase() === "wish") {
        doWish(username, message);
    }

    if (message.toLowerCase() === "die") {
        return;
    }
});

const WISH_TIME = ONE_MINUTE;

const banned = [
    // Operator / admin items
    "command_block",
    "chain_command_block",
    "repeating_command_block",
    "command_block_minecart",
    "structure_block",
    "structure_void",
    "jigsaw",
    "debug_stick",

    // Unobtainable blocks
    "bedrock",
    "barrier",
    "light",

    // Spawn eggs (optional)
    "allay_spawn_egg",
    "ender_dragon_spawn_egg",
    "wither_spawn_egg",
    "end_crystal",
];

function doWish(username, message) {
    const now = Date.now();
    const previous = lastWish.get(username);

    // Cooldown check
    if (previous && now - previous < WISH_TIME) {
        const remaining = WISH_TIME - (now - previous);

        const minutes = Math.floor(remaining / (60 * 1000));
        const seconds = Math.floor((remaining % (60 * 1000)) / 1000);

        bot.chat(`${username}, you must wait ${minutes}m ${seconds}s before wishing again.`,);
        return;
    }

    // Parse: wish <item>
    const parts = message.trim().split(/\s+/);

    if (parts.length < 2) {
        bot.chat(`Usage: wish <item>`);
        return;
    }

    let itemName = parts.slice(1).join("_").toLowerCase();
    bot.chat(`You wished: ${itemName} `, itemName);

    // Accept both formats:
    // wish diamond_sword
    // wish minecraft:diamond_sword
    if (itemName.startsWith("minecraft:")) {
        itemName = itemName.substring(10);
    }

    // Forbidden item check
    if (banned.includes(itemName)) {
        bot.chat(`${username}, that item is forbidden and cannot be wished for.`,);
        return;
    }

    // Does the item exist?
    const item = mcData.itemsByName[itemName];

    if (!item) {
        bot.chat(`Sorry ${username}, "${itemName}" is not a valid item.`); return;
    }

    // Wish granted
    lastWish.set(username, now);
    bot.chat(`Your wish has been fulfilled, ${username}!`);
    bot.chat(`/give ${username} minecraft:${item.name} 1`);
}
