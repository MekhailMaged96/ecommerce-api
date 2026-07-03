import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

class ProductCategoryEntity {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  slug: string;
}

export class ProductEntity {
  @ApiProperty()
  @Expose()
  id: string;

  @ApiProperty()
  @Expose()
  name: string;

  @ApiProperty()
  @Expose()
  slug: string;

  @ApiPropertyOptional()
  @Expose()
  description: string | null;

  @ApiProperty()
  @Expose()
  price: number;

  @ApiProperty()
  @Expose()
  stock: number;

  @ApiPropertyOptional()
  @Expose()
  imageUrl: string | null;

  @ApiProperty()
  @Expose()
  categoryId: string;

  @ApiPropertyOptional({ type: () => ProductCategoryEntity })
  @Expose()
  @Type(() => ProductCategoryEntity)
  category: ProductCategoryEntity;

  @ApiProperty()
  @Expose()
  createdAt: Date;

  @ApiProperty()
  @Expose()
  updatedAt: Date;
}
