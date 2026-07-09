Djeenie is an open-source Minecraft wish bot written in JavaScript using the Mineflayer ecosystem. It acts as an in-game assistant that listens to chat, manages player wishes, and automates common server interactions while running as a Minecraft client rather than as a server plugin.

# Features
- 🎁 Lets players make wishes through Minecraft chat commands.
- 💾 Persists wishes so they survive bot restarts.
- ⏱️ Enforces cooldowns (for example, one wish per day).
- 🤖 Runs as a Mineflayer bot, requiring no server-side plugin.
- ⚔️ Responds to in-game events such as nearby entities and combat.
- 🚶 Supports autonomous movement using Mineflayer's pathfinding.
- 🔗 Can be integrated with a Discord bot for monitoring and remote control.

# Technology
- Node.js
- Mineflayer
- mineflayer-pathfinder
- minecraft-data

# Typical use case

Djeenie is intended for Minecraft communities that want an interactive "genie" NPC. Players can ask the genie for wishes, while server administrators can extend it with additional commands, moderation features, Discord integration, or automated gameplay.

# Djacky

The djackie directory contains the companion Discord bot for Djeenie. While Djeenie lives inside Minecraft as a Mineflayer bot, Djackie bridges Minecraft and Discord, allowing server administrators and community members to monitor and interact with the Minecraft bot from Discord.

# Overview

Djackie is a Python application built with discord.py that acts as a gateway between Discord and Minecraft. It launches and supervises the Djeenie process, relays events between the two platforms, and provides a convenient interface for remote administration.

# Features
- 🤖 Discord bot integration
- Connects to a Discord server using a bot account.
- Posts Minecraft events to configurable channels.
- Responds to Discord commands.

# 🚀 Process management
 -Starts the Djeenie Mineflayer bot automatically.
- Monitors the process and can detect crashes or unexpected exits.
- Simplifies deployment by keeping both bots together.

# 💬 Minecraft ↔ Discord bridge (aspirational)

- Forwards Minecraft chat and status messages to Discord. 
- Can be extended to relay Discord messages back into Minecraft.
- Provides a central communication hub for players and administrators.

# ⚙️ Configuration
- Uses environment variables (.env) to securely store tokens and configuration.
- Avoids hardcoding Discord bot credentials.

# Technology Stack
- Python 3
- discord.py
- asyncio
- subprocess (for launching Djeenie)
- python-dotenv (or equivalent environment loader)

# Typical Use Case

A server administrator runs Djackie on a small server or home PC. When Djackie starts:

- It logs into Discord.
- It launches the Djeenie Minecraft bot.
- Djeenie joins the Minecraft server.
- Djackie reports status updates, chat messages, and other events to Discord.
- Administrators can monitor the Minecraft bot remotely without needing to stay logged into the game.

Together, Djeenie and Djackie form a two-part automation system:

Djeenie handles in-game behavior, player interaction, pathfinding, and gameplay automation.
Djackie provides the management, monitoring, and communication layer through Discord, making the Minecraft bot easier to operate and extend.
