import mongoose, { Schema, model, ObjectId, Date, Document } from "mongoose";

interface IChat {
    _id?: ObjectId,
    user_id: ObjectId,
    name?: string,
    context?: {
        role: string,
        content?: string,
        step?: number,
        finish_reason?: any
    }[]
}

const ChatModel = mongoose.model<IChat>('Chat', new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, required: true, unique: false },
    name: { type: String, required: false, unique: false },
    context: [{
        role: String,
        content: String,
        step: { type: Number, required: false },
        finish_reason: { type: Boolean || String, required: false },
        _id: false
    }]
}));

const contextSchema = new mongoose.Schema({
    role: String,
    content: String,
    step: { type: Number, required: false },
    finish_reason: { type: Boolean, required: false },
});

const firstParamSchema = new mongoose.Schema({
    content: String,
    step: { type: Number, required: false },
    finish_reason: { type: Boolean, required: false },
});

const ContextModel = mongoose.model('Context', contextSchema);
const FirstParamModel = mongoose.model('FirstParam', contextSchema);

export { ChatModel, IChat, ContextModel, FirstParamModel }
