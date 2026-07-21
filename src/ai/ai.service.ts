import { Injectable, BadGatewayException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';
import Groq from 'groq-sdk';
import { AiSuggestDto, AiSuggestionDto } from './dtos';
import { PROMPTS } from './constants';

@Injectable()
export class AiService {
  private readonly groq: Groq;
  private readonly logger = new Logger(AiService.name);
  private readonly model = 'llama-3.1-8b-instant';

  constructor(private readonly config: ConfigService) {
    this.groq = new Groq({
      apiKey: config.getOrThrow('GROQ_API_KEY'),
    });
  }

  // Sync JSON response
  async suggest(dto: AiSuggestDto): Promise<AiSuggestionDto> {
    const systemPrompt = PROMPTS[dto.mode ?? 'task_breakdown'];

    let completion: Awaited<ReturnType<typeof this.groq.chat.completions.create>>;

    try {
      completion = await this.groq.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: dto.context },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.4, // lower = more consistent JSON structure
        max_tokens: 1024,
      });
    } catch (err) {
      this.logger.error('Groq API error (sync)', err);
      throw new BadGatewayException('AI service is temporarily unavailable');
    }

    const raw = completion.choices[0]?.message?.content;
    if (!raw) {
      throw new BadGatewayException('AI returned an empty response');
    }

    try {
      return JSON.parse(raw) as AiSuggestionDto;
    } catch {
      this.logger.error(`AI returned invalid JSON: ${raw.slice(0, 200)}`);
      throw new BadGatewayException('AI returned an unparseable response');
    }
  }

  // SSE streaming response
  streamSuggest(dto: AiSuggestDto): Observable<MessageEvent> {
    const systemPrompt = PROMPTS[dto.mode ?? 'task_breakdown'];

    return new Observable((subscriber) => {
      let aborted = false;

      void (async () => {
        let stream: Awaited<ReturnType<typeof this.groq.chat.completions.create>>;

        try {
          stream = await this.groq.chat.completions.create({
            model: this.model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: dto.context },
            ],
            stream: true,
            temperature: 0.4,
            max_tokens: 1024,
          });
        } catch (err) {
          this.logger.error('Groq API error (stream init)', err);
          subscriber.error(new BadGatewayException('AI service is temporarily unavailable'));
          return;
        }

        try {
          for await (const chunk of stream) {
            if (aborted) break;

            const content = chunk.choices[0]?.delta?.content ?? '';
            if (content) {
              subscriber.next({ data: content } as MessageEvent);
            }

            // Signal completion via a structured done event
            if (chunk.choices[0]?.finish_reason === 'stop') {
              subscriber.next({ data: '[DONE]' } as MessageEvent);
            }
          }
          subscriber.complete();
        } catch (err) {
          this.logger.error('Groq stream error', err);
          subscriber.error(new BadGatewayException('AI stream interrupted'));
        }
      })();

      // Cleanup when the client disconnects mid-stream
      return () => {
        aborted = true;
      };
    });
  }
}
