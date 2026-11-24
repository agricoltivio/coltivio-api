import { describe, test, expect } from "@jest/globals";
import { toExcerpt } from "./forum.email";

describe("toExcerpt", () => {
  test("decodes entities the editor writes, a line break becomes a space", () => {
    expect(toExcerpt("Web wohl schon früher.&#x20;\nNächste Zeile")).toBe("Web wohl schon früher. Nächste Zeile");
  });

  test("drops Markdown syntax, images and raw HTML", () => {
    expect(
      toExcerpt(
        "## Frage\n\n**Wann** mähen? Siehe [Wiki](https://example.com) ![Weide](https://x/y.webp)\n\n- eins\n- zwei <b>x</b>"
      )
    ).toBe("Frage Wann mähen? Siehe Wiki eins zwei x");
  });

  test("keeps words whole around emphasis and links, a <br> separates words", () => {
    expect(toExcerpt("**Bio**dünger und [Heu](https://x)ballen")).toBe("Biodünger und Heuballen");
    expect(toExcerpt("Kuh<br>Kalb")).toBe("Kuh Kalb");
  });

  test("shortens long text with an ellipsis", () => {
    const excerpt = toExcerpt("Wort ".repeat(200));
    expect(excerpt.length).toBeLessThanOrEqual(301);
    expect(excerpt.endsWith("…")).toBe(true);
  });
});
