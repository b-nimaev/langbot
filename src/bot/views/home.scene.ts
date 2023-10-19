import { Composer, Scenes } from "telegraf";
import { ExtraEditMessageText } from "telegraf/typings/telegram-types";
import { ISentence, Sentence } from "../../models/ISentence";
import { IUser, User } from "../../models/IUser";
import rlhubContext from "../models/rlhubContext";
import { sendRequest } from "./chatView/sendRequest";
import { ObjectId } from "mongoose";
import { IChat, ChatModel, ContextModel } from "../../models/IChat";
import { clear_chats } from "./chat.scene";
import { Configuration, OpenAIApi } from "openai";
import { render_sentencse_for_translate } from "./sentencesView/renderSentences";
import { resolveModuleNameFromCache } from "typescript";

const configuration = new Configuration({
    apiKey: process.env.apikey,
});

const openai = new OpenAIApi(configuration);

const handler = new Composer<rlhubContext>();
const home = new Scenes.WizardScene("home",
    handler,
    async (ctx) => {
        try {

            if (ctx.updateType === 'message') {

                await level_select_section_render(ctx)

            }

            if (ctx.updateType === 'callback_query') {
                
                let data: number = parseFloat(ctx.update.callback_query.data.split(" ")[1])

                await User.findOneAndUpdate({ id: ctx.from.id }, { 
                    $set: {
                        level: data
                    }
                })

                await select_time_render (ctx)

           }

        } catch (error) {

            ctx.reply('Упс, Ошибка')
            console.error(error)

        }
    },
    async (ctx: rlhubContext) => await select_time_handler(ctx),
    async (ctx: rlhubContext) => await weekends_handler(ctx),
    async (ctx: rlhubContext) => await select_minutes_handler(ctx),
    async (ctx: rlhubContext) => await params_confirm_handler(ctx)
);
async function select_minutes_render(ctx: rlhubContext) {
    try {
        
        let message: string = `Выберите время, к которому хотите отредактировать минуты`
        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: []
            }
        }

        const user = await User.findOne({ id: ctx.from.id })

        let row = []

        for (let i = 0; i < user.hours.length; i++) {

            const hour = user.hours[i].hour < 10 ? `0${user.hours[i].hour}:00` : `${user.hours[i].hour}:00`; // Преобразование в формат "00" или "0X" для часов
            let button = [{ text: hour, callback_data: `select_hour ${user.hours[i].hour}` }]

            // @ts-ignore
            // extra.reply_markup.inline_keyboard.push(button)

            row.push(button)

            if (row.length === 3) {
                extra.reply_markup.inline_keyboard.push(row)
                row = []
            }

        }

        if (row.length > 0) {
            extra.reply_markup.inline_keyboard.push(row)
        }

        extra.reply_markup.inline_keyboard.push([{ text: 'Пропустить', callback_data: 'skip' }])
        extra.reply_markup.inline_keyboard.push([{ text: 'Назад', callback_data: 'back' }])

        await ctx.editMessageText(message, extra)
        ctx.wizard.selectStep(4)

    } catch (error) {
        console.error(error)
    }
}
async function select_minutes_handler(ctx: rlhubContext) {
    try {
        
        if (ctx.updateType === 'callback_query') {

            let data: string = ctx.update.callback_query.data

            if (data === 'skip') {

                ctx.wizard.selectStep(3)
                let message: string = `Можно ли беспокоить тебя в выходные?`
                let extra: ExtraEditMessageText = {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Да', callback_data: 'yes' }, { text: 'Нет', callback_data: 'no' }]
                        ]
                    }
                }

                await ctx.editMessageText(message, extra)

            }

            if (data.split(" ")[0] === 'select_hour') {
                
                const hour: number = parseFloat(data.split(" ")[1])
                ctx.scene.session.selected_hour = hour
                
                let message: string = `Выберите период`
                let extra: ExtraEditMessageText = {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: []
                    }
                }

                extra.reply_markup.inline_keyboard.push([
                    { text: '0 - 15 минут', callback_data: 'select_minute ' + 0 },
                    { text: '15 - 30 минут', callback_data: 'select_minute ' + 15 },
                ])
                extra.reply_markup.inline_keyboard.push([
                    { text: '30 - 45 минут', callback_data: 'select_minute ' + 30 },
                    { text: '45 - 60 минут', callback_data: 'select_minute ' + 45 },
                ])

                ctx.answerCbQuery(`${hour}`)
                ctx.editMessageText(message, extra)

            }

            if (data.split(" ")[0] === 'select_minute') {

                await periodRender(ctx, data)

            }

            if (data.split(" ")[0] === ('next' || 'back')) {

                await periodRender(ctx, data)

            }

            if (data === 'back') {

                await select_time_render(ctx)

            }

        }

    } catch (error) {
        console.error(error)
    }
}

async function periodRender(ctx, data) {
    try {
        const period: number = parseFloat(data.split(" ")[1])
        const hour = ctx.scene.session.selected_hour < 10 ? `0${ctx.scene.session.selected_hour}` : `${ctx.scene.session.selected_hour}`

        let message: string = `Выберите минуту, котору хотите добавить для ${hour}:00`
        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: []
            }
        }

        let row = []

        for (let i = period; i < period + 15; i++) {
            const str = i < 10 ? `${hour}:0${i}` : `${hour}:${i}`;
            const button = { text: `${str}`, callback_data: `select_min ${i}` }

            row.push(button)

            if (row.length === 3) { // Изменено условие на добавление строки
                extra.reply_markup.inline_keyboard.push(row)
                row = []
            }
        }

        if (row.length > 0) {
            extra.reply_markup.inline_keyboard.push(row)
        }

        if (period !== 0 && period !== 45) {
            extra.reply_markup.inline_keyboard.push([{ text: 'prev 15 min', callback_data: 'back ' + (period + 15) }, { text: 'next 15 min', callback_data: 'next ' + (period + 15) }])
        } else if (period !== 0) {
            extra.reply_markup.inline_keyboard.push([{ text: 'prev 15 min', callback_data: 'back ' + (period + 15) }])
        } else {
            extra.reply_markup.inline_keyboard.push([{ text: 'next 15 min', callback_data: 'next ' + (period + 15) }])
        }

        ctx.answerCbQuery(``)
        ctx.editMessageText(message, extra)
    } catch (error) {
        console.error(error)
    }
}

async function weekends_handler(ctx: rlhubContext) {
    try {
        if (ctx.updateType === 'callback_query') {
            let data: 'yes' | 'no' = ctx.update.callback_query.data
            
            if (data === "yes") {
                await User.findOneAndUpdate({
                    id: ctx.from.id
                }, {
                    $set: {
                        weekends: true
                    }
                })
            } else {
                await User.findOneAndUpdate({
                    id: ctx.from.id
                }, {
                    $set: {
                        weekends: false
                    }
                })
            }

            // await chatgreeting(ctx)
            ctx.scene.enter("chat")
            ctx.answerCbQuery(data)
        }
    } catch (error) {
        console.error(error)
    }
}
async function select_time_handler(ctx: rlhubContext) {
    try {
        if (ctx.updateType === 'callback_query') {

            let data: string = ctx.update.callback_query.data

            if (data === 'back') {
                ctx.wizard.selectStep(1)
                return await level_select_section_render(ctx)
            }

            if (data === 'continue') {

                return await select_minutes_render(ctx)

                ctx.wizard.selectStep(3)
                let message: string = `Можно ли беспокоить тебя в выходные?`
                let extra: ExtraEditMessageText = {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Да', callback_data: 'yes' }, {text: 'Нет', callback_data: 'no'}]
                        ]
                    }
                }

                await ctx.editMessageText(message, extra)
            
            }

            if (data.indexOf("selected_time") !== -1) {
                
                data = data.replace("selected_time_", "")

                await User.findOneAndUpdate({
                    id: ctx.from.id
                }, {
                    $push: {
                        hours: {
                            hour: parseFloat(data)
                        }
                    }
                })

                
            } else if (data.indexOf("exists_time_") !== 1) {

                data = data.replace("exists_time_", "")

                await User.findOneAndUpdate({
                    id: ctx.from.id
                }, {
                    $pull: {
                        hours: {
                            hour: parseFloat(data)
                        }
                    }
                })
                
            }
            
            await select_time_render(ctx)

            ctx.answerCbQuery()

        }
    } catch (error) {
        console.error(error)
    }
}

async function select_time_render (ctx: rlhubContext) {
    try {

        const user = await User.findOne({ id: ctx.from.id })
        
        let message: string = `Выбери время, когда отправлять тебе новые слова`

        if (user.hours) {
            if (user.hours.length > 0) {

                let hours: string = ``

                for (let i = 0; i < user.hours.length; i++) {
                    
                    const hour = user.hours[i].hour < 10 ? `0${user.hours[i].hour}:00` : `${user.hours[i].hour}:00`; // Преобразование в формат "00" или "0X" для часов
                    
                    if (i === user.hours.length - 1) {
                        hours += `${hour}`
                    } else {
                        hours += `${hour}, `
                    }
                }

                message += `\n<i>Выбрано: [${hours}]</i>`

            }
        }

        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    // [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        }

        let col = [];

        for (let i = 0; i < 24; i++) {
            const hour = i < 10 ? `0${i}` : `${i}`; // Преобразование в формат "00" или "0X" для часов
            let exists = 0
            
            for (let y = 0; y < user.hours.length; y++) {

                let userhour = user.hours[y]

                if (userhour.hour === parseFloat(hour)) {
                    
                    exists = 1

                }

            }

            // if (user.hours.indexOf(parseFloat(hour)) !== -1) {

                // exists = 1
                
            // }

            const callbackData = `${exists === 1 ? "exists_time_" : "selected_time_" }${hour}`;
            
            // Создаем кнопку для текущего часа
            const button = { text: `${hour}:00 ${ exists === 1 ? "✅" : "" }`, callback_data: callbackData };

            // Добавляем кнопку в текущую колонку
            col.push(button);

            // Если собрали 3 кнопки, добавляем колонку в клавиатуру и сбрасываем col
            if (col.length === 3) {
                extra.reply_markup.inline_keyboard.push(col);
                col = [];
            }
        }

        // Если в конце остались кнопки, добавляем их
        if (col.length > 0) {
            extra.reply_markup.inline_keyboard.push(col);
        }

        extra.reply_markup.inline_keyboard.push([{ text: 'Далее', callback_data: 'continue' }])
        extra.reply_markup.inline_keyboard.push([{ text: 'Назад', callback_data: 'back' }])

        await ctx.editMessageText(message, extra)
        ctx.wizard.selectStep(2)

    } catch (error) {
        console.error(error)
    }
}
export async function greeting(ctx: rlhubContext, reply?: boolean) {

    let user: IUser | null = await User.findOne({ id: ctx.from?.id })

    const extra: ExtraEditMessageText = {
        parse_mode: 'HTML',
        reply_markup: {
            inline_keyboard: [
                [{ text: 'Польский 🇵🇱', callback_data: "lang pl" }],
                [{ text: 'Английский 🇬🇧', callback_data: "lang en" }],
                [{ text: 'Немецкий 🇩🇪', callback_data: "lang de" }],
            ]
        }
    }

    let message: string = `Привет! 👋\n\n`

    message += `Ты хочешь выучить новый язык? 🌏\n\n`

    message += `Выбери язык, который ты хочешь выучить:`

    try {

        ctx.updateType === 'callback_query' ? await ctx.editMessageText(message, extra) : ctx.reply(message, extra)

    } catch (err) {

        console.log(err)

    }
}

home.action(/^lang.*/, async (ctx: rlhubContext) => {
    try {

        let data: string = ctx.update.callback_query.data

        let selectedLanguage = data.split(' ')[1]

        await User.findOneAndUpdate({ id: ctx.from.id }, {
            $set: {
                selectedLanguage: selectedLanguage
            }
        })

        ctx.wizard.selectStep(1)
        await level_select_section_render(ctx)
        ctx.answerCbQuery()

    } catch (error) {

        console.error(error)

    }
})

async function level_select_section_render(ctx: rlhubContext) {
    try {

        let user = await User.findOne({ id: ctx.from.id })

        if (!user) { return greeting(ctx) }

        let selectedLanguage: string

        if (user.selectedLanguage === 'en') {
            selectedLanguage = 'английский'
        } else if (user.selectedLanguage === 'pl') {
            selectedLanguage = 'польский'
        } else {
            selectedLanguage = 'немецкий'
        }

        let ln = `${user.selectedLanguage === 'en' ? 'английском' : ''}${user.selectedLanguage === 'pl' ? 'польском' : ''}${user.selectedLanguage === 'de' ? 'немецком' : ''}`
        let ln2 = `${user.selectedLanguage === 'en' ? 'английского' : ''}${user.selectedLanguage === 'pl' ? 'польского' : ''}${user.selectedLanguage === 'de' ? 'немецкого' : ''}`

        let message: string = `Я - , твой персональный помощник в изучении ${ln2} языка 🤓. Я буду рад помочь тебе достичь своих целей в изучении языка 💪.\n\n`
        message += `Чтобы начать, давай определим твой текущий уровень ${ln2} языка 🎓. Это поможет мне подобрать для тебя подходящие материалы и упражнения 🎯.\n\n`
        message += `Выбери один из вариантов:\n\n`

        message += `Начинающий 👶 - ты только начинаешь изучать ${selectedLanguage} язык и знаешь очень мало слов и выражений ❓\n`
        message += `Базовый 🧒 - ты уже знаешь некоторые базовые слова и выражения, но тебе трудно общаться на ${user.selectedLanguage === 'en' ? 'английском' : ''}${user.selectedLanguage === 'pl' ? 'польском' : ''}${user.selectedLanguage === 'de' ? 'немецком' : ''} языке 🗣\n`
        message += `Средний 👦 - ты можешь общаться на ${ln} языке на простые темы, но тебе еще нужно улучшить свой словарный запас и грамматическую точность ✏️\n`
        message += `Продвинутый 👨 - ты можешь общаться на ${ln} языке свободно и уверенно 💯.\n`

        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: `Начинающий 👶`, callback_data: 'level 1' }],
                    [{ text: `Базовый 🧒`, callback_data: 'level 2' }],
                    [{ text: `Средний 👦`, callback_data: 'level 3' }],
                    [{ text: `Продвинутый 👨`, callback_data: 'level 4' }],
                ]
            }
        }

        await ctx.editMessageText(message, extra)

    } catch (error) {
        console.error(error)
    }
}

async function params_confirm_handler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'continue' | 'back' = ctx.update.callback_query.data

            if (data === 'back') {

                await add_2ParamHandlerRender(ctx)

            }

            if (data === 'continue') {

                let data: {
                    role: String,
                    content: String
                } = {
                    role: 'system',
                    content: `Первый параметр: ${ctx.scene.session.firstParameter} конец первого параметра. Второй параметр: ${ctx.scene.session.secondParameter}`
                }

                await new ContextModel(data).save()
                await add_data_render(ctx)
                ctx.answerCbQuery('Сохранено!')

            }

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_2ParamHandler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'back' = ctx.update.callback_query.data

            if (data === 'back') {

                await add_data_render(ctx) // wizard step 3 

            }

        } else if (ctx.updateType === 'message') {

            if (ctx.update.message.text) {

                let message: string = ctx.update.message.text

                ctx.scene.session.secondParameter = message

                let message2 = `На примерный вопрос: <b>${ctx.scene.session.firstParameter}</b>\nБудет следующий ответ: ${message}`

                let extra: ExtraEditMessageText = {
                    parse_mode: 'HTML',
                    reply_markup: {
                        inline_keyboard: [
                            [{ text: 'Подтвердить', callback_data: 'continue' }],
                            [{ text: 'Назад', callback_data: 'back' }]
                        ]
                    }
                }

                await ctx.reply(message2, extra)
                // await ctx.reply(message, extra)

                ctx.wizard.selectStep(5)


            }

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_2ParamHandlerRender(ctx: rlhubContext) {
    try {


        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        }

        ctx.wizard.selectStep(4) // to 2 param

        if (ctx.updateType === 'message') {

            let message: string = ctx.update.message.text
            ctx.scene.session.firstParameter = message

            message = `Отправьте ответ к вопросу: <b>${message}</b>`

            await ctx.reply(message, extra)

        } else {

            await ctx.editMessageText(`Отправьте ответ к вопросу: <b>${ctx.scene.session.firstParameter}</b>`, extra)

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_firstParamHandler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'back' = ctx.update.callback_query.data

            if (data === 'back') {

                await study_model_gereration(ctx)

            }

        } else if (ctx.updateType === 'message') {

            await add_2ParamHandlerRender(ctx)

        } else {

            await add_data_render(ctx)

        }

    } catch (error) {
        console.error(error)
    }
}

async function add_data_render(ctx: rlhubContext) {
    try {

        let message: string = `Отправьте первый параметр: <b>Вопрос, который может задать клиент языковой модели</b>`
        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        }

        ctx.updateType === 'callback_query' ? await ctx.editMessageText(message, extra) : await ctx.reply(message, extra)
        ctx.wizard.selectStep(3)

    } catch (error) {
        console.error(error)
    }
}

async function study_model_handler(ctx: rlhubContext) {
    try {

        if (ctx.updateType === 'callback_query') {

            let data: 'add-data' | 'change-data' | 'delete-data' | 'back' = ctx.update.callback_query.data

            if (data === 'add-data') {

                await add_data_render(ctx)

            }

            if (data === 'back') {

                ctx.wizard.selectStep(0)
                await greeting(ctx)

            }

            ctx.answerCbQuery()

        } else {

            await study_model_gereration(ctx)

        }

    } catch (error) {

        console.error(error)

    }
}

async function study_model_gereration(ctx: rlhubContext) {
    try {

        let message: string = `<b>Обучение GPT</b>\n\n`
        let extra: ExtraEditMessageText = {
            parse_mode: 'HTML',
            reply_markup: {
                inline_keyboard: [
                    [{ text: 'Добавить новые данные модели', callback_data: 'add-data' }],
                    [{ text: 'Редактировать данные модели', callback_data: 'change-data' }],
                    [{ text: 'Удалить данные модели', callback_data: 'delete-data' }],
                    [{ text: 'Назад', callback_data: 'back' }]
                ]
            }
        }

        ctx.updateType === 'callback_query' ? await ctx.editMessageText(message, extra) : await ctx.reply(message, extra)

        ctx.wizard.selectStep(2)

    } catch (error) {
        console.error(error)
    }
}

home.action("start-chat", async (ctx) => {

    try {

        // уведомление о создании комнаты

        let message: string = `Ждите. Создание комнаты ...`

        await ctx.editMessageText(message, { parse_mode: 'HTML' })

        await ctx.telegram.sendChatAction(ctx.from.id, "typing")

        // находим пользователя

        let user: IUser | null = await User.findOne({
            id: ctx.from?.id
        })

        if (!user || !user._id) {
            return ctx.answerCbQuery("Пользователь не найден!")
        }

        const contextParams = await ContextModel.find()

        let chat: IChat | undefined = {
            user_id: user._id,
            context: [
                { role: "system", content: "Ты только отвечаешь есть заготовка ответа на вопрос или нет. Заготовки я тебе даю, с их идентификаторами. Если заготовка найдена, ты возвращаешь номер заготовки. Если заготовка отсутсвтует, ты возвращаешь цифру 0" }
                // { "role": "system", "content": "Поприветствуй пользователя, тебя зовут Адам. Ты в телеграмме, бот помощник диетолога. Ты будешь отвечать пользователям по моим заготовкам и скриптам. Только по моим заготовкам и скриптам. Ты не должен генерировать от себя текст. Первый параметр это входящий вопрос от пользователя. Второй параметр, это то, что ты должен ответить пользователю." },
                // { "role": "system", "content": "С момента старта программы прошло более 15 дней. В заготовках будут условия связанные с условиями выдачи информации, они будут называться скрипты. Действуй по описанному скрипту во втором параметре исходя из входных данных, например, сколько дней прошло со старта программы." },
                // { "role": "system", "content": "Если пользователь задает вопрос 'у меня не уходят объемы', он под этим подразумевает объемы фигуры. Поэтому, ты категорически не должен генерировать свой ответ. Ты должен вернуть, следующий текст: Объемы лучше отслеживать по одежде, смотреть стала ли она вам большевата, или попробовать одеть то, что было мало и посмотреть, как вы сейчас себя чувствуете в этой одежде\n\nОчень часто, когда мы ориентируемся на измерительную ленту, мы можем не увидеть итоговый результат. Например, ленту расположили по-разному. На первом измерении выше на 1 см, а второй ниже. Давайте начнем отслеживать ваши объемы по одежде, хорошо?" },
                // { "role": "system", "content": "Если пользователь задает вопрос 'Я заболеваю, что делать? (простуда, насморк, продуло, клиентка простыла или заболела во время программы)', Ты должен вернуть, следующий текст: Сейчас нам с вами нужно поддержать организм.\n\nВ момент, когда вы почувствовали слабость, кашель, дрожь во всем теле, насморк, головные боли, чувствуете, что заболеваете, важно поддержать себя правильным питанием.В такой период питание должно состоять из продуктов не разрушающих и ослабляющих ваш организм, а дающим силу и быстрое выздоровление.\n\nПравила питания, которые нам нужно соблюдать.\n\n✅ТЕПЛАЯ ВОДА.При боле в горле, температура всей  воды на программе(кроме медовой и чаев)  должны быть 35 - 40 С, чтобы дополнительно не повреждать раздраженную слизистую глотки.Если насморк и озноб, предпочтение отдаем горячему питью.Обильное питье позволяет не только увлажнить слизистые верхних дыхательных путей, но и уменьшить концентрацию токсинов.\n\n✅Не забываем использовать клетчатку так, как прописано на вашей ступени программы.Клетчатка является источником питания для полезных кишечных бактерий, которые будут поддерживать ваш иммунитет в процессы борьбы с простудой.\n\n✅К меню вашей ступени добавляем пустой куриный горячий бульон до 3 раз в день по 250 – 300 мл на время болезни.\n\n✅Лекарственные травы и чаи: зеленый  с мятой или липовым цветом, или душицей – потогонное средство.Выпиваем перед сном в любое время  и скорее в кровать.Также можно принимать ромашку для полоскания горла, если оно болит\n\n✅Приемы пищи от начала заболевания желательно держать в пределах 2, 5 -3 часа это позволит вам уйти от пищевого срыва после болезни, так как в первый день, а часто бывает и в течении нескольких суток начала болезни организм отказывается от пищи, есть совершенно не хочется, это естественная реакция организма: он ожесточенно отражает атаку вирусов, ему «некогда» отвлекаться на переваривание пищи." },
                // { "role": "system", "content": "Если женщина пишет о частом использовании слабительных препаратов, таких, как Бисакодил, Вазелиновое Вегапрат, Глицелакс, Глицериновые свечи, Гутталакс, Гуттасил, Динолак, Сена, Дюфалак и др., Ты должен вернуть, следующий текст: В случае стойких запоров не стоит отказываться и от мягких слабительных препаратов (если работа кишечника отсутствует более двух дней). \n\nМожно принять щадящий препарат Дюфалак. \n\nОднако пользоваться слабительными, каждый день, все же не стоит, чтобы избежать привыкания. \n\nНе нужно применять препараты на основе сены, они только усугубляют проблему, ведут к еще большей атонии кишечника и могут спровоцировать воспаление слизистой." },
            ]
        }

        if (contextParams.length > 0) {
            for (let i = 0; i < contextParams.length; i++) {

                chat.context.push({ role: 'user', content: 'Заготовка ' + i + ' :' + contextParams[i].content.replace("Первый параметр: ", '').replace("Второй параметр", "").split("конец первого параметра")[0] })

            }
        }

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
                    model: "gpt-3.5-turbo",
                    temperature: .1,
                    messages: [
                        { "role": "system", "content": "Поприветствуй пользователя, тебя зовут Адам. Ты в телеграмме, бот помощник диетолога. Ты будешь отвечать пользователям по моим заготовкам. Только по моим заготовкам. Ты не должен генерировать от себя текст." },
                    ],
                }).then(async (response) => {

                    if (response) {

                        if (response.data.choices[0].message?.content) {
                            await ctx.editMessageText(response.data.choices[0].message?.content, { parse_mode: 'HTML' })
                            ctx.wizard.selectStep(1)
                        }

                        console.log(response.data.choices[0].message)

                        // await ChatModel.findByIdAndUpdate(document?._id, {
                        // $push: {
                        // context: { "role": "system", "content": "Если пользователь задает вопрос 'у меня не уходят объемы', он под этим подразумевает объемы фигуры. Поэтому, ты категорически не должен генерировать свой ответ. Ты должен вернуть, следующий текст: Объемы лучше отслеживать по одежде, смотреть стала ли она вам большевата, или попробовать одеть то, что было мало и посмотреть, как вы сейчас себя чувствуете в этой одежде\n\nОчень часто, когда мы ориентируемся на измерительную ленту, мы можем не увидеть итоговый результат. Например, ленту расположили по-разному. На первом измерении выше на 1 см, а второй ниже. Давайте начнем отслеживать ваши объемы по одежде, хорошо?" },
                        // }
                        // })

                        // await ChatModel.findByIdAndUpdate(document?._id, {
                        // $push: {
                        // context: { "role": "system", "content": "Если пользователь задает вопрос 'Я заболеваю, что делать? (простуда, насморк, продуло, клиентка простыла или заболела во время программы)', Ты должен вернуть, следующий текст: Сейчас нам с вами нужно поддержать организм.\n\nВ момент, когда вы почувствовали слабость, кашель, дрожь во всем теле, насморк, головные боли, чувствуете, что заболеваете, важно поддержать себя правильным питанием.В такой период питание должно состоять из продуктов не разрушающих и ослабляющих ваш организм, а дающим силу и быстрое выздоровление.\n\nПравила питания, которые нам нужно соблюдать.\n\n✅ТЕПЛАЯ ВОДА.При боле в горле, температура всей  воды на программе(кроме медовой и чаев)  должны быть 35 - 40 С, чтобы дополнительно не повреждать раздраженную слизистую глотки.Если насморк и озноб, предпочтение отдаем горячему питью.Обильное питье позволяет не только увлажнить слизистые верхних дыхательных путей, но и уменьшить концентрацию токсинов.\n\n✅Не забываем использовать клетчатку так, как прописано на вашей ступени программы.Клетчатка является источником питания для полезных кишечных бактерий, которые будут поддерживать ваш иммунитет в процессы борьбы с простудой.\n\n✅К меню вашей ступени добавляем пустой куриный горячий бульон до 3 раз в день по 250 – 300 мл на время болезни.\n\n✅Лекарственные травы и чаи: зеленый  с мятой или липовым цветом, или душицей – потогонное средство.Выпиваем перед сном в любое время  и скорее в кровать.Также можно принимать ромашку для полоскания горла, если оно болит\n\n✅Приемы пищи от начала заболевания желательно держать в пределах 2, 5 -3 часа это позволит вам уйти от пищевого срыва после болезни, так как в первый день, а часто бывает и в течении нескольких суток начала болезни организм отказывается от пищи, есть совершенно не хочется, это естественная реакция организма: он ожесточенно отражает атаку вирусов, ему «некогда» отвлекаться на переваривание пищи." }
                        // }
                        // })

                        await ChatModel.findByIdAndUpdate(document?._id, {
                            $push: {
                                context: response.data.choices[0].message
                            }
                        })

                    }

                }).catch(async (error) => {
                    console.error(error.response.data)
                })

            })
        }

    } catch (error) {

        console.error(error)
        return await greeting(ctx)

    }

})

home.start(async (ctx: rlhubContext) => {

    try {

        let document: IUser | null = await User.findOne({
            id: ctx.from?.id
        })

        if (!document) {

            if (ctx.from) {

                await new User(ctx.from).save().catch(err => {
                    console.log(err)
                })

                await greeting(ctx)

            }

        } else {

            await greeting(ctx)

        }

    } catch (err) {
        console.log(err)
    }
});

async function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms))
}

home.enter(async (ctx) => { return await greeting(ctx) })

handler.on("message", async (ctx) => await greeting(ctx))

home.action(/\./, async (ctx) => {

    console.log(ctx)
    await greeting(ctx)

})
export default home