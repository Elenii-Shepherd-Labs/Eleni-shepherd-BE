import {
    Controller,
    Post,
    Get,
    Patch,
    Delete,
    Body,
    Param,
    Res,
    UseInterceptors,
    UploadedFile,
    BadRequestException,
    HttpCode,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
    ApiTags,
    ApiOperation,
    ApiResponse,
    ApiBody,
    ApiParam,
    ApiConsumes,
} from '@nestjs/swagger';
import { Response } from 'express';
import { TelehealthService } from './telehealth.service';
import { CreateReminderDto } from './dto/create-reminder.dto';
import { UpdateReminderDto } from './dto/update-reminder.dto';
import { SymptomCheckDto } from './dto/symptom-check.dto';

@ApiTags('Telehealth')
@Controller('telehealth')
export class TelehealthController {
    constructor(private readonly telehealthService: TelehealthService) { }

    // ═══════════════════════════════════════════════
    //                  REMINDERS
    // ═══════════════════════════════════════════════

    @Post('reminders')
    @HttpCode(201)
    @ApiOperation({
        summary: 'Create a health reminder',
        description: `
Create a new daily health reminder for a user (medication, appointment, or general).
This powers the **Daily Reminders** section of the Health Assistant screen.

**Reminder Types**:
- \`medication\` — e.g. "Malaria Prophylaxis at 14:00"
- \`appointment\` — e.g. "General Hospital Visit at 16:00"
- \`other\` — free-form reminders

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/telehealth/reminders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-123',
    title: 'Malaria Prophylaxis',
    type: 'medication',
    time: '14:00',
    notes: 'Take with food',
  }),
  credentials: 'include',
});
const result = await response.json();
// result.data._id → use as reminder ID for future updates/deletes
\`\`\`
    `,
    })
    @ApiBody({
        type: CreateReminderDto,
        description: 'Reminder details',
        examples: {
            medication: {
                value: {
                    userId: 'user-123',
                    title: 'Malaria Prophylaxis',
                    type: 'medication',
                    time: '14:00',
                    notes: 'Take with food',
                },
                description: 'Medication reminder',
            },
            appointment: {
                value: {
                    userId: 'user-123',
                    title: 'General Hospital Visit',
                    type: 'appointment',
                    time: '16:00',
                },
                description: 'Hospital appointment reminder',
            },
            voice: {
                value: {
                    userId: 'user-123',
                    title: 'for my drugs by 12:30 p.m.',
                    type: 'medication',
                    time: '12:30',
                },
                description: 'Voice-added reminder (raw transcript)',
            },
        },
    })
    @ApiResponse({
        status: 201,
        description: 'Reminder created successfully',
        schema: {
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Reminder created successfully' },
                data: {
                    type: 'object',
                    properties: {
                        _id: { type: 'string', example: '65f1a2b3c4d5e6f7a8b9c0d1' },
                        userId: { type: 'string', example: 'user-123' },
                        title: { type: 'string', example: 'Malaria Prophylaxis' },
                        type: { type: 'string', example: 'medication' },
                        time: { type: 'string', example: '14:00' },
                        notes: { type: 'string', example: 'Take with food' },
                        isActive: { type: 'boolean', example: true },
                        createdAt: { type: 'string', format: 'date-time' },
                    },
                },
                status: { type: 'number', example: 201 },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Invalid input data' })
    async createReminder(
        @Body() createReminderDto: CreateReminderDto,
        @Res() res: Response,
    ) {
        const resp = await this.telehealthService.createReminder(createReminderDto);
        return res.status(resp.status || 201).json(resp);
    }

    @Get('reminders/:userId')
    @ApiOperation({
        summary: 'Get all reminders for a user',
        description: `
Retrieve all active health reminders for a specific user, sorted by time ascending.
This populates the **Daily Reminders** list on the Health Assistant screen.

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/telehealth/reminders/\${userId}\`, {
  credentials: 'include',
});
const result = await response.json();
// result.data → array of reminder objects sorted by time
result.data.forEach(reminder => {
  console.log(\`\${reminder.title} at \${reminder.time}\`);
});
\`\`\`
    `,
    })
    @ApiParam({
        name: 'userId',
        description: 'The user ID to fetch reminders for',
        type: 'string',
        example: 'user-123',
    })
    @ApiResponse({
        status: 200,
        description: 'Reminders retrieved successfully',
        schema: {
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Found 3 reminder(s)' },
                data: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            _id: { type: 'string' },
                            userId: { type: 'string' },
                            title: { type: 'string' },
                            type: { type: 'string', enum: ['medication', 'appointment', 'other'] },
                            time: { type: 'string', example: '14:00' },
                            notes: { type: 'string' },
                            isActive: { type: 'boolean' },
                            createdAt: { type: 'string', format: 'date-time' },
                        },
                    },
                },
                status: { type: 'number', example: 200 },
            },
        },
    })
    async getRemindersByUser(
        @Param('userId') userId: string,
        @Res() res: Response,
    ) {
        const resp = await this.telehealthService.getRemindersByUser(userId);
        return res.status(resp.status || 200).json(resp);
    }

    @Get('reminders/detail/:id')
    @ApiOperation({
        summary: 'Get a single reminder by ID',
        description: `
Retrieve a specific reminder by its MongoDB ObjectId.

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/telehealth/reminders/detail/\${reminderId}\`, {
  credentials: 'include',
});
const result = await response.json();
\`\`\`
    `,
    })
    @ApiParam({
        name: 'id',
        description: 'MongoDB ObjectId of the reminder',
        type: 'string',
        example: '65f1a2b3c4d5e6f7a8b9c0d1',
    })
    @ApiResponse({
        status: 200,
        description: 'Reminder found',
    })
    @ApiResponse({
        status: 404,
        description: 'Reminder not found',
    })
    async getReminderById(@Param('id') id: string, @Res() res: Response) {
        const resp = await this.telehealthService.getReminderById(id);
        return res.status(resp.status || 200).json(resp);
    }

    @Patch('reminders/:id')
    @ApiOperation({
        summary: 'Update a reminder',
        description: `
Update any field of an existing reminder. Only the fields you provide will be changed.

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/telehealth/reminders/\${reminderId}\`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ time: '15:30' }), // only update the time
  credentials: 'include',
});
const result = await response.json();
\`\`\`
    `,
    })
    @ApiParam({
        name: 'id',
        description: 'MongoDB ObjectId of the reminder',
        type: 'string',
        example: '65f1a2b3c4d5e6f7a8b9c0d1',
    })
    @ApiBody({
        type: UpdateReminderDto,
        description: 'Fields to update (all optional)',
        examples: {
            updateTime: {
                value: { time: '15:30' },
                description: 'Change reminder time',
            },
            updateTitle: {
                value: { title: 'Evening Malaria Tablets', notes: 'After dinner' },
                description: 'Update title and notes',
            },
        },
    })
    @ApiResponse({ status: 200, description: 'Reminder updated successfully' })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    async updateReminder(
        @Param('id') id: string,
        @Body() updateReminderDto: UpdateReminderDto,
        @Res() res: Response,
    ) {
        const resp = await this.telehealthService.updateReminder(id, updateReminderDto);
        return res.status(resp.status || 200).json(resp);
    }

    @Delete('reminders/:id')
    @ApiOperation({
        summary: 'Delete a reminder',
        description: `
Soft-delete a reminder (sets \`isActive: false\`). The record is preserved in the database.
This is called when the user taps the 🗑️ **trash icon** next to a reminder in the app.

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch(\`http://localhost:3000/telehealth/reminders/\${reminderId}\`, {
  method: 'DELETE',
  credentials: 'include',
});
const result = await response.json();
if (result.success) {
  // Remove the reminder card from the UI list
}
\`\`\`
    `,
    })
    @ApiParam({
        name: 'id',
        description: 'MongoDB ObjectId of the reminder to delete',
        type: 'string',
        example: '65f1a2b3c4d5e6f7a8b9c0d1',
    })
    @ApiResponse({ status: 200, description: 'Reminder deleted successfully' })
    @ApiResponse({ status: 404, description: 'Reminder not found' })
    async deleteReminder(@Param('id') id: string, @Res() res: Response) {
        const resp = await this.telehealthService.deleteReminder(id);
        return res.status(resp.status || 200).json(resp);
    }

    // ═══════════════════════════════════════════════
    //             SYMPTOM CHECKER
    // ═══════════════════════════════════════════════

    @Post('symptom-check')
    @ApiOperation({
        summary: 'AI-powered symptom checker',
        description: `
Submit a text description of symptoms and receive AI-generated health guidance.
Powers the **Symptom Checker** card on the Health Assistant screen.

The AI:
- Identifies possible causes
- Provides safe, practical advice
- Flags red-flag symptoms that require urgent medical attention
- Recommends next steps

**Frontend Implementation**:
\`\`\`typescript
const response = await fetch('http://localhost:3000/telehealth/symptom-check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    symptoms: 'I have had a headache and fever for 3 days with mild chest pain.',
    userId: 'user-123',
  }),
  credentials: 'include',
});
const result = await response.json();

// Pass the guidance text to TTS for audio playback
console.log('AI Guidance:', result.data.guidance);
\`\`\`

**Important**: The \`guidance\` field is designed to be read aloud via the Text-to-Speech
endpoint for visually impaired users.
    `,
    })
    @ApiBody({
        type: SymptomCheckDto,
        description: 'Symptoms description (transcribed from voice or typed)',
        examples: {
            fever: {
                value: {
                    symptoms: 'I have had a headache and fever for 3 days with mild chest pain.',
                    userId: 'user-123',
                },
                description: 'Fever with headache',
            },
            malaria: {
                value: {
                    symptoms: 'I feel cold, shivering badly, and had vomiting since yesterday.',
                    userId: 'user-456',
                },
                description: 'Possible malaria symptoms',
            },
            routine: {
                value: {
                    symptoms:
                        'I have a mild cough and runny nose for 2 days but no fever.',
                },
                description: 'Cold/flu symptoms (no userId)',
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'AI symptom guidance generated successfully',
        schema: {
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Symptom check complete' },
                data: {
                    type: 'object',
                    properties: {
                        guidance: {
                            type: 'string',
                            description: 'AI-generated health guidance — safe to pass to TTS',
                            example:
                                'Thank you for sharing. A headache with fever lasting 3 days combined with chest pain warrants urgent medical attention. Please visit a hospital or call emergency services immediately...',
                        },
                        disclaimer: {
                            type: 'string',
                            example:
                                'This is AI-generated guidance only and does not replace professional medical advice.',
                        },
                    },
                },
                status: { type: 'number', example: 200 },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'Missing required symptoms field' })
    @ApiResponse({ status: 500, description: 'AI service unavailable' })
    async checkSymptoms(
        @Body() symptomCheckDto: SymptomCheckDto,
        @Res() res: Response,
    ) {
        const resp = await this.telehealthService.checkSymptoms(symptomCheckDto);
        return res.status(resp.status || 200).json(resp);
    }

    // ═══════════════════════════════════════════════
    //           DOCUMENT / OCR ANALYSIS
    // ═══════════════════════════════════════════════

    @Post('analyze-document')
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(
        FileInterceptor('document', {
            storage: memoryStorage(),
            limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
            fileFilter: (_, file, callback) => {
                const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];
                if (!allowed.includes(file.mimetype)) {
                    return callback(
                        new BadRequestException(
                            'Only image files are allowed (JPEG, PNG, WebP, GIF)',
                        ),
                        false,
                    );
                }
                callback(null, true);
            },
        }),
    )
    @ApiOperation({
        summary: 'Analyse a medical document image (OCR + AI)',
        description: `
Upload an image of a medical document (prescription, lab result, hospital brochure, etc.).
The AI will extract all text via OCR and summarise the key medical information in plain language.

This powers the **Document Analysis** camera feature on the Health Assistant screen.

**Supported Formats**: JPEG, JPG, PNG, WebP, GIF (max 10 MB)

**Frontend — React Native (Expo) Example**:
\`\`\`typescript
import * as ImagePicker from 'expo-image-picker';

const analyseDocument = async () => {
  const result = await ImagePicker.launchCameraAsync({ base64: false });
  if (!result.canceled) {
    const formData = new FormData();
    formData.append('document', {
      uri: result.assets[0].uri,
      name: 'document.jpg',
      type: 'image/jpeg',
    } as any);

    const response = await fetch('http://localhost:3000/telehealth/analyze-document', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
    const data = await response.json();
    console.log('Analysis:', data.data.analysis);
  }
};
\`\`\`

**Returns**:
- \`filename\`: Original filename
- \`analysis\`: Full AI analysis including document type, extracted text, summary, and key points
- \`disclaimer\`: Medical accuracy disclaimer
    `,
    })
    @ApiBody({
        description: 'Medical document image file',
        schema: {
            type: 'object',
            required: ['document'],
            properties: {
                document: {
                    type: 'string',
                    format: 'binary',
                    description: 'Image file of the medical document (max 10 MB)',
                },
            },
        },
    })
    @ApiResponse({
        status: 200,
        description: 'Document analysed successfully',
        schema: {
            properties: {
                success: { type: 'boolean', example: true },
                message: { type: 'string', example: 'Document analysed successfully' },
                data: {
                    type: 'object',
                    properties: {
                        filename: {
                            type: 'string',
                            example: 'liver-cancer-screening.jpg',
                        },
                        analysis: {
                            type: 'string',
                            description: 'Full AI analysis of the document',
                            example:
                                '**Document Type**: Hospital Brochure\n**Extracted Text**: Liver Cancer Screening...\n**Summary**: This document describes ...\n**Key Points**: ...\n**Important Actions**: ...',
                        },
                        disclaimer: {
                            type: 'string',
                            example:
                                'This analysis is AI-generated. Always verify medical information with a qualified healthcare professional.',
                        },
                    },
                },
                status: { type: 'number', example: 200 },
            },
        },
    })
    @ApiResponse({ status: 400, description: 'No image provided or invalid file type' })
    @ApiResponse({ status: 500, description: 'AI analysis service failed' })
    async analyzeDocument(
        @UploadedFile() file: Express.Multer.File,
        @Res() res: Response,
    ) {
        if (!file) {
            throw new BadRequestException('A document image file is required (field name: "document")');
        }
        const resp = await this.telehealthService.analyzeDocument(file);
        return res.status(resp.status || 200).json(resp);
    }
}
