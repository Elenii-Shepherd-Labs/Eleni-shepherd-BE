import {
    Injectable,
    Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { Reminder, ReminderDocument } from './entities/reminder.schema';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { SymptomCheckDto } from './dto/symptom-check.dto';
import { LlmService } from '../llm/llm.service';
import { IAppResponse } from '@app/common/interfaces/response.interface';
import { createAppResponse } from '@app/common/utils/response';

@Injectable()
export class TelehealthService {
    private readonly logger = new Logger(TelehealthService.name);
    private readonly openai: OpenAI;

    constructor(
        @InjectModel(Reminder.name)
        private readonly reminderModel: Model<ReminderDocument>,
        private readonly configService: ConfigService,
        private readonly llmService: LlmService,
    ) {
        // Used for document analysis (Vision/multimodal) only.
        // All chat/text AI flows go through the shared LlmService.
        this.openai = new OpenAI({
            apiKey: this.configService.get<string>('OPENAI_API_KEY'),
        });
    }

    // ─────────────────── REMINDERS ───────────────────

    async createReminder(dto: CreateReminderDto): Promise<IAppResponse> {
        try {
            const reminder = await this.reminderModel.create(dto);
            this.logger.log(`Reminder created: ${reminder._id} for user ${dto.userId}`);
            return createAppResponse(true, 'Reminder created successfully', reminder, 201);
        } catch (error) {
            this.logger.error('Failed to create reminder', error);
            return createAppResponse(false, 'Failed to create reminder', null, 500);
        }
    }

    async getRemindersByUser(userId: string): Promise<IAppResponse> {
        try {
            const reminders = await this.reminderModel
                .find({ userId, isActive: true })
                .sort({ time: 1 })
                .exec();

            return createAppResponse(
                true,
                `Found ${reminders.length} reminder(s)`,
                reminders,
                200,
            );
        } catch (error) {
            this.logger.error(`Failed to fetch reminders for user ${userId}`, error);
            return createAppResponse(false, 'Failed to fetch reminders', null, 500);
        }
    }

    async getReminderById(id: string): Promise<IAppResponse> {
        try {
            const reminder = await this.reminderModel.findById(id).exec();
            if (!reminder) {
                return createAppResponse(false, `Reminder not found: ${id}`, null, 404);
            }
            return createAppResponse(true, 'Reminder retrieved', reminder, 200);
        } catch (error) {
            this.logger.error(`Failed to fetch reminder ${id}`, error);
            return createAppResponse(false, 'Failed to fetch reminder', null, 500);
        }
    }

    async updateReminder(id: string, dto: UpdateReminderDto): Promise<IAppResponse> {
        try {
            const reminder = await this.reminderModel
                .findByIdAndUpdate(id, { $set: dto }, { new: true })
                .exec();

            if (!reminder) {
                return createAppResponse(false, `Reminder not found: ${id}`, null, 404);
            }
            this.logger.log(`Reminder updated: ${id}`);
            return createAppResponse(true, 'Reminder updated successfully', reminder, 200);
        } catch (error) {
            this.logger.error(`Failed to update reminder ${id}`, error);
            return createAppResponse(false, 'Failed to update reminder', null, 500);
        }
    }

    async deleteReminder(id: string): Promise<IAppResponse> {
        try {
            const reminder = await this.reminderModel
                .findByIdAndUpdate(id, { $set: { isActive: false } }, { new: true })
                .exec();

            if (!reminder) {
                return createAppResponse(false, `Reminder not found: ${id}`, null, 404);
            }
            this.logger.log(`Reminder deleted (soft): ${id}`);
            return createAppResponse(true, 'Reminder deleted successfully', { id }, 200);
        } catch (error) {
            this.logger.error(`Failed to delete reminder ${id}`, error);
            return createAppResponse(false, 'Failed to delete reminder', null, 500);
        }
    }

    // ─────────────────── SYMPTOM CHECKER ───────────────────
    // Reuses the shared LlmService (supports OpenAI + Anthropic)
    // — same approach as ConversationalAI module.

    async checkSymptoms(dto: SymptomCheckDto): Promise<IAppResponse> {
        try {
            this.logger.log(`Symptom check requested: "${dto.symptoms.substring(0, 80)}..."`);

            const systemContext = `You are a compassionate AI Health Assistant for a telemedicine app called Eleni Shepherd, designed to help people with visual impairments. Your responses will be read aloud via text-to-speech, so speak naturally in clear sentences without markdown or bullet points.

When a user describes their symptoms:
1. Acknowledge their concern warmly and empathetically.
2. Briefly describe possible causes in simple language.
3. Give practical safe advice such as rest, hydration, or over-the-counter remedies.
4. Clearly state when they must see a doctor urgently.
5. Recommend appropriate next steps.

Always remind the user you are an AI assistant and not a replacement for professional medical advice.`;

            // Build messages array — same interface as ConversationalAI
            const messages = [
                {
                    role: 'user' as const,
                    content: `My symptoms: ${dto.symptoms}`,
                },
            ];

            const aiResp = await this.llmService.generateResponse(messages, systemContext);

            if (!aiResp.success) {
                return createAppResponse(false, 'Symptom check failed. Please try again.', null, 500);
            }

            const guidance = aiResp.data?.response ?? 'Unable to process symptoms at this time.';

            return createAppResponse(
                true,
                'Symptom check complete',
                {
                    guidance,
                    disclaimer:
                        'This is AI-generated guidance only and does not replace professional medical advice. Please consult a qualified doctor for diagnosis and treatment.',
                },
                200,
            );
        } catch (error) {
            this.logger.error('Symptom check failed', error);
            return createAppResponse(false, 'Symptom check failed. Please try again.', null, 500);
        }
    }

    // ─────────────────── DOCUMENT ANALYSIS ───────────────────
    // Uses OpenAI Vision (GPT-4o) directly — same pattern as ObstacleDetectionService.
    // This is a multimodal (image + text) call that the shared LlmService
    // does not currently support, so we call the Vision API directly.

    async analyzeDocument(file: Express.Multer.File): Promise<IAppResponse> {
        try {
            if (!file) {
                return createAppResponse(false, 'No image file provided', null, 400);
            }

            this.logger.log(`Analysing medical document: ${file.originalname} (${file.mimetype})`);

            const base64Image = file.buffer.toString('base64');
            const mimeType = file.mimetype as
                | 'image/jpeg'
                | 'image/png'
                | 'image/gif'
                | 'image/webp';

            const completion = await this.openai.chat.completions.create({
                model: 'gpt-4o',
                messages: [
                    {
                        role: 'user',
                        content: [
                            {
                                type: 'text',
                                text: `You are a medical document analyst for people with visual impairments. Analyse this medical document image and:
1. Identify what type of document it is (prescription, lab result, brochure, etc.)
2. Extract all readable text
3. Summarise the key medical information in simple jargon-free language
4. Highlight important dates, dosages, tests, or action items
5. Note anything requiring urgent attention

Format your response as plain readable text optimised for text-to-speech. Do not use markdown headers or bullet points. Speak in full sentences.`,
                            },
                            {
                                type: 'image_url',
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                    detail: 'high',
                                },
                            },
                        ],
                    },
                ],
                max_tokens: 1000,
            });

            const analysis =
                completion.choices[0]?.message?.content ?? 'Unable to analyse this document.';

            return createAppResponse(
                true,
                'Document analysed successfully',
                {
                    filename: file.originalname,
                    analysis,
                    disclaimer:
                        'This analysis is AI-generated. Always verify medical information with a qualified healthcare professional.',
                },
                200,
            );
        } catch (error) {
            this.logger.error('Document analysis failed', error);
            return createAppResponse(false, 'Document analysis failed. Please try again.', null, 500);
        }
    }
}
