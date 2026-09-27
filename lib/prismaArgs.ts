import { db } from "@/prisma/db";
import { or } from "@prisma/orm-postgres/orm-client";

type OrmSchema = typeof db.orm.public;
type ModelName = keyof OrmSchema;

type WhereValue = string | number | boolean;
export type WhereOperator = "eq" | "gt" | "gte" | "lt" | "lte" | "ilike";

export type GetRecordsFilter<TField extends string = string> = {
    skip?: number;
    where?: {
        key: TField;
        value: WhereValue;
        operator?: WhereOperator;
    }[];
    include?: { value: string; select: string[] };
    limit?: number;
    select?: string[];
    keyword?: string;
    items?: string[];
    justCount?: boolean;
    orderBy?: Partial<Record<TField, "asc" | "desc">>;
};

export const prismaArgs = <TModel extends ModelName>(
    model: TModel
) => {
    return async <TField extends string = string>(args?: { filter?: GetRecordsFilter<TField> }) => {
        try {
            const filter = args?.filter;
            let query: any = db.orm.public[model];

            if (filter?.where?.length) {
                for (const { key, value, operator = "eq" } of filter.where) {
                    query = query.where((r: any) => {
                        const field = r[key];
                        if (field && typeof field[operator] === "function") {
                            return field[operator](value);
                        }
                        return field.eq(value);
                    });
                }
            }

            const { count } = await query.aggregate((a: any) => ({ count: a.count() }));

            if (filter?.justCount) {
                return { count };
            }

            if (filter?.skip !== undefined) {
                query = query.offset(filter.skip);
            }
            if (filter?.limit !== undefined) {
                query = query.limit(filter.limit);
            }
            if (filter?.select) {
                query = query.select(...filter.select as any);
            }
            if (filter?.include) {
                query = query.include(filter.include.value,
                    (ele: any) => ele.select(...filter.include?.select as any));
            }
            if (filter?.orderBy) {
                const entries = Object.entries(filter.orderBy) as [
                    TField,
                    "asc" | "desc"
                ][];
                for (const [key, order] of entries) {
                    query =
                        order === "asc"
                            ? query.orderBy((r: any) => r[key].asc())
                            : query.orderBy((r: any) => r[key].desc());
                }
            }
            if (filter?.keyword && filter?.items) {
                query = query.where((u: any) =>
                    or(...(filter.items as any).map((item: any) => (
                        u[item].ilike(`%${filter.keyword}%`)
                    ))));
            }

            return { success: true, data: await query.all(), count };
        } catch (error) {
            console.error("[prismaArgs] query failed:", error);
            return {
                success: false,
                error: { code: "SERVER_ERROR", message: "Error in server" },
            };
        }
    };
};