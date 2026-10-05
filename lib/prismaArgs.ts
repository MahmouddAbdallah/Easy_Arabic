import { db } from "@/prisma/db";
import { or } from "@prisma/orm-postgres/orm-client";


// ───────────────────────────────────────── Types ─────────────────────────────────────────

type OrmSchema = typeof db.orm.public;
type ModelName = keyof OrmSchema;
type RowOf<TModel extends ModelName> = OrmSchema[TModel] extends { all(): PromiseLike<(infer R)[]> } ? R : never;

/** Scalar column names of a model. Opt into strict field checking: `listUsers<ModelFields<"User">>({ filter: { … } })`. */
export type ModelFields<TModel extends ModelName> = Extract<keyof RowOf<TModel>, string>;

/** Values accepted by `where` / `cursor`: scalars, `null` (`eq` → IS NULL) and scalar-like objects (Date, Temporal.Instant, Decimal…). */
export type WhereValue = string | number | bigint | boolean | null | object;
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

    withCount?: boolean;
    cursor?: Partial<Record<TField, WhereValue>>;
};

export type PrismaArgsOptions = {
    hiddenFields?: readonly string[];
    defaultSelect?: readonly string[];
    maxLimit?: number;
};


export type PrismaArgsResult = {
    success?: boolean;
    data?: any;
    count?: any;
    hasMore?: boolean;
    error?: { code: string; message: string };
};

// ──────────────────────── Internals (the only place the ORM is loosely typed) ────────────────────────

type AnyExpr = Parameters<typeof or>[number];
type FieldRef = { [method: string]: ((arg?: unknown) => unknown) | undefined };
type Accessor = { [field: string]: FieldRef | undefined };

interface Query {
    where(fn: (model: Accessor) => unknown): Query;
    select(...fields: string[]): Query;
    include(relation: string, refine: (related: Query) => Query): Query;
    orderBy(items: ((model: Accessor) => unknown)[]): Query;
    cursor(values: Record<string, unknown>): Query;
    offset(n: number): Query;
    limit(n: number): Query;
    aggregate(fn: (agg: { count(): unknown }) => Record<string, unknown>): PromiseLike<{ count: number }>;
    all(): PromiseLike<unknown[]>;
}

const BUILT_IN_HIDDEN_FIELDS = ["password"];

const OPERATORS = new Set<string>(["eq", "gt", "gte", "lt", "lte", "ilike"]);

const USER_SAFE_SELECT = [
    "id", "name", "email", "phone", "role", "status", "subject",
    "emailVerifiedAt", "passwordLastChanged", "createdAt", "updatedAt",
];

const escapeLike = (text: string) => text.replace(/[\\%_]/g, "\\$&");

// ───────────────────────────────────────── Helper ─────────────────────────────────────────

export const prismaArgs = <TModel extends ModelName>(model: TModel, options: PrismaArgsOptions = {}) => {
    const hidden = new Set<string>([...BUILT_IN_HIDDEN_FIELDS, ...(options.hiddenFields ?? [])]);
    const isSafeField = (field: string) => !hidden.has(field);
    const assertSafeField = (field: string, use: string) => {
        if (!isSafeField(field)) throw new Error(`"${field}" is a hidden field and cannot be used to ${use}`);
    };
    const defaultSelect = options.defaultSelect ?? ((model as string) === "User" ? USER_SAFE_SELECT : undefined);

    return async <TField extends string = string>(args?: { filter?: GetRecordsFilter<TField> }): Promise<PrismaArgsResult> => {
        try {
            const filter = args?.filter;
            let filtered = db.orm.public[model] as unknown as Query;

            // 1. Basic where filters. Anything we can't apply throws: silently dropping a filter widens the result set.
            for (const { key, value, operator = "eq" } of filter?.where ?? []) {
                assertSafeField(key, "filter on");
                if (!OPERATORS.has(operator)) throw new Error(`Unsupported where operator "${operator}"`);
                filtered = filtered.where((fields) => {
                    const column = fields[key];
                    const apply = column?.[operator];
                    if (!apply) throw new Error(`Cannot apply "${operator}" to "${key}" (unknown field, or unsupported by its type)`);
                    return apply.call(column, value);
                });
            }

            // 2. Keyword search — part of the filter, so the COUNT below sees it too.
            const keyword = filter?.keyword == null ? "" : String(filter.keyword).trim();
            if (keyword && filter?.items?.length) {
                const pattern = `%${escapeLike(keyword)}%`;
                const searchFields = [...new Set(filter.items)].filter(isSafeField);
                filtered = filtered.where((accessor) => {
                    const conditions: unknown[] = [];
                    for (const field of searchFields) {
                        const column = accessor[field];
                        if (column && typeof column.ilike === "function") conditions.push(column.ilike(pattern)); // text columns only
                    }
                    if (!conditions.length) throw new Error("keyword search: none of `items` is a searchable text field");
                    return or(...(conditions as AnyExpr[]));
                });
            }

            // COUNT(*) over the filtered set only — never with pagination, select, include or cursor applied.
            const baseQuery = filtered;
            const countRows = async () => (await baseQuery.aggregate((agg) => ({ count: agg.count() }))).count;

            if (filter?.justCount) {
                return { count: await countRows() };
            }

            // 3. Page query: select, include, orderBy, cursor, offset, limit.
            const skip = filter?.skip;
            const limit = options.maxLimit === undefined ? filter?.limit : Math.min(filter?.limit ?? options.maxLimit, options.maxLimit);
            const wantCount = filter?.withCount !== false;
            const probeNextPage = !wantCount && limit !== undefined; // fetch one extra row to learn if more exist

            let page = baseQuery;

            const wanted = filter?.select?.filter(isSafeField);
            if (wanted?.length) page = page.select(...wanted);
            else if (defaultSelect) page = page.select(...defaultSelect);
            else if (filter?.select?.length) throw new Error("`select` only names hidden fields");

            if (filter?.include) {
                const relatedSelect = filter.include.select.filter(isSafeField);
                page = page.include(filter.include.value, (related) => related.select(...relatedSelect));
            }

            const sorts = Object.entries(filter?.orderBy ?? {}) as [string, "asc" | "desc" | undefined][];
            if (sorts.length) {
                page = page.orderBy(
                    sorts.map(([key, direction]) => {
                        assertSafeField(key, "sort by");
                        return (accessor: Accessor) => {
                            const column = accessor[key];
                            const order = direction === "asc" ? column?.asc : column?.desc;
                            if (!order) throw new Error(`Cannot sort by unknown field "${key}"`);
                            return order.call(column);
                        };
                    }),
                );
            }

            if (filter?.cursor) {
                // Without orderBy the ORM would ignore the cursor and return every row — refuse instead.
                if (!sorts.length) throw new Error("`cursor` requires `orderBy`");
                for (const key of Object.keys(filter.cursor)) assertSafeField(key, "paginate by");
                page = page.cursor(filter.cursor as Record<string, unknown>);
            }

            if (skip !== undefined) page = page.offset(skip);
            if (limit !== undefined) page = page.limit(probeNextPage ? limit + 1 : limit);

            const rows = await page.all();

            // 4a. No count requested.
            if (!wantCount) {
                if (!probeNextPage) return { success: true, data: rows };
                const hasMore = rows.length > limit;
                return { success: true, data: hasMore ? rows.slice(0, limit) : rows, hasMore };
            }

            // 4b. Count requested. The page proves the total when it isn't full (or there is no limit) and we know
            // where it started: total = skip + rows. Otherwise ask the database.
            const start = skip ?? 0;
            const totalKnown = !filter?.cursor && (limit === undefined || rows.length < limit) && (start === 0 || rows.length > 0);
            const count = totalKnown ? start + rows.length : await countRows();
            return { success: true, data: rows, count };
        } catch (error) {
            console.error("[prismaArgs] query failed:", error);
            return {
                success: false,
                error: { code: "SERVER_ERROR", message: "Error in server" },
            };
        }
    };
};