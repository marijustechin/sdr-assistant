import { Injectable, NotFoundException } from '@nestjs/common'

import { PrismaService } from '../prisma/prisma.service.js'
import type { CreateProductDto } from './dto/create-product.dto.js'

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateProductDto) {
    return this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description ?? '',
      },
    })
  }

  findAll() {
    return this.prisma.product.findMany({
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const product = await this.prisma.product.findUnique({ where: { id } })

    if (!product) {
      throw new NotFoundException(`Product ${id} not found`)
    }

    return product
  }
}
