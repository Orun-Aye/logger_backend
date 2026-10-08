import { FingerprintService } from "../../services/fingerprint.service";

const fp = (message: string, errorName = "Error") =>
  FingerprintService.compute({ errorName, message });

describe("FingerprintService", () => {
  describe("query strings", () => {
    it("groups the same failing endpoint whatever its query", () => {
      // Real messages from the demo shop that became six separate issues
      const a = fp("/api/recommendations?exclude=scale answered 503");
      const b = fp("/api/recommendations?exclude=kettle answered 503");
      const c = fp("/api/recommendations?exclude=pour-over&limit=3 answered 503");

      expect(a).toBe(b);
      expect(a).toBe(c);
    });

    it("groups full URLs that differ only in their query", () => {
      expect(fp("GET https://api.example.com/items?page=2 failed")).toBe(
        fp("GET https://api.example.com/items?page=9 failed")
      );
    });

    it("keeps different paths apart", () => {
      expect(fp("/api/recommendations?exclude=scale answered 503")).not.toBe(
        fp("/api/checkout?exclude=scale answered 503")
      );
    });

    it("keeps different failures on the same path apart", () => {
      expect(fp("/api/recommendations?exclude=scale timed out")).not.toBe(
        fp("/api/recommendations?exclude=scale was refused")
      );
    });

    it("leaves question marks in ordinary sentences alone", () => {
      expect(FingerprintService.normalizeMessage("Is the user signed in? No profile found")).toBe(
        "Is the user signed in? No profile found"
      );
    });
  });

  describe("buildTitle", () => {
    it("keeps the query in the title so a person can still see a real example", () => {
      expect(
        FingerprintService.buildTitle({ errorName: "Error", message: "/api/recommendations?exclude=scale answered 503" })
      ).toBe("Error: /api/recommendations?exclude=scale answered 503");
    });
  });
});
