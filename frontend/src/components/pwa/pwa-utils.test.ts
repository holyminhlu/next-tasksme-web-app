import { describe, expect, it } from "vitest";
import {
  isIosUserAgent,
  isStandaloneDisplayMode,
  shouldShowIosInstallHint,
} from "./pwa-utils";

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";
const CHROME_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

describe("isIosUserAgent", () => {
  it("detects iPhone and iPad user agents", () => {
    expect(isIosUserAgent(IPHONE_UA)).toBe(true);
    expect(isIosUserAgent("Mozilla/5.0 (iPad; CPU OS 17_0)")).toBe(true);
  });

  it("rejects desktop user agents", () => {
    expect(isIosUserAgent(CHROME_UA)).toBe(false);
  });
});

describe("shouldShowIosInstallHint", () => {
  it("shows the hint on iOS outside standalone mode", () => {
    expect(
      shouldShowIosInstallHint({
        userAgent: IPHONE_UA,
        isStandalone: false,
        dismissed: false,
      }),
    ).toBe(true);
  });

  it("hides the hint when installed, dismissed, or not iOS", () => {
    expect(
      shouldShowIosInstallHint({
        userAgent: IPHONE_UA,
        isStandalone: true,
        dismissed: false,
      }),
    ).toBe(false);
    expect(
      shouldShowIosInstallHint({
        userAgent: IPHONE_UA,
        isStandalone: false,
        dismissed: true,
      }),
    ).toBe(false);
    expect(
      shouldShowIosInstallHint({
        userAgent: CHROME_UA,
        isStandalone: false,
        dismissed: false,
      }),
    ).toBe(false);
  });
});

describe("isStandaloneDisplayMode", () => {
  it("detects the standalone display-mode media query", () => {
    expect(
      isStandaloneDisplayMode({
        matchMedia: () => ({ matches: true }),
      }),
    ).toBe(true);
  });

  it("detects iOS navigator.standalone", () => {
    expect(
      isStandaloneDisplayMode({
        matchMedia: () => ({ matches: false }),
        navigator: { standalone: true },
      }),
    ).toBe(true);
  });

  it("returns false in a regular browser tab", () => {
    expect(
      isStandaloneDisplayMode({
        matchMedia: () => ({ matches: false }),
        navigator: {},
      }),
    ).toBe(false);
  });
});
