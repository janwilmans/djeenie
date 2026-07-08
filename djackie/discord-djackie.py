import discord
import subprocess
import asyncio
from discord.ext import commands

TOKEN = os.environ["DISCORD_TOKEN"]

MINECRAFT_CHANNEL = 1522621205952331890

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(
    command_prefix="!",
    intents=intents,
    help_command=None
)

djeenie_process = None


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")

    guild = discord.utils.get(bot.guilds, name="Riverside")
    if guild is None:
        print("Server not found.")
        return

    print("Servers:")
    for guild in bot.guilds:
        print(f"- {guild.name} ({guild.id})")

    print("Server ok.")

    channel = guild.get_channel(MINECRAFT_CHANNEL)
    if channel is None:
        print("Channel 'minecraft' not found.")
        return

    await channel.send("Hello, I'm Djacky, a robot created by Jannetje19k!")

    print("Message ok.")


@bot.command()
async def ping(ctx):
    await ctx.send("Pong!")


async def start(ctx):
    subprocess.Popen(["node", r"C:\project\djeenie-project\djeenie\bot.js"])


@bot.command(help="Starts Djeenie on rivenside5.")
async def start(ctx):
    global djeenie_process

    # Check if Djeenie is already running
    if djeenie_process is not None and djeenie_process.poll() is None:
        await ctx.send("Djeenie is already running!")
        return

    djeenie_process = subprocess.Popen(
        ["node", "bot.js"],
        cwd=r"C:\project\djeenie-project\djeenie"
    )

    await ctx.send("Spawning a new Djeenie on rivenside5.aternos.nu, port 40438!")

    async def watch_process():
        global djeenie_process

        returncode = await asyncio.to_thread(djeenie_process.wait)

        await ctx.send("Djeenie died!? Who did that? Use !start to respawn her...")

        print(f"(Djeenie exited with return code {returncode})")

        # Clear the reference so !start works again
        djeenie_process = None

    asyncio.create_task(watch_process())


@bot.command()
async def hello(ctx):
    await ctx.send(f"Hello {ctx.author.mention}!")


@bot.command(name="help")
async def help_command(ctx, command_name: str = None):
    if command_name:
        command = bot.get_command(command_name)

        if command is None:
            await ctx.send(f'No command called "{command_name}" found.')
            return

        response = f"{command.name}\n"

        if command.help:
            response += f"{command.help}\n"

        await ctx.send(f"```text\n{response}```")
        return

    lines = ["Commands:"]

    for command in sorted(bot.commands, key=lambda c: c.name):
        if command.name == "help":
            continue

        description = command.help or ""
        lines.append(f"  {command.name:<6} {description}")

    await ctx.send("```text\n" + "\n".join(lines) + "\n```")


@bot.event
async def on_message(message):
    if message.author.bot:
        return

    if message.content == "!die":
        await message.channel.send("Goodbye!")
        return

    await bot.process_commands(message)

bot.run(TOKEN)
