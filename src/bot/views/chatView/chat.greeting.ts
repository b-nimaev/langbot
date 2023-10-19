import { ExtraEditMessageText } from "telegraf/typings/telegram-types"
import rlhubContext from "../../models/rlhubContext"
import { IUser, User } from "../../../models/IUser"
import { clear_chats } from "../chat.scene"
import { ObjectId } from "mongoose"
import { IChat, ChatModel } from "../../../models/IChat"
import { Configuration, OpenAIApi } from "openai";
const configuration = new Configuration({
    apiKey: process.env.apikey,
});

const openai = new OpenAIApi(configuration);

export default async function greeting(ctx: rlhubContext) {
    try {

        await ctx.telegram.sendChatAction(ctx.from.id, "typing")

        await sendreq(ctx)


    } catch (error) {

        console.error(error)

    }
}

async function sendreq(ctx: rlhubContext) {

    try {

        // уведомление о создании комнаты

        let message: string = ``

        // находим пользователя

        let user: IUser | null = await User.findOne({
            id: ctx.from?.id
        })

        if (!user || !user._id) {
            return ctx.answerCbQuery("Пользователь не найден!")
        }

        let chat: IChat | undefined = {
            user_id: user._id,
            context: [
                {
                    "role": "system",
                    "content": `Привет! Я бот-самоучитель иностранных языков. Приятно познакомиться! Я могу обучить тебя ${user.selectedLanguage === 'pl' ? 'польскому' : ''}
            ${user.selectedLanguage === 'de' ? 'немецкому' : ''}${user.selectedLanguage === 'en' ? 'английскому' : ''} языку, общаясь на любую тему, чтобы помочь тебе улучшить знание языка. Давай начнем разговор! Если у тебя есть вопросы или хочешь поговорить о чем-то конкретном, не стесняйся!`
                },
                {
                    "role": "system",
                    "content": `каждый ответ не должен превышать 150 слов. Сначала идёт текст на ${user.selectedLanguage === 'pl' ? 'польском' : ''}
            ${user.selectedLanguage === 'de' ? 'немецком' : ''}${user.selectedLanguage === 'en' ? 'английском' : ''} языке. Потом перевод на русском. После каждого текста на иностранном языке, я должен предоставить перевод на русском."
            `
                },
                {
                    "role": "system",
                    "content": `Надо в каждом сообщении от assistant между иностранным и русским текстом ставить разделитель -----------------------`
                }
            ]
        };


        await clear_chats(user)

        // await ChatModel.findById()

        await new ChatModel(chat).save().then((async (response) => {

            if (!user) {
                return ctx.answerCbQuery("Пользователь не найден!")
            }

            await User.findByIdAndUpdate(user._id, { $push: { chats: response._id } })

            // сохраняем айди чата в контекст бота 
            ctx.scene.session.current_chat = response._id

        }))

        // console.log(ctx.scene.session.current_chat)

        let current_chat: ObjectId = ctx.scene.session.current_chat
        let old = await ChatModel.findById(current_chat)

        if (chat && chat.context) {
            await ChatModel.findById(current_chat).then(async (document: IChat | null) => {
                
                await openai.createChatCompletion({
                    model: "gpt-4-0613",
                    temperature: .1,
                    // @ts-ignore
                    messages: chat.context,
                }).then(async (response) => {

                    if (response) {

                        if (response.data.choices[0].message?.content) {
                            await ctx.editMessageText(response.data.choices[0].message?.content, { parse_mode: 'HTML' })
                            ctx.wizard.selectStep(1)
                            await ChatModel.findByIdAndUpdate(ctx.scene.session.current_chat, {
                                $push: {
                                    context: response.data.choices[0].message
                                }
                            })
                        }

                    }

                }).catch(async (error) => {
                    console.error(error.response.data)
                })

            })
        }

        return message

    } catch (error) {

        console.error(error)
        return await greeting(ctx)

    }

}