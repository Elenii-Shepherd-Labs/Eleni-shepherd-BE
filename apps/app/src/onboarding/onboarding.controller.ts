import {
  Post,
  Body,
  Controller,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Query,
  UseGuards,
  Req,
  Res,
  HttpCode,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { Express, Request, Response } from 'express';
import { TranscriptionService } from './transcription.service';
import { extname } from 'path';
import fs from 'fs';
import { OnboardingService } from './onboarding.service';
import { SaveNameAsTextDTO, SaveFullNameDto, UploadDto } from './dto';
import {
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';

@ApiTags('Onboarding')
@UseGuards(AuthGuard('google'))
@Controller('onboard')
export class OnboardingController {
  constructor(
    private readonly transcriptionService: TranscriptionService,
    private readonly onboardingService: OnboardingService,
  ) {}

  @Post('name')
  @HttpCode(201)
  @UseInterceptors(
    FileInterceptor('audio', {
      storage: diskStorage({
        destination: '/tmp',
        filename: (_, file, callback) => {
          const unique = `${Date.now()} - ${Math.random()
            .toString(36)
            .slice(2)}`;
          callback(null, unique + extname(file.originalname));
        },
      }),
      limits: {
        fileSize: 10 * 1024 * 1024, // 10mb
      },
      fileFilter: (_, file, callback) => {
        if (!file.mimetype.startsWith('audio/')) {
          return callback(
            new BadRequestException('Only audio files allowed'),
            false,
          );
        }
        callback(null, true);
      },
    }),
  )
  @ApiOperation({
    summary: 'Save user name from audio transcription',
    description: `
Upload an audio file containing the user's name, transcribe it, and save to profile.

This is part of the user onboarding flow. Typically called after Google authentication.

**Frontend Implementation**:
\`\`\`typescript
const handleSaveNameFromAudio = async (audioFile: File, nameType: string) => {
  const formData = new FormData();
  formData.append('audio', audioFile);

  const response = await fetch(\`http://localhost:3000/onboard/name?nameType=\${nameType}\`, {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  const result = await response.json();
  if (result.success) {
    console.log('Name saved:', result.data);
  }
};

// Usage
const nameType = 'firstName'; // or 'lastName', 'middleName', etc.
await handleSaveNameFromAudio(audioFile, nameType);
\`\`\`

**Supported Audio Formats**: MP3, WAV, WebM, MPEG, M4A

**Processing Steps**:
1. Receive audio file
2. Transcribe using OpenAI Whisper
3. Clean transcribed text (remove special characters)
4. Save to user profile under specified nameType
5. Delete temporary file

**Parameters** (Query):
- \`nameType\` (required): Which name field to save (firstName, lastName, middleName, etc.)

**Parameters** (Form Data):
- \`audio\` (required): Audio file (max 10 MB)

**Returns**:
- \`success\`: Whether save was successful
- \`data\`: Updated fullname object

**Limitations**:
- Max file size: 10 MB
- Audio must contain clear speech
- Names are auto-cleaned (alphanumeric only)
- Accents/diacritics removed

**Use Cases**:
- Voice-based name collection
- Onboarding flow
- Accessibility feature
- User profile setup
    `,
  })
  @ApiBody({
    type: UploadDto,
    description:
      'Audio file must be less than 10MB in one of the following formats: mp3, mp4, mpeg, mpga, m4a, wav, or webm',
  })
  @ApiConsumes('multipart/form-data')
  @ApiQuery({
    name: 'nameType',
    required: true,
    description: 'Name field to save (firstName, lastName, middleName, etc.)',
    example: 'firstName',
  })
  @ApiResponse({
    status: 201,
    description: 'Name has been successfully saved',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Name saved' },
        data: {
          type: 'object',
          properties: {
            firstName: { type: 'string', example: 'John' },
            lastName: { type: 'string', example: 'Doe' },
          },
        },
        status: { type: 'number', example: 201 },
      },
    },
  })
  @ApiResponse({
    status: 400,
    description: 'Audio file is required or invalid',
  })
  async saveNameAsText(
    @Req() req: Request,
    @Query() query: SaveNameAsTextDTO,
    @UploadedFile() audioFile: Express.Multer.File,
    @Res() res: Response,
  ) {
    if (!audioFile) {
      throw new BadRequestException('Audio file is required');
    }

    const text = await this.transcriptionService.transcribeFromFile(
      audioFile.path,
    );

    const cleanedName = text.replace(/[^a-zA-Z]/g, '');
    const userId = req.user['id'];
    const resp = await this.onboardingService.saveName(
      userId,
      cleanedName,
      query.nameType,
    );

    fs.unlink(audioFile.path, (err) => {
      if (err) console.error('could not unlink file');
    });

    return res.status(resp.status || 201).json(resp);
  }

  @Post('fullname')
  @HttpCode(201)
  @ApiOperation({
    summary: 'Save complete user name',
    description: `
Save the user's complete name information (first, last, middle names).

This endpoint accepts a JSON object with name fields and saves to the user's profile.

**Frontend Implementation**:
\`\`\`typescript
const handleSaveFullName = async (fullName: {
  firstName?: string;
  lastName?: string;
  middleName?: string;
}) => {
  const response = await fetch('http://localhost:3000/onboard/fullname', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(fullName),
    credentials: 'include',
  });

  const result = await response.json();
  if (result.success) {
    console.log('Profile updated:', result.data);
  }
};

// Usage
await handleSaveFullName({
  firstName: 'John',
  lastName: 'Doe',
  middleName: 'Michael',
});
\`\`\`

**Parameters** (Body - JSON):
Any combination of:
- \`firstName\` (string, optional)
- \`lastName\` (string, optional)
- \`middleName\` (string, optional)
- \`displayName\` (string, optional)
- Other name fields as needed

**Returns**:
- \`success\`: Whether save was successful
- \`data\`: Updated fullname object with all fields

**Validation**:
- Required fields enforced by Mongoose schema
- Name length limits (typically 50-100 chars)
- Special characters allowed (e.g., O'Brien, García)

**Use Cases**:
- Name input form submission
- Profile editing
- Bulk name updates
- Direct name entry (vs. voice)
- Support for various name formats

**Best Practices**:
\`\`\`typescript
// Don't send empty fields - backend ignores them
await handleSaveFullName({
  firstName: 'John',
  lastName: 'Doe',
  // Don't include: middleName: '' 
});

// Update only what changed
const updatedName = {
  firstName: currentFirstName, // might be unchanged
  lastName: newLastName, // this changed
};
await handleSaveFullName(updatedName);
\`\`\`
    `,
  })
  @ApiBody({
    type: SaveFullNameDto,
    description: 'User name information',
    examples: {
      example1: {
        value: {
          firstName: 'John',
          lastName: 'Doe',
          middleName: 'Michael',
        },
        description: 'Complete name',
      },
      example2: {
        value: {
          firstName: 'María',
          lastName: 'García Rodríguez',
        },
        description: 'Name with special characters',
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'The name has been successfully saved',
    schema: {
      properties: {
        success: { type: 'boolean', example: true },
        message: { type: 'string', example: 'Fullname saved' },
        data: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
            middleName: { type: 'string' },
          },
        },
        status: { type: 'number', example: 201 },
      },
    },
  })
  @ApiResponse({
    status: 404,
    description: 'User not found',
  })
  async saveFullname(
    @Req() req: Request,
    @Body() fullname: SaveFullNameDto,
    @Res() res: Response,
  ) {
    const userId = req.user['id'];
    const resp = await this.onboardingService.saveFullname(userId, fullname);
    return res.status(resp.status || 201).json(resp);
  }
}
