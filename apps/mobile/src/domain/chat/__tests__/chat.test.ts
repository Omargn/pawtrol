import { counterpart, MESSAGE_MAX, messageIssue } from "@/domain/chat/chat";
import { makeConversation } from "@/test-utils/inMemoryChatRepository";

it("names the other participant from either side", () => {
  const conversation = makeConversation();

  expect(counterpart(conversation, "user-owner").name).toBe("Ben");
  expect(counterpart(conversation, "user-contact").name).toBe("Ana");
});

it("checks messages like the server does", () => {
  expect(messageIssue("  \n ")).toBe("Write a message first.");
  expect(messageIssue("x".repeat(MESSAGE_MAX + 1))).toBe(`Keep messages under ${MESSAGE_MAX} characters.`);
  expect(messageIssue(`  ${"x".repeat(MESSAGE_MAX)}  `)).toBeNull();
});
