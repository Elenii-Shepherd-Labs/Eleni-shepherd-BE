import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type ReminderDocument = Reminder & Document;

@Schema({ timestamps: true })
export class Reminder {
    @Prop({ required: true, type: String })
    userId: string;

    @Prop({ required: true, type: String })
    title: string;

    @Prop({
        required: true,
        type: String,
        enum: ['medication', 'appointment', 'other'],
        default: 'other',
    })
    type: string;

    @Prop({ required: true, type: String })
    time: string;

    @Prop({ type: String, default: '' })
    notes: string;

    @Prop({ type: Boolean, default: true })
    isActive: boolean;
}

export const ReminderSchema = SchemaFactory.createForClass(Reminder);
