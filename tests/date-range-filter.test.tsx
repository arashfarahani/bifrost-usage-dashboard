// @vitest-environment jsdom
import React from "react";
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { DateRangeFilter } from "@/components/dashboard/date-range-filter";
import { defaultDateSelection } from "@/lib/utils/dates";

// jsdom does not implement this browser scrolling API used by Radix.
HTMLElement.prototype.scrollIntoView = vi.fn();
afterEach(cleanup);
async function chooseCustom() {
  fireEvent.keyDown(
    screen.getByRole("combobox", { name: "Reporting period" }),
    { key: "ArrowDown" },
  );
  const option = await screen.findByRole("option", { name: "Custom range" });
  fireEvent.keyDown(option, { key: "Enter" });
}
it("keeps the calendar open after selecting Custom range and menu focus restoration", async () => {
  const onChange = vi.fn();
  render(
    <DateRangeFilter
      timezone="Asia/Tehran"
      value={defaultDateSelection("Asia/Tehran")}
      onChange={onChange}
    />,
  );
  await chooseCustom();
  await screen.findByRole("dialog");
  // FocusScope restores focus asynchronously after its select content unmounts.
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(screen.getByRole("dialog")).toBeDefined();
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
it("reopens an already-applied custom range from the period menu", async () => {
  const onChange = vi.fn();
  render(
    <DateRangeFilter
      timezone="Asia/Tehran"
      value={{ from: "2026-01-05", to: "2026-01-12", grouping: "week" }}
      onChange={onChange}
    />,
  );
  await chooseCustom();
  await waitFor(() => expect(screen.getByRole("dialog")).toBeDefined());
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(screen.getByRole("dialog")).toBeDefined();
  fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onChange).not.toHaveBeenCalled();
  await chooseCustom();
  await screen.findByRole("dialog");
  fireEvent.click(screen.getByRole("button", { name: "Apply range" }));
  expect(onChange).toHaveBeenCalledWith({
    from: "2026-01-05",
    to: "2026-01-12",
    grouping: "week",
  });
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});
