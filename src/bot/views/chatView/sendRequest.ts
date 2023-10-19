import { ChatCompletionRequestMessageRoleEnum, Configuration, OpenAIApi } from "openai";
import rlhubContext from "../../models/rlhubContext";
import { ObjectId } from "mongoose";
import { ChatModel, ContextModel, IChat } from "../../../models/IChat";
import dotenv from 'dotenv';
import { FmtString } from "telegraf/typings/format";
import greeting from "../chatView/chat.greeting";
dotenv.config()
const configuration = new Configuration({
    apiKey: process.env.apikey,
});

const openai = new OpenAIApi(configuration);

export async function sendRequest(ctx: rlhubContext) {
    try {
        
        await ctx.telegram.sendChatAction(ctx.from.id, 'typing');

        if (ctx.updateType === 'message') {

            console.log(ctx.update.message.text)
            
            const chatID: ObjectId = ctx.scene.session.current_chat
            await ChatModel.findByIdAndUpdate(chatID, {
                $push: {
                    context: {
                        role: 'user',
                        content: ctx.update.message.text
                    }
                }
            })

            await ChatModel.findById(chatID).then(async (document) => {
                if (document) {
                    if (document.context) {
                        await openai.createChatCompletion({
                            model: "gpt-4-0613",
                            temperature: .3,
                            // @ts-ignore
                            messages: document.context
                        }).then(async (response) => {
                            console.log(response.data.usage)
                            if (response.data) {

                                console.log(response.data.choices)
                                
                                if (response.data.choices) {

                                        if (response.data.choices[0]) {
                                            
                                            if (response.data.choices[0].message) {
                                                if (response.data.choices[0].message.content) {
                                                    
                                                    await ctx.reply(`${response.data.choices[0].message.content}`, { parse_mode: 'HTML' })
                                                    await ChatModel.findByIdAndUpdate(ctx.scene.session.current_chat, {
                                                        $push: {
                                                            context: response.data.choices[0].message
                                                        }
                                                    })

                                                }
                                            }


                                        }

                                }
                            }
                            
                        }).catch(async (error) => {
                            
                            await ctx.reply('Возникла ошибка')
                            await greeting(ctx)

                            console.error(error.response)
                        })
                    }
                }
            })
            

        }

        // let current_chat: ObjectId = ctx.scene.session.current_chat
        // let old = await ChatModel.findById(current_chat)
        // let chat = await ChatModel.findOneAndUpdate({
        //     _id: current_chat
        // }, {
        //     $set: {
        //         context: old?.context + '/n' + ctx.update.message.text.trim()
        //     }
        // })

        // let newDoc = await ChatModel.findById(current_chat)

        // const chatCompletion = await openai.createChatCompletion({
        //     model: "gpt-3.5-turbo",
        //     temperature: .1,
        //     // @ts-ignore
        //     messages: [{ role: "user", content: newDoc?.context.trim() }],
        // });

        // return chatCompletion
        // chatCompletion.data.choices[0].message?.content
    } catch (err) {
        console.error(err)
    }
}