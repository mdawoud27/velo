// ai/ai.controller.ts
import { Controller, Post, Body, Query, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AiService } from './ai.service';
import { AiSuggestDto, AiSuggestionDto } from './dtos';
import { RequiresPlan } from 'src/auth/decorators';
import { ApiDataResponse, ApiErrorResponses, ResponseMessage } from 'src/common/decorators';
import { Plan } from '@prisma/client';

@ApiTags('AI')
@ApiBearerAuth()
@Controller('ai')
@RequiresPlan(Plan.PRO)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  // Sync
  @Post('suggest')
  @ResponseMessage('AI suggestion generated')
  @ApiOperation({ summary: 'Generate AI task suggestions (JSON response)' })
  @ApiDataResponse(AiSuggestionDto, 'AI suggestion')
  @ApiErrorResponses(400, 401, 402, 429)
  suggest(@Body() dto: AiSuggestDto) {
    return this.aiService.suggest(dto);
  }

  // Stream
  @Sse('suggest/stream')
  @ApiOperation({ summary: 'Generate AI task suggestions (SSE streaming)' })
  streamSuggest(@Query() dto: AiSuggestDto): Observable<MessageEvent> {
    return this.aiService.streamSuggest(dto);
  }
}
