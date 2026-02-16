import { ApiProperty } from '@nestjs/swagger';

/**
 * Standard API Response DTO
 *
 * All API responses follow this schema. The `data` field contains the actual response payload.
 * Frontend developers should always check the `success` field to determine request outcome.
 *
 * @example
 * ```json
 * {
 *   "success": true,
 *   "message": "Operation completed successfully",
 *   "data": { ... },
 *   "status": 200
 * }
 * ```
 */
export class AppResponseDto {
  @ApiProperty({
    description: 'Indicates whether the request was successful',
    example: true,
    type: Boolean,
  })
  success: boolean;

  @ApiProperty({
    description: 'Human-readable message describing the response',
    example: 'Operation completed successfully',
    type: String,
  })
  message: string;

  @ApiProperty({
    description: 'Response payload. Type varies by endpoint.',
    example: null,
    nullable: true,
  })
  data?: any;

  @ApiProperty({
    description: 'HTTP status code of the response',
    example: 200,
    type: Number,
  })
  status?: number;
}

/**
 * Error Response DTO
 *
 * Represents error responses. All error responses have `success: false`.
 *
 * @example
 * ```json
 * {
 *   "success": false,
 *   "message": "Invalid input parameter",
 *   "data": null,
 *   "status": 400
 * }
 * ```
 */
export class ErrorResponseDto extends AppResponseDto {
  @ApiProperty({
    description: 'Always false for error responses',
    example: false,
  })
  success: false;

  @ApiProperty({
    description: 'Error message explaining what went wrong',
    example: 'Invalid input parameter',
  })
  message: string;
}

/**
 * Pagination Metadata DTO
 *
 * Used for endpoints that return paginated results.
 */
export class PaginationDto {
  @ApiProperty({
    description: 'Current page number',
    example: 1,
  })
  page: number;

  @ApiProperty({
    description: 'Number of items per page',
    example: 20,
  })
  limit: number;

  @ApiProperty({
    description: 'Total number of items',
    example: 150,
  })
  total: number;

  @ApiProperty({
    description: 'Total number of pages',
    example: 8,
  })
  pages: number;
}
