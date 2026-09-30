import { db } from "@/prisma/db";
import { or } from "@prisma/orm-postgres/orm-client";


/**
 * Columns that must never leave the server through this generic query helper:
 * not selectable, not usable to filter/sort/search on (a `password ILIKE 'x%'`
 * filter would leak the hash one character at a time).
 */
const SENSITIVE_FIELDS = new Set(["password"]);
const isSafeField = (field: string) => !SENSITIVE_FIELDS.has(field);

// Everything on User except the password hash. Used when a caller doesn't say which columns it wants.
const USER_SAFE_SELECT = [
    "id", "name", "email", "phone", "role", "status", "subject",
    "emailVerifiedAt", "passwordLastChanged", "createdAt", "updatedAt",
];
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

export const prismaArgs = <TModel extends ModelName>(model: TModel) => {
    return async <TField extends string = string>(args?: { filter?: GetRecordsFilter<TField> }) => {
        try {
            const filter = args?.filter;
            let query: any = db.orm.public[model];

            // 1. Basic Where Filters
            if (filter?.where?.length) {
                for (const { key, value, operator = "eq" } of filter.where) {
                    query = query.where((r: any) => {
                        const field = r[key];
                        if (field && typeof field[operator] === "function") {
                            return field[operator](value);
                        }
                        return field?.eq ? field.eq(value) : undefined;
                    });
                }
            }

            // 2. Keyword Search (Moved before aggregate so count includes search)
            if (filter?.keyword && filter?.items?.length) {
                query = query.where((u: any) => {
                    const validConditions = filter.items!
                        .filter((item) => u[item] && typeof u[item].ilike === "function")
                        .map((item) => u[item].ilike(`%${filter.keyword}%`));

                    return validConditions.length > 0 ? or(...validConditions) : undefined;
                });
            }

            // 3. Aggregate / Total Count Calculation
            const { count } = await query.aggregate((a: any) => ({ count: a.count() }));

            if (filter?.justCount) {
                return { count };
            }

            // 4. Pagination, Select, Include, OrderBy
            if (filter?.skip !== undefined) {
                query = query.offset(filter.skip);
            }
            if (filter?.limit !== undefined) {
                query = query.limit(filter.limit);
            }
            const safeSelect = filter?.select?.filter(isSafeField);
            if (safeSelect?.length) {
                query = query.select(...safeSelect as any);
            } else if (model === "User") {
                query = query.select(...USER_SAFE_SELECT as any);
            }
            if (filter?.include) {
                query = query.include(
                    filter.include.value,
                    (ele: any) => ele.select(...(filter.include?.select as any))
                );
            }
            if (filter?.orderBy) {
                const entries = Object.entries(filter.orderBy) as [TField, "asc" | "desc"][];
                for (const [key, order] of entries) {
                    query =
                        order === "asc"
                            ? query.orderBy((r: any) => r[key]?.asc?.())
                            : query.orderBy((r: any) => r[key]?.desc?.());
                }
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