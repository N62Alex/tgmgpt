import { Telegraf, session } from 'telegraf'
import { message } from 'telegraf/filters'
import config from 'config'
import process from "nodemon";
import { ogg } from './ogg.js'
import { openAi  } from './gpt.js'
import { code }   from 'telegraf/format'


const APP_ENV = config.get('APP_ENV')

const userAccess = config.get('GRANTED_USERS')

let checkAccess = function (telegramUser, successLogin = false) {
    userAccess.forEach(function (user) {
        if (telegramUser === user) {
            successLogin = true
        }
    })
    return successLogin
}

const INITIAL_SESSION = {
    messages: []
}

const bot = new Telegraf(config.get('TELEGRAM_TOKEN'))

bot.use(session())

bot.command('drop', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Начали новую сессию')
})

bot.command('start', async (ctx) => {
    ctx.session = INITIAL_SESSION
    await ctx.reply('Начали новую сессию')
})

bot.on(message('voice'), async (ctx) => {
    let telegramUser = null
    if(typeof (ctx.session) == null || typeof (ctx.session) === 'undefined') {
        ctx.session = INITIAL_SESSION
    } else {
        telegramUser = ctx.message.from.username
    }
    if (!checkAccess(telegramUser)) {
        return
    }
    try {
        await ctx.reply(code(`Сообщение получено. Идет обработка...ага`))
        const link = await ctx.telegram.getFileLink(ctx.message.voice.file_id)
        const userId = String(ctx.message.from.id)
        const oggPath = await ogg.create(link.href, userId)
        const mp3Path = await ogg.toMp3(oggPath, userId)
        const text = await openAi.transcription(mp3Path)
        await ctx.reply(code(`Запрос ${text}`))

        ctx.session.messages.push({
            role: openAi.roles.USER,
            content: text
        })

        const response = await openAi.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openAi.roles.ASSISTAN,
            content: response.content
        })

    await ctx.reply(response.content)

    } catch (e) {
        console.log(`voice error`, e.message)
    }
})
bot.on(message('text'), async (ctx) => {
    let telegramUser = null
    if(typeof (ctx.session) == null || typeof (ctx.session) === 'undefined') {
        ctx.session = INITIAL_SESSION
    } else {
        telegramUser = ctx.message.from.username
    }
    if (!checkAccess(telegramUser)) {
        return
    }
    try {
        await ctx.reply(code(`Сообщение получено. Идет обработка...ага`))

        ctx.session.messages.push({
            role: openAi.roles.USER,
            content: ctx.message.text
        })

        const response = await openAi.chat(ctx.session.messages)

        ctx.session.messages.push({
            role: openAi.roles.ASSISTAN,
            content: response.content
        })

    await ctx.reply(response.content)

    } catch (e) {
        console.log(`text error`, e.message)
    }
})

bot.launch()

process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))