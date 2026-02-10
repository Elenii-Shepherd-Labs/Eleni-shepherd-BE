import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ _id: false })
export class FullName {
  @Prop()
  firstname?: string;

  @Prop()
  lastname?: string;
}
@Schema()
export class User extends Document {
  @Prop({ required: true })
  username: string;

  @Prop({ type: FullName })
  fullname?: FullName;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  googleId: string;
}

export const UserSchema = SchemaFactory.createForClass(User);
