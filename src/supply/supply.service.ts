import z from 'zod';
import { Injectable } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { CreateSupplySchema, UpdateSupplySchema } from './types';

// Workaround for Prisma limitation when serializing BigInts.
// See: https://www.prisma.io/docs/orm/prisma-client/special-fields-and-types#serializing-bigint
const serializeBigIntProperties = (param: any): any => {
  for (const k in param) {
    if (typeof param[k] === "bigint") {
      param[k] = param[k].toString();
    }
  }
  return param;
};

@Injectable()
export class SupplyService {
  constructor(private readonly prismaService: PrismaService) {}

  async store(body: z.infer<typeof CreateSupplySchema>) {
    const payload = CreateSupplySchema.parse(body);
    return await this.prismaService.supply.create({
      data: {
        ...payload,
        createdAt: new Date().toISOString(),
      },
    });
  }

  async update(id: string, body: z.infer<typeof UpdateSupplySchema>) {
    const payload = UpdateSupplySchema.parse(body);
    await this.prismaService.supply.update({
      where: {
        id,
      },
      data: {
        ...payload,
        updatedAt: new Date().toISOString(),
      },
    });
  }

  async index() {
    const data = await this.prismaService.supply.findMany({
      distinct: ['name', 'supplyCategoryId'],
      orderBy: {
        name: 'desc',
      },
      select: {
        id: true,
        name: true,
        supplyCategory: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
        updatedAt: true,
      },
    });

    return data;
  }

  async most_needed() {
    const result: any = await this.prismaService.$queryRaw`
      SELECT
        /*ss.supply_id,*/
        s.name,
        COUNT(*) as supply_count,
        MAX(ss.priority) as priority,
        /*MAX(s.created_at) as created_at,*/
        MAX(s.updated_at) as updated_at
      FROM supplies as s
      INNER JOIN shelter_supplies as ss on (ss.supply_id = s.id)
      GROUP BY s.name
      ORDER BY supply_count desc, MAX(ss.updated_at) desc
      LIMIT /* param limit */ 100
    `;
    const data = result.map(serializeBigIntProperties);

    return result;
  }
}
