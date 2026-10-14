import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groupByDay } from "./dateSeparators";
import { formatListTime } from "./listTime";
import type { MessageType } from "../types";

const at = (y: number, m: number, d: number, h = 12, min = 0, s = 0) => new Date(y, m - 1, d, h, min, s);

function message(id: string, senderId: string, sentAt: Date | null, extra: Partial<MessageType> = {}): MessageType {
    return { id, senderId, sentAt, text: id, call: undefined, ...extra } as unknown as MessageType;
}

const today = at(2026, 10, 14, 15);

describe("groupByDay", () => {
    it("makes one section per calendar day, in order", () => {
        const sections = groupByDay(
            [message("a", "x", at(2026, 10, 12, 9)), message("b", "x", at(2026, 10, 13, 9)), message("c", "x", at(2026, 10, 13, 20)), message("d", "x", at(2026, 10, 14, 8))],
            today
        );
        assert.deepEqual(sections.map((s) => s.rows.map((r) => r.message.id)), [["a"], ["b", "c"], ["d"]]);
        assert.equal(sections[1].label, "Yesterday");
        assert.equal(sections[2].label, "Today");
        assert.equal(new Set(sections.map((s) => s.key)).size, 3);
    });

    it("joins messages of one person sent minutes apart, and only those", () => {
        const [section] = groupByDay(
            [
                message("a", "x", at(2026, 10, 14, 9, 0, 0)),
                message("b", "x", at(2026, 10, 14, 9, 2, 0)), // joins a
                message("c", "y", at(2026, 10, 14, 9, 3, 0)), // other person
                message("d", "y", at(2026, 10, 14, 9, 9, 0)), // same person but 6 minutes later
            ],
            today
        );
        assert.deepEqual(section.rows.map((r) => r.joinsPrevious), [false, true, false, false]);
    });

    it("never joins across a call entry or a day", () => {
        const sections = groupByDay(
            [
                message("a", "x", at(2026, 10, 13, 23, 59)),
                message("b", "x", at(2026, 10, 14, 0, 1)), // next day: its own section, nothing to join
                message("call", "x", at(2026, 10, 14, 0, 2), { call: { callId: "c" } as never }),
                message("c", "x", at(2026, 10, 14, 0, 3)),
            ],
            today
        );
        assert.equal(sections.length, 2);
        assert.deepEqual(sections[1].rows.map((r) => r.joinsPrevious), [false, false, false]);
    });

    it("keeps a message without a readable time in the section it follows", () => {
        const sections = groupByDay([message("a", "x", at(2026, 10, 14, 9)), message("b", "x", null), message("c", "x", at(2026, 10, 14, 10))], today);
        assert.equal(sections.length, 1);
        assert.equal(sections[0].rows.length, 3);
    });

    it("never repeats a day when the clock of one message is out of order", () => {
        const sections = groupByDay(
            [message("a", "x", at(2026, 10, 13, 9)), message("b", "x", at(2026, 10, 14, 9)), message("c", "x", at(2026, 10, 13, 23))],
            today
        );
        assert.equal(new Set(sections.map((s) => s.key)).size, sections.length);
    });
});

describe("formatListTime", () => {
    it("says what a conversation list should say", () => {
        assert.match(formatListTime(at(2026, 10, 14, 9, 5), today), /9:05/);
        assert.equal(formatListTime(at(2026, 10, 13, 23, 0), today), "Yesterday");
        assert.ok(formatListTime(at(2026, 10, 10, 12), today).length > 0 && !/\d{4}/.test(formatListTime(at(2026, 10, 10, 12), today)));
        assert.match(formatListTime(at(2026, 3, 2, 12), today), /Mar/);
        assert.match(formatListTime(at(2025, 3, 2, 12), today), /2025/);
        assert.equal(formatListTime(new Date("nope"), today), "");
    });
});
