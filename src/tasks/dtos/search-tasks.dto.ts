import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from 'src/common/dtos';

export class SearchTasksDto extends PaginationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  query: string;
}
