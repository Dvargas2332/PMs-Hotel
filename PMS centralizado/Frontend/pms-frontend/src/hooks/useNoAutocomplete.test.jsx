import React from "react";
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import useNoAutocomplete from "./useNoAutocomplete";

function Probe({ later = false }) {
  useNoAutocomplete();
  return (
    <div>
      <input placeholder="monto" />
      <textarea placeholder="nota" />
      {later && <input placeholder="aparece despues" />}
    </div>
  );
}

const expectClean = (field) => {
  expect(field.getAttribute("autocomplete")).toBe("off");
  expect(field.getAttribute("data-lpignore")).toBe("true");
  expect(field.getAttribute("data-1p-ignore")).toBe("true");
  expect(field.getAttribute("data-form-type")).toBe("other");
};

describe("useNoAutocomplete", () => {
  it("marca los campos que ya están en pantalla", () => {
    const { getByPlaceholderText } = render(<Probe />);
    expectClean(getByPlaceholderText("monto"));
    expectClean(getByPlaceholderText("nota"));
  });

  it("marca también los campos que aparecen después", async () => {
    const { getByPlaceholderText, rerender } = render(<Probe />);
    rerender(<Probe later />);
    await waitFor(() => expectClean(getByPlaceholderText("aparece despues")));
  });
});
