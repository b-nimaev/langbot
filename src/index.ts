import dotenv from 'dotenv';
import rlhubContext from './bot/models/rlhubContext';
import { Scenes, Telegraf, session } from 'telegraf';
dotenv.config()
import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from "openai";
import { FmtString } from "telegraf/typings/format";
const configuration = new Configuration({
    apiKey: process.env.apikey,
});

const openai = new OpenAIApi(configuration);

export async function send_words(id: number) {
    try {

        let user = await User.findOne({ id: id })

        let lang = user.selectedLanguage

        await bot.telegram.sendChatAction(id, 'typing');

        await openai.createChatCompletion({
            model: "gpt-4-0613",
            temperature: .3,
            messages: [{ role: 'system', content: `надо сгенерировать 15 случайных слов на ${lang === 'pl' ? 'польском' : ''}${lang === 'en' ? 'английском' : ''}${lang === 'de' ? 'немецком' : '' } языке и перевод к ним на русский язык, и транскрипцю к произношениям добавь` }]
        }).then(async (response) => {
            console.log(response.data.usage)
            if (response.data) {

                console.log(response.data.choices)

                if (response.data.choices) {

                    if (response.data.choices[0]) {

                        if (response.data.choices[0].message) {
                            if (response.data.choices[0].message.content) {

                                await bot.telegram.sendMessage(id, `${response.data.choices[0].message.content}`, { parse_mode: 'HTML' })

                            }
                        }


                    }

                }
            }

        }).catch(async (error) => {
            console.error(error.response)
        })

    } catch (err) {
        console.error(err)
    }
}
export const bot = new Telegraf<rlhubContext>(process.env.BOT_TOKEN!);

import './app'
import './webhook'
import './database'

import home from './bot/views/home.scene';
import { IUser, User } from './models/IUser';
import { greeting } from './bot/views/home.scene';
import chat from './bot/views/chat.scene';
import { ObjectId } from 'mongoose';
import { ChatModel } from './models/IChat';
const stage: any = new Scenes.Stage<rlhubContext>([ home, chat ], { default: 'home' });

home.command('get_users', async (ctx: rlhubContext) => {

    let user = await User.findOne({
        id: ctx.from?.id
    })

    if (user?.permissions?.admin) {

        let users = await User.find()
        let stats: {
            count: number
        } = {
            count: users.length
        }

        let message: string = ``

        message += `Количество пользователей: ${stats.count}\n`
        message += `/list\n`
        message += `/sendemail\n`

        return ctx.reply(message)

    } else {
        return ctx.reply('Прав нет!')
    }

});

home.command('list', async (ctx: rlhubContext) => {

    const users = await User.find()
    let message: string = ``

    users.forEach(async (element, index) => {
        message += `${index}) `

        if (element.username) {
            message += `@${element.username} `
        }

        if (element.first_name) {
            message += `<i>${element.first_name}</i>`
        }

        message += `\n`
    })

    await ctx.reply(message, { parse_mode: 'HTML' })

})

// ;(async () => {
    
//     let users = await User.find()
//     let date = new Date().getHours()-5
//     // console.log(date)

//     for (let i = 0; i < users.length; i++) {

//         await send_words(users[i].id)

//     }

// })();

// права админа
// home.command('add_permissions', async(ctx: rlhubContext) => {

//     return await User.findOneAndUpdate({
//         id: ctx.from?.id
//     }, {
//         $set: {
//             permissions: {
//                 admin: true
//             }
//         }
//     }).then(async () => {
//         await ctx.reply('права переданы')
//     }).catch(async (error) => {
//         await ctx.reply('возникла ошибка')
//         console.error(error)
//     })

// })

bot.use(session())
bot.use(stage.middleware())
bot.start(async (ctx) => {
    await ctx.scene.enter('home')
    // ctx.deleteMessage(874)
})
bot.action(/./, async function (ctx: rlhubContext) {
    // await ctx.scene.enter('home')
    ctx.answerCbQuery()
    await greeting(ctx, true)
})
