import { describe, expect, it } from "vitest";
import { cardIdFrom, parseCreateCardInput } from "./route-input";

describe("parseCreateCardInput", () => {
  it("trims required values and keeps the description", () => {
    expect(parseCreateCardInput({ listId: " list-1 ", name: " Test card ", description: "Notes" })).toEqual({
      listId: "list-1",
      name: "Test card",
      description: "Notes",
    });
  });

  it.each([null, {}, { listId: "list-1" }, { name: "Test card" }, { listId: " ", name: "Test card" }])(
    "rejects invalid input %#",
    (input) => expect(parseCreateCardInput(input)).toBeNull(),
  );
});

describe("cardIdFrom", () => {
  it("returns a trimmed card ID", () => expect(cardIdFrom({ cardId: " card-1 " })).toBe("card-1"));
  it("rejects a missing card ID", () => expect(cardIdFrom({})).toBeNull());
});
